"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EXAM, sectionOf } from "@/lib/exam-config";

/**
 * ห้องสอบออนไลน์ Mock TPAT3 — 70 ข้อ จับเวลา 3 ชั่วโมง ทำได้ 1 รอบต่ออีเมลที่ซื้อ
 *
 * ลำดับหน้าจอ: gate (กรอกอีเมล/ลิงก์) → instructions (คำชี้แจง + กติกา) → exam → ไปหน้าผล
 * เวลาอิงนาฬิกา server เสมอ (คำนวณ offset ตอน start) — แก้นาฬิกาเครื่องเองไม่มีผล
 */

type Phase = "loading" | "gate" | "instructions" | "exam";

const LS_TOKEN = "exam.token";
const LS_EMAIL = "exam.email";

interface AccessResponse {
  state?: "none" | "eligible" | "in_progress" | "submitted";
  token?: string;
  email?: string;
  firstName?: string;
  /** อีเมลยกเว้น (เจ้าของร้าน): ส่งแล้วแต่เริ่มรอบใหม่ได้ */
  retake?: boolean;
  error?: string;
}

export default function ExamView() {
  const router = useRouter();
  const params = useSearchParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [resumed, setResumed] = useState(false);
  const [retakeMode, setRetakeMode] = useState(false); // อีเมลยกเว้น เริ่มรอบใหม่ทับรอบเก่า
  const [gateError, setGateError] = useState("");
  const [busy, setBusy] = useState(false);

  // สถานะระหว่างสอบ
  const [deadline, setDeadline] = useState(0); // server ms
  const [clockOffset, setClockOffset] = useState(0); // serverNow - clientNow
  const [answers, setAnswers] = useState<number[]>(() => Array(EXAM.totalQuestions).fill(0));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pageRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const dirtyRef = useRef(false);

  const answeredCount = useMemo(() => answers.filter((a) => a > 0).length, [answers]);

  /* ---------- เข้าห้องสอบ: เช็คสิทธิ์จากโทเค็น (ลิงก์/localStorage) หรือชื่อ+อีเมล ---------- */

  const applyAccess = useCallback(
    (data: AccessResponse, opts: { verified?: boolean } = {}) => {
      if (!data.state || data.state === "none") {
        setGateError(
          "ชื่อ นามสกุล หรืออีเมลไม่ตรงกับข้อมูลการสั่งซื้อ — ตรวจตัวสะกดอีกครั้ง (ต้องตรงกับที่กรอกตอนซื้อ)"
        );
        setPhase("gate");
        return;
      }
      const t = data.token ?? "";
      setToken(t);
      setEmail(data.email ?? "");
      setFirstName(data.firstName ?? "");
      try {
        localStorage.setItem(LS_TOKEN, t);
        localStorage.setItem(LS_EMAIL, data.email ?? "");
      } catch {}

      if (data.state === "submitted" && !data.retake) {
        router.replace(`/exam/results?token=${encodeURIComponent(t)}`);
        return;
      }
      // ยังไม่เริ่มสอบ + ยังไม่ได้ยืนยันชื่อ-อีเมลรอบนี้ → ให้กรอกก่อนเสมอ (กติกาห้องสอบ)
      // ส่วนคนที่กำลังสอบค้างอยู่ ให้กลับเข้าห้องต่อได้เลย ไม่ต้องกรอกซ้ำ
      if (data.state !== "in_progress" && !opts.verified) {
        setPhase("gate");
        return;
      }
      setRetakeMode(Boolean(data.state === "submitted" && data.retake));
      setResumed(data.state === "in_progress");
      setPhase("instructions");
    },
    [router]
  );

  const checkAccess = useCallback(
    async (
      body: { token?: string; email?: string; firstName?: string; lastName?: string },
      opts: { verified?: boolean } = {}
    ) => {
      setBusy(true);
      setGateError("");
      try {
        const res = await fetch("/api/exam/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as AccessResponse;
        if (!res.ok) {
          setGateError(data.error ?? "ตรวจสอบสิทธิ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
          if (body.token) {
            try {
              localStorage.removeItem(LS_TOKEN);
            } catch {}
          }
          setPhase("gate");
          return;
        }
        applyAccess(data, opts);
      } catch {
        setGateError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
        setPhase("gate");
      } finally {
        setBusy(false);
      }
    },
    [applyAccess]
  );

  useEffect(() => {
    const fromUrl = params.get("token");
    let stored = "";
    try {
      stored = localStorage.getItem(LS_TOKEN) ?? "";
    } catch {}
    const t = fromUrl || stored;
    if (t) checkAccess({ token: t });
    else {
      try {
        setEmail(localStorage.getItem(LS_EMAIL) ?? "");
      } catch {}
      setPhase("gate");
    }
    // ตั้งใจให้รันครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- เริ่มสอบ / ทำต่อ ---------- */

  const startExam = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // ส่งไปแล้ว — ไปหน้าผล
          router.replace(`/exam/results?token=${encodeURIComponent(token)}`);
          return;
        }
        setGateError(data.error ?? "เริ่มสอบไม่สำเร็จ");
        setPhase("gate");
        return;
      }
      setDeadline(data.deadline);
      setClockOffset(data.serverNow - Date.now());
      const serverAnswers: number[] = Array.isArray(data.answers)
        ? data.answers
        : Array(EXAM.totalQuestions).fill(0);
      setAnswers(serverAnswers);
      setConfirmStart(false);
      setPhase("exam");
      window.scrollTo({ top: 0 });
    } catch {
      setGateError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }, [token, router]);

  /* ---------- autosave: หน่วง 1.5 วิหลังแก้คำตอบ + ทุก 30 วิ กันพลาด ---------- */

  const saveNow = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    try {
      const res = await fetch("/api/exam/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers: answersRef.current }),
      });
      if (res.ok) setSavedAt(new Date());
    } catch {
      dirtyRef.current = true; // เก็บไว้ลองใหม่รอบหน้า
    }
  }, [token]);

  useEffect(() => {
    if (phase !== "exam") return;
    const t = setTimeout(saveNow, 1500);
    return () => clearTimeout(t);
  }, [answers, phase, saveNow]);

  useEffect(() => {
    if (phase !== "exam") return;
    const t = setInterval(saveNow, 30000);
    return () => clearInterval(t);
  }, [phase, saveNow]);

  // เตือนก่อนปิดแท็บระหว่างสอบ (เวลายังเดินต่อ แต่กันเผลอปิดทิ้ง)
  useEffect(() => {
    if (phase !== "exam") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  /* ---------- ส่งกระดาษคำตอบ ---------- */

  const submitExam = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers: answersRef.current }),
      });
      if (!res.ok && res.status !== 409) {
        setSubmitting(false);
        alert("ส่งไม่สำเร็จ ลองกดส่งอีกครั้ง");
        return;
      }
      router.replace(`/exam/results?token=${encodeURIComponent(token)}`);
    } catch {
      setSubmitting(false);
      alert("เชื่อมต่อไม่สำเร็จ ลองกดส่งอีกครั้ง");
    }
  }, [token, router, submitting]);

  const onExpire = useCallback(() => {
    setTimeUp(true);
    submitExam();
  }, [submitExam]);

  /* ---------- เลือกคำตอบ / กระโดดไปข้อ ---------- */

  const pick = useCallback((no: number, choice: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[no - 1] = next[no - 1] === choice ? 0 : choice; // กดซ้ำ = ยกเลิกคำตอบ
      return next;
    });
    dirtyRef.current = true;
  }, []);

  const jumpTo = useCallback((no: number) => {
    const q = EXAM.questions.find((x) => x.no === no);
    if (!q) return;
    const img = pageRefs.current.get(q.page);
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const y = window.scrollY + rect.top + q.yFrac * rect.height - 76;
    window.scrollTo({ top: y, behavior: "smooth" });
    setSheetOpen(false);
  }, []);

  /* ==================== render ==================== */

  if (phase === "loading") {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center">
        <p className="text-ink/60">กำลังตรวจสอบสิทธิ์…</p>
      </main>
    );
  }

  if (phase === "gate") {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
          <div className="border-b border-ink px-6 py-3">
            <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">
              ห้องสอบ Mock TPAT3
            </span>
          </div>
          <div className="px-6 py-8">
            <h1 className="font-display text-2xl font-bold text-ink">ยืนยันตัวตนก่อนเข้าสอบ</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              กรอก<strong>ชื่อ นามสกุล และอีเมลให้ตรงกับตอนสั่งซื้อ</strong>ชุด Mock TPAT3
              จึงจะเข้าทำข้อสอบออนไลน์ได้ (70 ข้อ · จับเวลา 3 ชั่วโมง · ทำได้ 1 รอบ)
            </p>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const em = ((f.get("email") as string) ?? "").trim();
                const fn = ((f.get("firstName") as string) ?? "").trim();
                const ln = ((f.get("lastName") as string) ?? "").trim();
                if (em && fn && ln) {
                  checkAccess({ email: em, firstName: fn, lastName: ln }, { verified: true });
                }
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="firstName"
                  type="text"
                  required
                  placeholder="ชื่อ"
                  className="w-full border border-ink/40 bg-white px-4 py-3 text-ink outline-none focus:border-maroon"
                />
                <input
                  name="lastName"
                  type="text"
                  required
                  placeholder="นามสกุล"
                  className="w-full border border-ink/40 bg-white px-4 py-3 text-ink outline-none focus:border-maroon"
                />
              </div>
              <input
                name="email"
                type="email"
                required
                defaultValue={email}
                placeholder="อีเมลที่ใช้สั่งซื้อ"
                className="mt-3 w-full border border-ink/40 bg-white px-4 py-3 text-ink outline-none focus:border-maroon"
              />
              <p className="mt-2 font-label text-xs text-ink/45">
                ต้องตรงกับที่กรอกตอนสั่งซื้อทั้ง 3 ช่อง
              </p>
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark disabled:opacity-60"
              >
                {busy ? "กำลังตรวจสอบ…" : "ตรวจสอบสิทธิ์เข้าสอบ"}
              </button>
            </form>
            {gateError && (
              <p className="mt-4 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">
                {gateError}{" "}
                <a href="/#mock" className="font-semibold underline underline-offset-2">
                  ดูชุดข้อสอบ →
                </a>
              </p>
            )}
            <p className="mt-5 font-label text-xs leading-relaxed text-ink/50">
              💻 แนะนำให้ทำข้อสอบในคอมพิวเตอร์หรือ iPad เพื่อเห็นโจทย์ชัดเต็มตา
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "instructions") {
    return (
      <main className="grid-paper min-h-screen px-4 py-10">
        <div className="mx-auto w-full max-w-3xl border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
          <div className="flex items-center justify-between border-b border-ink px-6 py-3">
            <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">
              ห้องสอบ Mock TPAT3
            </span>
            <span className="font-label text-xs text-ink/60">{email}</span>
          </div>

          <div className="px-6 py-8 md:px-10">
            <h1 className="font-display text-3xl font-bold text-ink">
              {resumed ? "ทำข้อสอบต่อ" : retakeMode ? "เริ่มรอบใหม่" : "พร้อมสอบหรือยัง?"}
            </h1>
            <p className="mt-2 text-ink/70">
              สวัสดี{firstName ? ` คุณ${firstName}` : ""} — อ่านกติกาสั้น ๆ ก่อนเริ่มนะ
            </p>

            {retakeMode && (
              <p className="mt-4 border border-dashed border-maroon/50 bg-maroon/[0.05] px-4 py-3 text-sm leading-relaxed text-ink/75">
                🔧 อีเมลนี้อยู่ในโหมดทดสอบ (ทำได้ไม่จำกัด) — ถ้าเริ่มรอบใหม่
                ผลสอบรอบก่อนจะถูกแทนที่{" "}
                <a
                  href={`/exam/results?token=${encodeURIComponent(token)}`}
                  className="font-semibold text-maroon underline underline-offset-2"
                >
                  ดูผลรอบล่าสุดก่อน →
                </a>
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["70 ข้อ", "ปรนัย 5 ตัวเลือก ครบ 5 ตอนตามสอบจริง"],
                ["3 ชั่วโมง", "จับเวลาอัตโนมัติ หมดเวลาระบบส่งให้ทันที"],
                ["1 รอบเท่านั้น", "1 อีเมลที่ซื้อ ทำได้ครั้งเดียว เหมือนสอบจริง"],
              ].map(([t, d]) => (
                <div key={t} className="border border-grid bg-white p-4">
                  <p className="font-display text-xl font-bold text-maroon">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink/65">{d}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 border border-maroon/40 bg-maroon/[0.05] px-5 py-4">
              <p className="text-[0.95rem] font-semibold text-maroon">
                💻 แนะนำให้ทำในคอมพิวเตอร์ หรือ iPad
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink/70">
                จะเห็นโจทย์เต็มหน้าและกรอกคำตอบสะดวกที่สุด (มือถือทำได้แต่จอเล็ก อ่านโจทย์ยาก)
              </p>
            </div>

            <ul className="mt-6 space-y-2.5 text-sm leading-relaxed text-ink/75">
              {[
                "เวลาเริ่มนับทันทีที่กดปุ่มเริ่ม และเดินต่อเนื่องแม้ปิดหน้าเว็บ — เตรียมตัวให้พร้อมก่อนกด",
                "ระบบบันทึกคำตอบให้อัตโนมัติตลอดเวลา เน็ตหลุด/รีเฟรชหน้า กลับเข้ามาทำต่อได้เลย",
                "ทำเสร็จกด “ส่งกระดาษคำตอบ” จะได้รับผลวิเคราะห์ละเอียดทันที พร้อมลิงก์ไฟล์โจทย์และเฉลยแนบท้าย",
                "เพื่อให้ผลวิเคราะห์ตรงกับฝีมือจริง ไม่ควรเปิดไฟล์เฉลยที่ได้รับตอนซื้อก่อนเข้าสอบ",
              ].map((r) => (
                <li key={r} className="relative pl-6">
                  <span className="absolute left-0 font-bold text-maroon">✓</span>
                  {r}
                </li>
              ))}
            </ul>

            <details className="mt-6 border border-grid bg-white" open={!resumed}>
              <summary className="cursor-pointer px-5 py-3 font-semibold text-ink">
                คำชี้แจงข้อสอบ (จากชุดข้อสอบจริง)
              </summary>
              <div className="space-y-3 border-t border-grid p-3">
                {EXAM.instructionPages.map((n) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={n}
                    src={`/api/exam/page/${n}?token=${encodeURIComponent(token)}`}
                    alt={`คำชี้แจงหน้า ${n}`}
                    className="w-full border border-grid"
                    style={{ aspectRatio: `${EXAM.pageWidth} / ${EXAM.pageHeight}` }}
                  />
                ))}
              </div>
            </details>

            <button
              onClick={() => (resumed ? startExam() : setConfirmStart(true))}
              disabled={busy}
              className="mt-8 w-full bg-maroon py-4 text-lg font-bold text-paper transition hover:bg-maroon-dark disabled:opacity-60"
            >
              {busy ? "กำลังเข้าห้องสอบ…" : resumed ? "กลับเข้าห้องสอบ (เวลากำลังเดิน)" : "เริ่มทำข้อสอบ — เริ่มจับเวลา 3 ชั่วโมง"}
            </button>
            {!resumed && (
              <p className="mt-2 text-center font-label text-xs text-ink/50">
                กดแล้วเวลาเดินทันทีและหยุดไม่ได้ — มีสิทธิ์ทำรอบเดียว
              </p>
            )}
          </div>
        </div>

        {confirmStart && (
          <Modal onClose={() => setConfirmStart(false)}>
            <h2 className="font-display text-xl font-bold text-ink">เริ่มจับเวลาเลยไหม?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">
              เวลา 3 ชั่วโมงจะเริ่มนับทันทีและไม่หยุดแม้ปิดหน้าเว็บ อีเมลนี้ทำได้รอบเดียวเท่านั้น
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmStart(false)}
                className="flex-1 border border-ink/40 py-3 font-semibold text-ink transition hover:border-ink"
              >
                ยังก่อน
              </button>
              <button
                onClick={startExam}
                disabled={busy}
                className="flex-1 bg-maroon py-3 font-bold text-paper transition hover:bg-maroon-dark disabled:opacity-60"
              >
                เริ่มสอบ!
              </button>
            </div>
          </Modal>
        )}
      </main>
    );
  }

  /* ---------- phase === "exam" ---------- */

  const unanswered = EXAM.totalQuestions - answeredCount;

  return (
    <div className="min-h-screen bg-paper">
      {/* แถบบน: เวลา + ความคืบหน้า + ปุ่มส่ง */}
      <header className="sticky top-0 z-40 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5">
          <div className="hidden items-center gap-2.5 md:flex">
            <span className="font-display text-lg font-bold text-ink">Mr.tpat3</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
              ห้องสอบ Mock TPAT3
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <span className="font-label text-sm text-ink/70">
              ตอบแล้ว <strong className="text-ink">{answeredCount}</strong>/{EXAM.totalQuestions}
            </span>
            <Countdown deadline={deadline} clockOffset={clockOffset} onExpire={onExpire} />
            <button
              onClick={() => setConfirmSubmit(true)}
              className="bg-maroon px-4 py-2 text-sm font-bold text-paper transition hover:bg-maroon-dark md:px-6"
            >
              ส่งกระดาษคำตอบ
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-5 px-3 py-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:px-5">
        {/* ฝั่งซ้าย: โจทย์ทุกหน้าเรียงต่อกัน */}
        <div className="min-w-0">
          <p className="mb-3 border border-grid bg-white px-4 py-2.5 text-sm text-ink/60">
            เลื่อนอ่านโจทย์ด้านล่าง แล้วฝนคำตอบใน<strong>กระดาษคำตอบ</strong>
            <span className="lg:hidden"> (ปุ่มมุมขวาล่าง)</span>
            <span className="hidden lg:inline">ด้านขวา</span> — กดเลขข้อเพื่อกระโดดไปที่โจทย์ข้อนั้นได้
          </p>
          <div className="space-y-2">
            {EXAM.questionPages.map((n) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={n}
                ref={(el) => {
                  if (el) pageRefs.current.set(n, el);
                }}
                src={`/api/exam/page/${n}?token=${encodeURIComponent(token)}`}
                alt={`โจทย์หน้า ${n - EXAM.questionPages[0] + 1}`}
                loading="lazy"
                className="w-full border border-grid bg-white"
                style={{ aspectRatio: `${EXAM.pageWidth} / ${EXAM.pageHeight}` }}
              />
            ))}
          </div>
        </div>

        {/* ฝั่งขวา (จอใหญ่): กระดาษคำตอบแบบ sticky */}
        <aside className="hidden lg:block">
          <div className="sticky top-[60px] flex max-h-[calc(100vh-76px)] flex-col border border-ink bg-white">
            <div className="flex items-center justify-between border-b border-ink px-4 py-2.5">
              <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
                กระดาษคำตอบ
              </span>
              <SaveBadge savedAt={savedAt} />
            </div>
            <div className="overflow-y-auto p-3">
              <AnswerSheet answers={answers} onPick={pick} onJump={jumpTo} />
            </div>
          </div>
        </aside>
      </div>

      {/* จอเล็ก: ปุ่มลอย + ลิ้นชักกระดาษคำตอบ */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-maroon px-5 py-3.5 font-bold text-paper shadow-[0_12px_30px_-8px_rgba(110,20,35,0.6)] transition hover:bg-maroon-dark lg:hidden"
      >
        กระดาษคำตอบ · {answeredCount}/{EXAM.totalQuestions}
      </button>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-ink/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[78vh] flex-col border-t-2 border-maroon bg-paper">
            <div className="flex items-center justify-between border-b border-grid px-4 py-3">
              <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
                กระดาษคำตอบ · ตอบแล้ว {answeredCount}/{EXAM.totalQuestions}
              </span>
              <button
                onClick={() => setSheetOpen(false)}
                className="border border-ink/30 px-3 py-1 text-sm font-semibold text-ink"
              >
                ปิด
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <AnswerSheet answers={answers} onPick={pick} onJump={jumpTo} />
            </div>
          </div>
        </div>
      )}

      {/* ยืนยันส่ง */}
      {confirmSubmit && !timeUp && (
        <Modal onClose={() => (submitting ? null : setConfirmSubmit(false))}>
          <h2 className="font-display text-xl font-bold text-ink">ส่งกระดาษคำตอบ?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            ตอบแล้ว <strong className="text-ink">{answeredCount}</strong> จาก {EXAM.totalQuestions} ข้อ
            {unanswered > 0 && (
              <>
                {" "}
                — ยังว่างอยู่ <strong className="text-maroon">{unanswered} ข้อ</strong>
              </>
            )}
            <br />
            ส่งแล้วแก้ไขไม่ได้ และถือว่าใช้สิทธิ์สอบรอบเดียวของอีเมลนี้แล้ว
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setConfirmSubmit(false)}
              disabled={submitting}
              className="flex-1 border border-ink/40 py-3 font-semibold text-ink transition hover:border-ink disabled:opacity-60"
            >
              กลับไปทำต่อ
            </button>
            <button
              onClick={submitExam}
              disabled={submitting}
              className="flex-1 bg-maroon py-3 font-bold text-paper transition hover:bg-maroon-dark disabled:opacity-60"
            >
              {submitting ? "กำลังตรวจ…" : "ยืนยันส่ง"}
            </button>
          </div>
        </Modal>
      )}

      {/* หมดเวลา */}
      {timeUp && (
        <Modal onClose={() => null}>
          <h2 className="font-display text-xl font-bold text-maroon">หมดเวลาสอบ</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            ครบ 3 ชั่วโมงแล้ว — ระบบกำลังส่งคำตอบที่บันทึกไว้และตรวจให้อัตโนมัติ…
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ---------- นาฬิกานับถอยหลัง (อิงเวลา server) ---------- */
function Countdown({
  deadline,
  clockOffset,
  onExpire,
}: {
  deadline: number;
  clockOffset: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(() => deadline - (Date.now() + clockOffset));
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      const r = deadline - (Date.now() + clockOffset);
      setRemaining(r);
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    }, 500);
    return () => clearInterval(t);
  }, [deadline, clockOffset, onExpire]);

  const r = Math.max(0, remaining);
  const h = Math.floor(r / 3600000);
  const m = Math.floor((r % 3600000) / 60000);
  const s = Math.floor((r % 60000) / 1000);
  const low = r < 15 * 60000; // เหลือน้อยกว่า 15 นาที — เตือนด้วยสี

  return (
    <span
      className={`border px-3 py-1.5 font-mono text-base font-bold tabular-nums md:text-lg ${
        low ? "animate-pulse border-maroon bg-maroon text-paper" : "border-ink/50 bg-white text-ink"
      }`}
      title="เวลาที่เหลือ"
    >
      {h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

/* ---------- ป้ายสถานะบันทึกอัตโนมัติ ---------- */
function SaveBadge({ savedAt }: { savedAt: Date | null }) {
  if (!savedAt) return <span className="font-label text-[11px] text-ink/40">บันทึกอัตโนมัติ</span>;
  const hh = String(savedAt.getHours()).padStart(2, "0");
  const mm = String(savedAt.getMinutes()).padStart(2, "0");
  const ss = String(savedAt.getSeconds()).padStart(2, "0");
  return (
    <span className="font-label text-[11px] text-ink/50">
      ✓ บันทึกแล้ว {hh}:{mm}:{ss}
    </span>
  );
}

/* ---------- กระดาษคำตอบ 70 ข้อ × 5 ช้อยส์ (ใช้ทั้งแผงข้างและลิ้นชักมือถือ) ---------- */
function AnswerSheet({
  answers,
  onPick,
  onJump,
}: {
  answers: number[];
  onPick: (no: number, choice: number) => void;
  onJump: (no: number) => void;
}) {
  return (
    <div className="space-y-4">
      {EXAM.sections.map((sec) => (
        <div key={sec.no}>
          <p className="mb-1.5 font-label text-[11px] font-semibold text-maroon">
            ตอนที่ {sec.no} · ข้อ {sec.from}–{sec.to}
          </p>
          <div className="space-y-1">
            {Array.from({ length: sec.to - sec.from + 1 }, (_, i) => sec.from + i).map((no) => (
              <div key={no} className="flex items-center gap-1.5">
                <button
                  onClick={() => onJump(no)}
                  title={`ไปที่โจทย์ข้อ ${no}`}
                  className={`w-8 shrink-0 border py-1 text-center font-mono text-xs font-bold transition ${
                    answers[no - 1] > 0
                      ? "border-maroon bg-maroon/10 text-maroon"
                      : "border-ink/25 text-ink/60 hover:border-maroon hover:text-maroon"
                  }`}
                >
                  {no}
                </button>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((c) => (
                    <button
                      key={c}
                      onClick={() => onPick(no, c)}
                      aria-label={`ข้อ ${no} ตอบ ${c}`}
                      aria-pressed={answers[no - 1] === c}
                      className={`grid h-8 w-8 place-items-center rounded-full border text-[13px] font-semibold transition ${
                        answers[no - 1] === c
                          ? "border-maroon bg-maroon text-paper"
                          : "border-ink/30 bg-white text-ink/60 hover:border-maroon hover:text-maroon"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- กล่อง modal กลาง ---------- */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-ink/55" onClick={onClose} />
      <div className="relative w-full max-w-md border border-ink bg-paper p-6 shadow-[0_25px_60px_-20px_rgba(14,26,43,0.6)]">
        {children}
      </div>
    </div>
  );
}
