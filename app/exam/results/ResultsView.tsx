"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatExpiry } from "@/lib/format-expiry";
import { DEFAULT_EXAM_ID } from "@/lib/exams";

/**
 * หน้าผลสอบ + บทวิเคราะห์ละเอียด
 *   1) คะแนนของคุณ (สเกล 300) + อันดับเทียบผู้สอบทุกคน
 *   2) สถิติภาพรวม: ค่าเฉลี่ย / SD / สูงสุด / ต่ำสุด + กราฟการแจกแจงคะแนน
 *   3) สรุปรายตอน (บท) 5 ตอน
 *   4) วิเคราะห์รายข้อทั้ง 70 ข้อ: บท · คำตอบ · ถูก/ผิด · ความยาก · %คนตอบถูก · คำแนะนำ (6 แบบ)
 *   5) ไฟล์โจทย์ + เฉลยแนบท้าย (ลายน้ำชื่อผู้ซื้อ ตามระบบดาวน์โหลดเดิม)
 */

interface ResultsData {
  examId: string;
  examTitle: string;
  student: { firstName: string; lastName: string; email: string; submittedAt: string };
  score: {
    correctCount: number;
    totalQuestions: number;
    scaled: number;
    maxScore: number;
    answered: number;
  };
  overall: {
    nTotal: number;
    rank: number;
    mean: number;
    sd: number;
    min: number;
    max: number;
    histogram: { from: number; to: number; count: number; mine: boolean }[];
  };
  sections: { no: number; title: string; from: number; to: number; total: number; correct: number }[];
  questions: {
    no: number;
    section: number;
    myAnswer: number;
    correctAnswer: number;
    correct: boolean;
    difficultyLabel: string;
    pctCorrect: number;
    advice: string;
  }[];
  downloads: { label: string; downloadName: string; url: string }[];
  downloadExpiryHours: number; // 0 = ไม่มีวันหมดอายุ
}

// โทเค็นใน localStorage แยกต่อสนาม — สนามหลัก (TPAT3) ใช้ key เดิมของลูกค้าเก่า
const lsTokenKey = (examId: string | null) =>
  !examId || examId === DEFAULT_EXAM_ID ? "exam.token" : `exam.token.${examId}`;

export default function ResultsView() {
  const params = useSearchParams();
  const [data, setData] = useState<ResultsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let token = params.get("token") ?? "";
    if (!token) {
      try {
        token = localStorage.getItem(lsTokenKey(params.get("exam"))) ?? "";
      } catch {}
    }
    if (!token) {
      setError("ไม่พบสิทธิ์ดูผลสอบ — เข้าห้องสอบด้วยอีเมลที่ซื้อก่อน");
      return;
    }
    fetch(`/api/exam/results?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "โหลดผลสอบไม่สำเร็จ");
        setData(d as ResultsData);
      })
      .catch((e: Error) => setError(e.message));
    // ตั้งใจให้รันครั้งเดียวตอนเปิดหน้า
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md border border-ink bg-paper px-8 py-10 text-center">
          <p className="text-ink/75">{error}</p>
          <a
            href="/exam"
            className="mt-6 inline-block bg-maroon px-6 py-3 font-bold text-paper transition hover:bg-maroon-dark"
          >
            ไปหน้าเข้าห้องสอบ
          </a>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="grid-paper flex min-h-screen items-center justify-center">
        <p className="text-ink/60">กำลังตรวจและวิเคราะห์ผล…</p>
      </main>
    );
  }

  const { score, overall, student } = data;
  const pctBeat = Math.round(((overall.nTotal - overall.rank) / Math.max(1, overall.nTotal - 1)) * 100);
  const submitDate = new Date(student.submittedAt).toLocaleString("th-TH", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-lg font-bold text-ink">Mr.tpat3</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
              ผลสอบ {data.examTitle || "Mock TPAT3"}
            </span>
          </div>
          <a href="/" className="text-sm font-semibold text-maroon hover:underline">
            หน้าหลัก →
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        {/* ===== การ์ดคะแนน ===== */}
        <section className="grid-paper border border-ink bg-white">
          <div className="grid md:grid-cols-[1.2fr_1fr]">
            <div className="border-b border-ink p-8 md:border-b-0 md:border-r">
              <p className="eyebrow">คะแนนของคุณ</p>
              <p className="mt-3 font-display text-[3.6rem] font-bold leading-none text-maroon">
                {score.scaled.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-2xl text-ink/45"> / {score.maxScore}</span>
              </p>
              <p className="mt-3 text-ink/75">
                ตอบถูก <strong className="text-ink">{score.correctCount}</strong> จาก{" "}
                {score.totalQuestions} ข้อ (ตอบไป {score.answered} ข้อ)
              </p>
              <p className="mt-4 font-label text-xs text-ink/50">
                {student.firstName} {student.lastName} · ส่งเมื่อ {submitDate}
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 p-8">
              <p className="eyebrow">อันดับของคุณ</p>
              <p className="font-display text-4xl font-bold text-ink">
                {overall.rank.toLocaleString()}
                <span className="text-lg font-semibold text-ink/50">
                  {" "}
                  / {overall.nTotal.toLocaleString()} คน
                </span>
              </p>
              <p className="text-sm leading-relaxed text-ink/65">
                ทำคะแนนได้ดีกว่าผู้สอบราว <strong className="text-maroon">{pctBeat}%</strong> ของทั้งหมด
              </p>
            </div>
          </div>
        </section>

        {/* ===== สถิติภาพรวม ===== */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-ink">ภาพรวมผู้สอบทุกคน</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="ค่าเฉลี่ย (Mean)" value={overall.mean} />
            <StatTile label="ส่วนเบี่ยงเบน (SD)" value={overall.sd} />
            <StatTile label="สูงสุด" value={overall.max} />
            <StatTile label="ต่ำสุด" value={overall.min} />
          </div>

          <div className="mt-5 border border-grid bg-white p-5 md:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-ink">การแจกแจงคะแนนผู้สอบทั้งหมด</h3>
              <span className="font-label text-xs text-ink/50">
                ผู้สอบ {overall.nTotal.toLocaleString()} คน · คะแนนเต็ม {score.maxScore}
              </span>
            </div>
            <ScoreHistogram bins={overall.histogram} myScore={score.scaled} maxScore={score.maxScore} />
            <p className="mt-2 font-label text-xs text-ink/50">
              แท่งสีเข้ม = ช่วงคะแนนของคุณ · เส้นแนวตั้ง = ตำแหน่งคะแนนคุณ ({score.scaled.toFixed(2)})
            </p>
          </div>
        </section>

        {/* ===== สรุปรายตอน ===== */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-ink">คะแนนรายตอน</h2>
          <div className="mt-5 space-y-2.5">
            {data.sections.map((s) => {
              const pct = Math.round((s.correct / s.total) * 100);
              return (
                <div key={s.no} className="border border-grid bg-white px-5 py-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[0.95rem] font-semibold text-ink">
                      ตอนที่ {s.no} · {s.title}
                      <span className="ml-2 font-label text-xs font-normal text-ink/45">
                        ข้อ {s.from}–{s.to}
                      </span>
                    </p>
                    <p className="font-display text-lg font-bold text-maroon">
                      {s.correct}/{s.total} ข้อ
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full bg-ink/[0.07]">
                    <div className="h-full bg-maroon" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== วิเคราะห์รายข้อ ===== */}
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold text-ink">วิเคราะห์รายข้อทั้ง 70 ข้อ</h2>
          <div className="mt-5 space-y-4">
            {data.sections.map((s) => (
              <QuestionTable
                key={s.no}
                section={s}
                questions={data.questions.filter((q) => q.section === s.no)}
              />
            ))}
          </div>
        </section>

        {/* ===== ไฟล์แนบท้าย ===== */}
        <section className="mt-10 border-2 border-maroon bg-white p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold text-ink">ไฟล์แนบท้ายผลสอบ</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">
            ดาวน์โหลด<strong>ไฟล์โจทย์</strong>และ<strong>ไฟล์เฉลยละเอียด</strong>ไว้ทบทวนคู่กับผลวิเคราะห์ด้านบน
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.downloads.map((d) => (
              <a
                key={d.url}
                href={d.url}
                download={d.downloadName}
                className="flex items-center justify-between gap-3 border border-ink bg-maroon px-5 py-3.5 font-semibold text-paper transition hover:bg-maroon-dark"
              >
                <span className="text-left text-[0.95rem] leading-snug">{d.label}</span>
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" />
                </svg>
              </a>
            ))}
          </div>
          <p className="mt-3 font-label text-[12px] text-ink/50">
            ระบบเตรียมไฟล์ตอนกดดาวน์โหลด อาจใช้เวลา 2–3 วินาทีต่อไฟล์ ·{" "}
            {formatExpiry(data.downloadExpiryHours)
              ? `ลิงก์ใช้ได้อีก ${formatExpiry(data.downloadExpiryHours)}`
              : "ลิงก์ไม่มีวันหมดอายุ"}
          </p>
        </section>

        <p className="mt-10 text-center font-label text-sm text-ink/50 print:hidden">
          มีข้อสงสัยเกี่ยวกับผลสอบ? ติดต่อ{" "}
          <a href="mailto:mr.tpat3@gmail.com" className="font-medium text-maroon underline-offset-2 hover:underline">
            mr.tpat3@gmail.com
          </a>
        </p>
      </main>
    </div>
  );
}

/* ---------- กล่องสถิติหนึ่งค่า ---------- */
function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-grid bg-white p-4">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/50">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-bold text-ink">
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

/* ---------- กราฟการแจกแจงคะแนน (แท่งช่วงละ 10 คะแนน เต็ม 100) ----------
   สีตามธีมร้าน ผ่านตัวตรวจ dataviz แล้ว: แท่งทั่วไป #A8727B (≥3:1 บนพื้นขาว)
   แท่งช่วงของผู้สอบ #6E1423 + เส้น marker สีหมึก — ระบุตำแหน่ง "คุณอยู่ตรงนี้" */
function ScoreHistogram({
  bins,
  myScore,
  maxScore,
}: {
  bins: { from: number; to: number; count: number; mine: boolean }[];
  myScore: number;
  maxScore: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 300;
  const m = { top: 34, right: 14, bottom: 46, left: 52 };
  const plotW = W - m.left - m.right;
  const plotH = H - m.top - m.bottom;

  const total = useMemo(() => bins.reduce((s, b) => s + b.count, 0), [bins]);
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  // เพดานแกน y แบบเลขกลม ๆ 4 ขั้น
  const step = Math.max(1, Math.ceil(maxCount / 4 / 5) * 5);
  const yMax = step * 4;
  const y = (v: number) => m.top + plotH - (v / yMax) * plotH;
  const barW = plotW / bins.length;

  const markerX = m.left + (Math.min(maxScore, Math.max(0, myScore)) / maxScore) * plotW;
  const markerFlip = markerX > W - 130; // ป้ายชนขอบขวา — พลิกไปฝั่งซ้ายของเส้น

  return (
    <div className="relative mt-4 overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="min-w-[480px]"
        role="img"
        aria-label={`กราฟแท่งการแจกแจงคะแนนผู้สอบ ${total.toLocaleString()} คน คะแนนของคุณ ${myScore.toFixed(2)} จาก ${maxScore}`}
      >
        {/* เส้นตาราง + ตัวเลขแกน y */}
        {Array.from({ length: 5 }, (_, i) => i * step).map((v) => (
          <g key={v}>
            <line x1={m.left} x2={W - m.right} y1={y(v)} y2={y(v)} stroke="#241016" strokeOpacity={v === 0 ? 0.35 : 0.08} strokeWidth={1} />
            <text x={m.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#241016" fillOpacity={0.55}>
              {v.toLocaleString()}
            </text>
          </g>
        ))}
        {/* ชื่อแกน */}
        <text x={m.left - 40} y={m.top - 14} fontSize={11} fill="#241016" fillOpacity={0.6}>
          จำนวนผู้สอบ (คน)
        </text>
        <text x={W - m.right} y={H - 8} textAnchor="end" fontSize={11} fill="#241016" fillOpacity={0.6}>
          คะแนน (เต็ม {maxScore})
        </text>

        {/* แท่ง — เว้นช่อง 2px ปลายบนมน (clip ให้ฐานคม) */}
        <defs>
          <clipPath id="plot-area">
            <rect x={m.left} y={m.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>
        <g clipPath="url(#plot-area)">
          {bins.map((b, i) => {
            const bx = m.left + i * barW + 1;
            const by = y(b.count);
            return (
              <rect
                key={b.from}
                x={bx}
                y={by}
                width={barW - 2}
                height={m.top + plotH - by + 4}
                rx={4}
                fill={b.mine ? "#6E1423" : "#A8727B"}
                opacity={hover === null || hover === i ? 1 : 0.55}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${b.from}–${b.to} คะแนน · ${b.count.toLocaleString()} คน`}</title>
              </rect>
            );
          })}
        </g>

        {/* ป้ายเลขขอบช่วงบนแกน x */}
        {bins.map((b, i) => (
          <text
            key={b.from}
            x={m.left + i * barW}
            y={m.top + plotH + 16}
            textAnchor="middle"
            fontSize={10.5}
            fill="#241016"
            fillOpacity={0.55}
          >
            {b.from}
          </text>
        ))}
        <text x={m.left + plotW} y={m.top + plotH + 16} textAnchor="middle" fontSize={10.5} fill="#241016" fillOpacity={0.55}>
          {maxScore}
        </text>

        {/* เส้น marker ตำแหน่งคะแนนของคุณ */}
        <line x1={markerX} x2={markerX} y1={m.top - 4} y2={m.top + plotH} stroke="#241016" strokeWidth={2} />
        <g transform={`translate(${markerFlip ? markerX - 8 : markerX + 8}, ${m.top + 2})`}>
          <text
            textAnchor={markerFlip ? "end" : "start"}
            fontSize={12}
            fontWeight={700}
            fill="#241016"
          >
            คุณ · {myScore.toFixed(2)}
          </text>
        </g>
      </svg>

      {/* tooltip ลอยตามแท่งที่ชี้ */}
      {hover !== null && bins[hover] && (
        <div
          className="pointer-events-none absolute -top-1 border border-ink bg-ink px-3 py-1.5 font-label text-xs text-paper"
          style={{
            left: `${((m.left + hover * barW + barW / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          {bins[hover].from}–{bins[hover].to} คะแนน · {bins[hover].count.toLocaleString()} คน (
          {total ? Math.round((bins[hover].count * 100) / total) : 0}%)
        </div>
      )}
    </div>
  );
}

/* ---------- ตารางวิเคราะห์รายข้อของหนึ่งตอน ---------- */
function QuestionTable({
  section,
  questions,
}: {
  section: { no: number; title: string; from: number; to: number; total: number; correct: number };
  questions: ResultsData["questions"];
}) {
  return (
    <details className="border border-grid bg-white" open={section.no === 1}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 marker:content-none">
        <span className="font-semibold text-ink">
          ตอนที่ {section.no} · {section.title}
        </span>
        <span className="font-display text-sm font-bold text-maroon">
          ถูก {section.correct}/{section.total} ข้อ
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-grid">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-grid bg-paper text-left font-label text-[11px] uppercase tracking-wide text-ink/55">
              <th className="px-3 py-2.5 text-center">ข้อ</th>
              <th className="px-3 py-2.5 text-center">คุณตอบ</th>
              <th className="px-3 py-2.5 text-center">เฉลย</th>
              <th className="px-3 py-2.5 text-center">ผล</th>
              <th className="px-3 py-2.5 text-center">ระดับ</th>
              <th className="px-3 py-2.5 text-center">% ตอบถูก</th>
              <th className="px-3 py-2.5">คำแนะนำ</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.no} className="border-b border-dashed border-grid align-top">
                <td className="px-3 py-2.5 text-center font-mono font-bold text-ink">{q.no}</td>
                <td className="px-3 py-2.5 text-center font-mono">
                  {q.myAnswer > 0 ? q.myAnswer : <span className="text-ink/35">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center font-mono font-semibold text-ink">
                  {q.correctAnswer}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {q.correct ? (
                    <span className="inline-block border border-[#1E6E42]/40 bg-[#1E6E42]/10 px-2 py-0.5 font-label text-[11px] font-bold text-[#1E6E42]">
                      ✓ ถูก
                    </span>
                  ) : q.myAnswer > 0 ? (
                    <span className="inline-block border border-maroon/40 bg-maroon/10 px-2 py-0.5 font-label text-[11px] font-bold text-maroon">
                      ✗ ผิด
                    </span>
                  ) : (
                    <span className="inline-block border border-ink/25 bg-ink/[0.05] px-2 py-0.5 font-label text-[11px] font-bold text-ink/50">
                      ไม่ได้ตอบ
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-ink/75">{q.difficultyLabel}</td>
                <td className="px-3 py-2.5 text-center tabular-nums text-ink/75">
                  {q.pctCorrect.toFixed(1)}%
                </td>
                <td className="min-w-[260px] px-3 py-2.5 leading-relaxed text-ink/75">{q.advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
