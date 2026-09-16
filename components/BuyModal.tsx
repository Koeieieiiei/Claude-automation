"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/lib/catalog";
import { trackEvent } from "@/lib/analytics";
import GoogleButton from "./GoogleButton";
import { Avatar, ClientUser } from "./AccountButton";

interface Props {
  product: Product;
  onClose: () => void;
  /** ผู้ที่ล็อกอินอยู่ (null = ยังไม่ล็อกอิน) */
  user?: ClientUser | null;
  /** หน้าที่จะกลับมาเปิดฟอร์มนี้ต่อหลังกดล็อกอินจากในฟอร์ม */
  returnTo?: string;
}

/**
 * ฟอร์มสั่งซื้อ — ไม่มีช่องกรอกอะไรเลย (เจ้าของสั่ง 2026-09-16):
 * ล็อกอินด้วย Google → กด "ไปหน้าชำระเงิน" → จ่าย PromptPay ผ่าน Stripe → คอร์สโผล่ที่ "คอร์สของฉัน"
 * ชื่อ/อีเมลของออเดอร์มาจากบัญชี Google ฝั่ง server (app/api/checkout) ไม่รับจากหน้าเว็บ
 */
export default function BuyModal({ product, onClose, user = null, returnTo }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = returnTo ?? `/?buy=${product.id}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      // กันเคส server ตอบ ok แต่ไม่มี url — อย่าพาผู้ใช้ไปหน้า "/null"
      if (!data.url) throw new Error("ไม่ได้รับลิงก์หน้าชำระเงิน กรุณาลองใหม่อีกครั้ง");
      // นับตอนกำลังพาไปหน้าจ่ายเงินจริง (ไม่ใช่ตอนกดปุ่ม) — สะท้อนความตั้งใจซื้อจริง
      trackEvent("begin_checkout", {
        product_id: product.id,
        value: product.price,
        currency: "THB",
      });
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoading(false);
    }
  }

  // วาดที่ body เสมอ — ถ้าวาดในที่ที่เรียก (เช่น sidebar sticky ของหน้าคอร์ส) จะโดน stacking context
  // ของหน้านั้นครอบ ทำให้รูปปกทะลุขึ้นมาทับฟอร์ม
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-maroon bg-paper shadow-[0_25px_60px_-20px_rgba(110,20,35,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink px-6 py-4">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-maroon">ใบสั่งซื้อ</p>
            <h2 className="mt-0.5 font-display text-lg font-bold leading-snug text-ink">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center border border-ink/30 font-label text-ink transition hover:bg-ink hover:text-paper"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          {user ? (
            <div className="flex items-center justify-between gap-3 border border-ink/15 bg-white px-3 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar user={user} size="h-8 w-8" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-ink/55">สั่งซื้อเข้าบัญชี</span>
                  <strong className="block truncate text-ink">{user.email}</strong>
                </span>
              </span>
              <a
                href={`/api/auth/logout?switch=1&next=${encodeURIComponent(next)}`}
                className="shrink-0 font-label text-xs font-semibold text-maroon underline underline-offset-2 hover:no-underline"
              >
                เปลี่ยนบัญชี
              </a>
            </div>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-ink/75">
                ล็อกอินด้วยบัญชี Google ก่อนสั่งซื้อ — คอร์สและไฟล์จะผูกกับบัญชีนี้
                กลับมาเข้าเรียนได้ทุกเครื่องที่หน้า “คอร์สของฉัน” ไม่ต้องกรอกอะไรเพิ่ม
              </p>
              <GoogleButton next={next} label="เข้าสู่ระบบด้วย Google เพื่อสั่งซื้อ" className="mt-3" />
            </div>
          )}

          {error && (
            <p className="border border-maroon/30 bg-maroon/5 px-3 py-2 text-sm text-maroon">{error}</p>
          )}

          <div className="flex items-center justify-between border-t border-dashed border-ink/20 pt-4">
            <span className="font-label text-xs text-ink/60">ยอดชำระ</span>
            <span className="font-display text-2xl font-bold text-ink">฿{product.price.toLocaleString()}</span>
          </div>

          {user && (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-ink/30"
            >
              {loading ? "กำลังพาไปหน้าชำระเงิน…" : "ไปหน้าชำระเงิน"}
            </button>
          )}
          <p className="text-center font-label text-[11px] text-ink/50">
            🔒 ชำระเงินปลอดภัยผ่าน Stripe · PromptPay · สินค้าดิจิทัล ไม่มีการคืนเงิน
          </p>
        </form>
      </div>
    </div>,
    document.body
  );
}
