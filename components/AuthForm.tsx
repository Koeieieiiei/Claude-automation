"use client";

import { useState } from "react";

type Mode = "signin" | "signup";

/**
 * ฟอร์มเข้าสู่ระบบ / สมัครสมาชิก — กรอกแค่อีเมล + รหัสผ่าน (เจ้าของสั่ง 2026-09-26 แทนปุ่ม Google)
 * ยิง POST /api/auth/login หรือ /api/auth/signup แล้วพาไป next เมื่อสำเร็จ
 */
export default function AuthForm({
  next,
  initialMode = "signin",
  initialEmail = "",
}: {
  next: string;
  initialMode?: Mode;
  initialEmail?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(mode === "signin" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        next?: string;
        error?: string;
        code?: string;
        verifySent?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        if (data.code === "exists") setMode("signin");
        throw new Error(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
      if (data.verifySent) {
        setInfo(data.message ?? "ส่งลิงก์ตั้งรหัสผ่านไปที่อีเมลแล้ว");
        setLoading(false);
        return;
      }
      window.location.href = data.next || next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
      setLoading(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
        setInfo(null);
      }}
      className={`flex-1 border-b-2 px-3 pb-2.5 pt-1 font-display text-sm font-bold transition ${
        mode === m ? "border-maroon text-maroon" : "border-transparent text-ink/50 hover:text-ink"
      }`}
      aria-pressed={mode === m}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex border-b border-grid">
        {tab("signin", "Sign In")}
        {tab("signup", "Sign Up")}
      </div>

      <label className="block">
        <span className="font-label text-xs font-semibold text-ink/70">อีเมล</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          className="mt-1 w-full border border-ink/30 bg-white px-3.5 py-3 text-base text-ink outline-none transition focus:border-maroon"
        />
      </label>

      <label className="block">
        <span className="font-label text-xs font-semibold text-ink/70">
          รหัสผ่าน{mode === "signup" && <span className="font-normal text-ink/50"> (อย่างน้อย 8 ตัวอักษร)</span>}
        </span>
        <span className="relative mt-1 block">
          <input
            type={show ? "text" : "password"}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : 1}
            maxLength={72}
            className="w-full border border-ink/30 bg-white py-3 pl-3.5 pr-16 text-base text-ink outline-none transition focus:border-maroon"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 font-label text-xs font-semibold text-ink/60 hover:text-maroon"
          >
            {show ? "ซ่อน" : "แสดง"}
          </button>
        </span>
      </label>

      {error && (
        <p className="border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm leading-relaxed text-maroon">{error}</p>
      )}
      {info && (
        <p className="border border-ink/20 bg-white px-4 py-3 text-sm leading-relaxed text-ink">{info}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-ink/30"
      >
        {loading ? "กำลังดำเนินการ…" : mode === "signin" ? "Sign In" : "Sign Up"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 font-label text-xs text-ink/60">
        <a
          href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className="font-semibold text-maroon underline underline-offset-2 hover:no-underline"
        >
          ลืมรหัสผ่าน?
        </a>
        {mode === "signin" ? (
          <span>
            ยังไม่มีบัญชี?{" "}
            <button type="button" onClick={() => setMode("signup")} className="font-semibold text-maroon underline underline-offset-2 hover:no-underline">
              Sign Up
            </button>
          </span>
        ) : (
          <span>
            มีบัญชีแล้ว?{" "}
            <button type="button" onClick={() => setMode("signin")} className="font-semibold text-maroon underline underline-offset-2 hover:no-underline">
              Sign In
            </button>
          </span>
        )}
      </div>

      {mode === "signup" && (
        <p className="font-label text-[11px] leading-snug text-ink/50">
          การสมัครถือว่ายอมรับ{" "}
          <a href="/terms" target="_blank" className="underline underline-offset-2 hover:text-maroon">ข้อกำหนดการใช้งาน</a> และ{" "}
          <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-maroon">นโยบายความเป็นส่วนตัว</a>
        </p>
      )}
    </form>
  );
}
