"use client";

import { useState } from "react";

/** ฟอร์ม "ลืมรหัสผ่าน" — กรอกอีเมล → ส่งลิงก์ตั้งรหัสผ่านให้ (ตอบเหมือนกันเสมอ ไม่บอกว่าอีเมลมีบัญชีหรือไม่) */
export function ForgotForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "ผิดพลาด ลองใหม่อีกครั้ง");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">
        <p className="border border-ink/20 bg-white px-4 py-3">
          ส่งลิงก์ไปที่ <strong className="text-ink">{email}</strong> แล้ว กดลิงก์ภายใน 30 นาที (ไม่เจอ ดูในสแปม)
        </p>
        <p className="font-label text-xs text-ink/55">
          ไม่ได้รับ?{" "}
          <button type="button" onClick={() => setSent(false)} className="font-semibold text-maroon underline underline-offset-2">
            ส่งอีกครั้ง
          </button>{" "}
          หรือติดต่อ mr.tpat3@gmail.com
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="font-label text-xs font-semibold text-ink/70">อีเมล</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          className="mt-1 w-full border border-ink/30 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-maroon"
        />
      </label>
      {error && <p className="border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {loading ? "กำลังส่ง…" : "ส่งลิงก์"}
      </button>
    </form>
  );
}

/** ฟอร์มตั้งรหัสผ่านใหม่ (มาจากลิงก์ในอีเมล) — สำเร็จ = ล็อกอินให้แล้วพาไปคอร์สของฉัน */
export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "ผิดพลาด ลองใหม่อีกครั้ง");
      window.location.href = data.next || "/my-courses";
    } catch (err) {
      setError(err instanceof Error ? err.message : "ผิดพลาด ลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, auto: string) => (
    <label className="block">
      <span className="font-label text-xs font-semibold text-ink/70">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => set(e.target.value)}
        autoComplete={auto}
        required
        minLength={8}
        maxLength={72}
        className="mt-1 w-full border border-ink/30 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-maroon"
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {field("รหัสผ่านใหม่ (8 ตัวขึ้นไป)", password, setPassword, "new-password")}
      {field("ยืนยันรหัสผ่านใหม่", confirm, setConfirm, "new-password")}
      <label className="flex items-center gap-2 font-label text-xs text-ink/60">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        แสดงรหัสผ่าน
      </label>
      {error && <p className="border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {loading ? "กำลังบันทึก…" : "ตั้งรหัสผ่าน"}
      </button>
    </form>
  );
}
