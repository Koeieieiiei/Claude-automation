"use client";

import { useState } from "react";

interface Props {
  price: number;
  productName: string;
  onClose: () => void;
}

export default function BuyModal({ price, productName, onClose }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-maroon bg-paper shadow-[0_25px_60px_-20px_rgba(110,20,35,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink px-6 py-4">
          <div>
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-maroon">ใบสั่งซื้อ</p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-ink">{productName}</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center border border-ink/30 font-label text-ink transition hover:bg-ink hover:text-paper"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
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
            hint="⚠️ ตรวจสอบอีเมลให้ถูกต้องอีกครั้งก่อนชำระเงิน — หากกรอกอีเมลผิด ไฟล์จะถูกส่งไปผิดและจะไม่มีการคืนเงิน"
          />

          {error && (
            <p className="border border-maroon/30 bg-maroon/5 px-3 py-2 text-sm text-maroon">{error}</p>
          )}

          <div className="flex items-center justify-between border-t border-dashed border-ink/20 pt-4">
            <span className="font-label text-xs text-ink/60">ยอดชำระ</span>
            <span className="font-display text-2xl font-bold text-ink">฿{price.toLocaleString()}</span>
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
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-label text-[11px] uppercase tracking-wider text-ink/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-ink/25 bg-white px-3 py-2.5 text-ink outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/15"
      />
      {hint && <span className="mt-1.5 block font-label text-[11px] font-medium leading-snug text-maroon">{hint}</span>}
    </label>
  );
}
