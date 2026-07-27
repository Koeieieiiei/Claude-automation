"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * แผงจำลองการซื้อ — ใช้ทดสอบระบบทำข้อสอบโดยไม่ต้องจ่ายเงินจริง
 * เปิดได้เฉพาะตอนรันในเครื่อง (next dev) — บนเว็บจริง API จะตอบ 404 และหน้านี้จะบอกว่าปิดอยู่
 *
 * ข้อมูลทุกอย่างเก็บเป็นไฟล์ในเครื่อง (data/exam/) ไม่แตะฐานข้อมูลลูกค้าจริง
 */

interface BuyerRow {
  email: string;
  firstName: string;
  lastName: string;
  attemptState: "none" | "in_progress" | "submitted";
  correctCount: number | null;
}

const LS_TOKEN = "exam.token";
const LS_EMAIL = "exam.email";

export default function ExamDemoPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeEmail, setActiveEmail] = useState("");

  const call = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/exam/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 404) throw new Error("disabled");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "ผิดพลาด");
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await call({ action: "list" });
      setBuyers(data.buyers ?? []);
      setEnabled(true);
    } catch (e) {
      if ((e as Error).message === "disabled") setEnabled(false);
    }
  }, [call]);

  useEffect(() => {
    refresh();
    try {
      setActiveEmail(localStorage.getItem(LS_EMAIL) ?? "");
    } catch {}
  }, [refresh]);

  /** เก็บโทเค็นลง localStorage — ให้ปุ่มหน้าแรกและหน้า /exam จำว่า "เครื่องนี้คือผู้ซื้อคนนี้" */
  const useBuyer = useCallback((token: string, email: string) => {
    try {
      localStorage.setItem(LS_TOKEN, token);
      localStorage.setItem(LS_EMAIL, email);
    } catch {}
    setActiveEmail(email);
  }, []);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setMsg("");
      try {
        await fn();
        await refresh();
      } catch (e) {
        setMsg((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  if (enabled === null) {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center">
        <p className="text-ink/60">กำลังโหลด…</p>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md border border-ink bg-paper px-8 py-10 text-center">
          <p className="font-display text-xl font-bold text-ink">หน้านี้ปิดอยู่</p>
          <p className="mt-3 text-sm text-ink/70">
            แผงจำลองการซื้อใช้ได้เฉพาะตอนรันทดสอบในเครื่อง (โหมด dev) เท่านั้น
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid-paper min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="border-2 border-dashed border-maroon bg-maroon/[0.04] px-5 py-4">
          <p className="font-label text-[11px] font-bold uppercase tracking-[0.2em] text-maroon">
            🔧 โหมดแบบจำลอง (ทดสอบในเครื่อง)
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
            หน้านี้ใช้<strong>แทนการจ่ายเงินจริง</strong>: สร้าง “ผู้ซื้อจำลอง” แล้วไปทดสอบทำข้อสอบได้ทันที
            ข้อมูลเก็บในเครื่องทั้งหมด (โฟลเดอร์ <code className="bg-white px-1">data/exam/</code>) ·
            สถิติภาพรวมมาจากประชากรอ้างอิงของสนามสอบ (population.json)
          </p>
        </div>

        {/* ฟอร์มสร้างผู้ซื้อจำลอง */}
        <form
          className="mt-6 border border-ink bg-white p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const email = (f.get("email") as string).trim();
            const firstName = (f.get("firstName") as string).trim();
            const lastName = (f.get("lastName") as string).trim();
            if (!email) return;
            run(async () => {
              const data = await call({ action: "grant", email, firstName, lastName });
              useBuyer(data.token, data.buyer.email);
              setMsg(`✓ ให้สิทธิ์ ${data.buyer.email} แล้ว และตั้งเป็นผู้ซื้อของเบราว์เซอร์นี้ — ไปดูปุ่มหน้าแรก หรือกดเข้าห้องสอบได้เลย`);
            });
          }}
        >
          <h2 className="font-display text-xl font-bold text-ink">1) จำลองการซื้อชุด Mock</h2>
          <p className="mt-1 text-sm text-ink/60">
            เทียบเท่าลูกค้าที่จ่ายเงินสำเร็จ — อีเมลนี้จะได้สิทธิ์ทำข้อสอบ 1 รอบ
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              name="email"
              type="email"
              required
              placeholder="อีเมลทดสอบ"
              defaultValue="test@example.com"
              className="border border-ink/40 px-3 py-2.5 outline-none focus:border-maroon sm:col-span-3"
            />
            <input
              name="firstName"
              placeholder="ชื่อ (มีลายน้ำบนไฟล์)"
              defaultValue="นักเรียน"
              className="border border-ink/40 px-3 py-2.5 outline-none focus:border-maroon"
            />
            <input
              name="lastName"
              placeholder="นามสกุล"
              defaultValue="ทดสอบ"
              className="border border-ink/40 px-3 py-2.5 outline-none focus:border-maroon"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-maroon px-4 py-2.5 font-bold text-paper transition hover:bg-maroon-dark disabled:opacity-60"
            >
              จำลองซื้อ ✓
            </button>
          </div>
        </form>

        {/* ทางลัดทดสอบ */}
        <div className="mt-4 border border-ink bg-white p-6">
          <h2 className="font-display text-xl font-bold text-ink">2) ทางลัดทดสอบ</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="border border-ink/40 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink">
              ดูปุ่มหน้าแรก (เปลี่ยนเป็น “ทำข้อสอบ”)
            </a>
            <a href="/exam" className="border border-ink/40 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink">
              เข้าห้องสอบ →
            </a>
            <a href="/exam/results" className="border border-ink/40 px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink">
              ดูผลสอบ (ต้องส่งแล้ว) →
            </a>
          </div>
          <div className="mt-5 border-t border-dashed border-grid pt-5">
            <p className="text-sm font-semibold text-ink">
              จำลอง “สอบเสร็จทันที” (ระบบสุ่มฝนคำตอบให้ แล้วดูหน้าผลได้เลย)
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {(
                [
                  ["weak", "เด็กอ่อน"],
                  ["avg", "เด็กกลาง ๆ"],
                  ["strong", "เด็กเก่ง"],
                ] as const
              ).map(([ability, label]) => (
                <button
                  key={ability}
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const email = `sim-${ability}-${Date.now().toString(36)}@example.com`;
                      const data = await call({ action: "simulate", email, ability });
                      useBuyer(data.token, email);
                      setMsg(
                        `✓ จำลองสอบเสร็จ (${label}) ถูก ${data.correctCount}/70 = ${data.scaled} คะแนน — กด "ดูผลสอบ" ด้านบนได้เลย`
                      );
                    })
                  }
                  className="border border-maroon/50 px-4 py-2.5 text-sm font-bold text-maroon transition hover:bg-maroon hover:text-paper disabled:opacity-60"
                >
                  สุ่มสอบแบบ{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {msg && (
          <p className="mt-4 border border-maroon/40 bg-white px-4 py-3 text-sm text-ink/80">{msg}</p>
        )}

        {/* รายชื่อผู้ซื้อจำลอง */}
        <div className="mt-6 border border-ink bg-white">
          <div className="flex items-center justify-between border-b border-ink px-5 py-3">
            <h2 className="font-display text-lg font-bold text-ink">ผู้ซื้อจำลองทั้งหมด</h2>
            <button onClick={() => refresh()} className="text-sm font-semibold text-maroon hover:underline">
              รีเฟรช
            </button>
          </div>
          {buyers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink/50">ยังไม่มี — สร้างจากฟอร์มด้านบน</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-grid text-left font-label text-[11px] uppercase tracking-wide text-ink/55">
                    <th className="px-4 py-2.5">อีเมล</th>
                    <th className="px-4 py-2.5">ชื่อ</th>
                    <th className="px-4 py-2.5">สถานะสอบ</th>
                    <th className="px-4 py-2.5 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={b.email} className="border-b border-dashed border-grid">
                      <td className="px-4 py-2.5 font-mono text-[13px]">
                        {b.email}
                        {b.email === activeEmail && (
                          <span className="ml-2 border border-maroon/40 bg-maroon/10 px-1.5 font-label text-[10px] font-bold text-maroon">
                            เครื่องนี้
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {b.firstName} {b.lastName}
                      </td>
                      <td className="px-4 py-2.5">
                        {b.attemptState === "submitted"
                          ? `ส่งแล้ว · ถูก ${b.correctCount}/70`
                          : b.attemptState === "in_progress"
                            ? "กำลังสอบ (เวลาเดินอยู่)"
                            : "ยังไม่เริ่ม"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const data = await call({ action: "grant", email: b.email, firstName: b.firstName, lastName: b.lastName });
                                useBuyer(data.token, b.email);
                                setMsg(`✓ สลับมาใช้ ${b.email} ในเบราว์เซอร์นี้แล้ว`);
                              })
                            }
                            className="border border-ink/30 px-2.5 py-1 font-label text-[11px] font-semibold text-ink transition hover:border-ink"
                          >
                            ใช้คนนี้
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await call({ action: "reset", email: b.email });
                                setMsg(`✓ รีเซ็ตการสอบของ ${b.email} แล้ว — ทำข้อสอบใหม่ได้`);
                              })
                            }
                            className="border border-ink/30 px-2.5 py-1 font-label text-[11px] font-semibold text-ink transition hover:border-ink"
                          >
                            รีเซ็ตการสอบ
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await call({ action: "revoke", email: b.email });
                                setMsg(`✓ ลบ ${b.email} แล้ว`);
                              })
                            }
                            className="border border-maroon/40 px-2.5 py-1 font-label text-[11px] font-semibold text-maroon transition hover:bg-maroon hover:text-paper"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-6 font-label text-xs leading-relaxed text-ink/45">
          หมายเหตุ: แบบจำลองนี้เก็บข้อมูลเป็นไฟล์ในเครื่อง ยังไม่เชื่อมฐานข้อมูลจริงและไม่ส่งอีเมล —
          ก่อนขึ้นเว็บจริงต้องย้ายที่เก็บไป Supabase และต่อเข้ากับระบบส่งของหลังจ่ายเงิน (ดูรายการใน README)
        </p>
      </div>
    </main>
  );
}
