"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Product } from "@/lib/catalog";
import { trackEvent } from "@/lib/analytics";
import { splitName } from "@/lib/name";
import GoogleButton from "./GoogleButton";
import type { ClientUser } from "./AccountButton";

interface Props {
  product: Product;
  onClose: () => void;
  /** ผู้ที่ล็อกอินอยู่ (null = ยังไม่ล็อกอิน) — ล็อกอินแล้วจะเติมอีเมล/ชื่อจากบัญชี Google ให้ */
  user?: ClientUser | null;
  /** หน้าที่จะกลับมาเปิดฟอร์มนี้ต่อหลังกดล็อกอินจากในฟอร์ม */
  returnTo?: string;
}

export default function BuyModal({ product, onClose, user = null, returnTo }: Props) {
  // ล็อกอินแล้ว: อีเมลล็อกตามบัญชี Google (คอร์สจะไปโผล่ในบัญชีนี้แน่นอน) ชื่อเติมให้แต่แก้ได้
  const googleName = splitName(user?.name ?? "");
  const [firstName, setFirstName] = useState(googleName.firstName);
  const [lastName, setLastName] = useState(googleName.lastName);
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ฟอร์มอาจเปิดก่อนที่หน้าเว็บจะรู้ว่าล็อกอินอยู่ (เช่น เปิดจาก ?buy=) — พอรู้แล้วค่อยเติมให้
  // อีเมลยึดตามบัญชีเสมอ ส่วนชื่อเติมเฉพาะช่องที่ยังว่าง (ไม่ทับที่ลูกค้าพิมพ์ไว้)
  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    const n = splitName(user.name);
    setFirstName((v) => v || n.firstName);
    setLastName((v) => v || n.lastName);
  }, [user]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = firstName.trim() && lastName.trim() && emailValid && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, firstName, lastName, email }),
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
              <span className="min-w-0 text-ink/70">
                สั่งซื้อเข้าบัญชี <strong className="break-all text-ink">{user.email}</strong>
              </span>
              <a
                href={`/api/auth/logout?switch=1&next=${encodeURIComponent(returnTo ?? `/?buy=${product.id}`)}`}
                className="shrink-0 font-label text-xs font-semibold text-maroon underline underline-offset-2 hover:no-underline"
              >
                เปลี่ยนบัญชี
              </a>
            </div>
          ) : (
            <div>
              <GoogleButton
                next={returnTo ?? `/?buy=${product.id}`}
                label="เข้าสู่ระบบด้วย Google เพื่อกรอกอีเมลอัตโนมัติ"
                className="py-3 text-sm"
              />
              <p className="mt-2 font-label text-[11px] leading-snug text-ink/55">
                ล็อกอินด้วยบัญชี Google อีเมลเดียวกับที่สั่งซื้อ จึงจะเข้าห้องสอบและกลับมาโหลดไฟล์ได้ตลอด
              </p>
              <div className="mt-4 flex items-center gap-3 font-label text-[11px] text-ink/40">
                <span className="h-px flex-1 bg-ink/15" />
                หรือกรอกเอง
                <span className="h-px flex-1 bg-ink/15" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ชื่อ" value={firstName} onChange={setFirstName} placeholder="ชื่อจริง" />
            <Field label="นามสกุล" value={lastName} onChange={setLastName} placeholder="นามสกุล" />
          </div>
          <Field
            label="อีเมล"
            value={email}
            onChange={setEmail}
            placeholder="you@email.com"
            type="email"
            readOnly={Boolean(user)}
            hint={
              user
                ? "อีเมลของบัญชีที่ล็อกอินอยู่ — ไฟล์และสิทธิ์เข้าสอบจะอยู่ในหน้า “คอร์สของฉัน” ของบัญชีนี้"
                : "⚠️ ตรวจสอบอีเมลให้ถูกต้องอีกครั้งก่อนชำระเงิน — หากกรอกอีเมลผิด ไฟล์จะถูกส่งไปผิดและจะไม่มีการคืนเงิน"
            }
          />

          {error && (
            <p className="border border-maroon/30 bg-maroon/5 px-3 py-2 text-sm text-maroon">{error}</p>
          )}

          <div className="flex items-center justify-between border-t border-dashed border-ink/20 pt-4">
            <span className="font-label text-xs text-ink/60">ยอดชำระ</span>
            <span className="font-display text-2xl font-bold text-ink">฿{product.price.toLocaleString()}</span>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            {loading ? "กำลังพาไปหน้าชำระเงิน…" : "ไปหน้าชำระเงิน"}
          </button>
          <p className="text-center font-label text-[11px] text-ink/50">
            🔒 ชำระเงินปลอดภัยผ่าน Stripe · PromptPay
          </p>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", hint, readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-label text-[11px] uppercase tracking-wider text-ink/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full border border-ink/25 px-3 py-2.5 text-ink outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/15 ${
          readOnly ? "cursor-default bg-ink/[0.04] text-ink/70" : "bg-white"
        }`}
      />
      {hint && (
        <span
          className={`mt-1.5 block font-label text-[11px] font-medium leading-snug ${readOnly ? "text-ink/55" : "text-maroon"}`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
