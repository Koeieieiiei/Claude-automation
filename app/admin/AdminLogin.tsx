"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // โหลดหน้าใหม่เพื่อให้ฝั่ง server เห็นคุกกี้แล้วเรนเดอร์แดชบอร์ด
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid-paper flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-grid bg-white p-6 shadow-sm"
      >
        <p className="eyebrow">Mr.tpat3</p>
        <h1 className="mt-1 text-2xl font-bold">สรุปยอดขาย</h1>
        <p className="mt-1 text-sm text-ink/60">หน้าสำหรับเจ้าของร้านเท่านั้น</p>

        <label className="mt-5 block text-sm font-medium" htmlFor="admin-password">
          รหัสผ่าน
        </label>
        <input
          id="admin-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-grid bg-paper px-3 py-2.5 outline-none focus:border-maroon"
        />

        {error && <p className="mt-3 text-sm text-maroon">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-xl bg-maroon px-4 py-2.5 font-semibold text-white transition hover:bg-maroon-dark disabled:opacity-50"
        >
          {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
