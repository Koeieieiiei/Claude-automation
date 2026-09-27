"use client";

import { useCallback, useEffect, useState } from "react";
import type { SalesSummary } from "@/lib/admin-stats";
import type { FinanceSummary } from "@/lib/finance";
import type { GaSummary } from "@/lib/ga";

interface ExamStat {
  id: string;
  title: string;
  attempts: number;
  avgScore: number;
  maxScore: number;
}

interface StatsPayload {
  sales: SalesSummary;
  finance: FinanceSummary;
  exams: ExamStat[];
  ga: GaSummary | null;
  meta: {
    gaConfigured: boolean;
    productColumnReady: boolean;
    ledgerReady: boolean;
    orderCount: number;
    /** จุดเริ่มนับของทุกตัวเลขบนหน้านี้ (lib/admin-reset.ts) — null = นับตั้งแต่เปิดร้าน */
    since: string | null;
    /** ตัวเลขฝั่ง Stripe ไว้กระทบยอด (null = ดึงไม่ได้) */
    stripe: { gross: number; net: number; saleCount: number } | null;
    categories: { expense: string[]; income: string[] };
  };
}

/* ================= ตัวช่วยจัดรูปแบบ ================= */

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const num = (n: number) => n.toLocaleString("th-TH");
const pct = (n: number) => `${n.toLocaleString("th-TH", { maximumFractionDigits: 1 })}%`;

const TH_DATE: Intl.DateTimeFormatOptions = { timeZone: "Asia/Bangkok" };

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    ...TH_DATE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const dateOnly = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { ...TH_DATE, day: "numeric", month: "short" });

/** "2026-07-26" → "26 ก.ค." (คีย์วันเป็นเวลาไทยอยู่แล้ว จึงต่อ T00:00 ตรง ๆ ไม่ได้ ต้องบวก timezone) */
const dayLabel = (ymd: string) =>
  new Date(`${ymd}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    ...TH_DATE,
    day: "numeric",
    month: "short",
  });

/* ================= ชิ้นส่วน UI เล็ก ๆ ================= */

/**
 * surface = สี "พื้น + เส้นขอบ" ของการ์ด แยกออกมาเป็น prop ต่างหาก
 * (ถ้าปล่อยให้ส่ง bg-* มาทาง className จะชนกับ bg-white ที่ตั้งไว้ แล้วแพ้/ชนะ
 *  ตามลำดับใน CSS ไม่ใช่ลำดับที่เขียน — เคยทำการ์ด "วันนี้" กลายเป็นช่องว่างมาแล้ว)
 */
function Card({
  children,
  className = "",
  surface = "border-grid bg-white",
}: {
  children: React.ReactNode;
  className?: string;
  surface?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${surface} ${className}`}>{children}</div>
  );
}

/** หัวข้อแบบพับเก็บได้ — เริ่มต้นพับไว้ กดที่หัวข้อเพื่อกาง (เจ้าของขอ 2026-07-26) */
function FoldSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg font-bold">
          <span
            className={`mr-2 inline-block text-sm text-maroon transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          {title}
        </h2>
        {hint && <p className="text-xs text-ink/50">{hint}</p>}
        <span className="ml-auto text-xs text-ink/40">{open ? "ซ่อน" : "กดเพื่อดู"}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card surface={accent ? "border-maroon bg-maroon text-white" : undefined}>
      <p className={`text-xs font-semibold ${accent ? "text-white/70" : "text-ink/50"}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${accent ? "text-white/70" : "text-ink/50"}`}>{sub}</p>}
    </Card>
  );
}

/** แถบสัดส่วนแนวนอน */
function Meter({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-paper ${className}`}>
      <div
        className="h-full rounded-full bg-maroon transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** กราฟแท่งแนวตั้ง */
function Bars({
  data,
  height = "h-32",
}: {
  data: { label: string; value: number; title: string }[];
  height?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    // แต่ละแท่งต้อง h-full ไม่งั้นความสูงเป็น % ของ "ศูนย์" แล้วกราฟหายทั้งอัน
    <div className={`flex items-end gap-[3px] ${height}`}>
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end">
          <div
            className="w-full rounded-t bg-maroon/80 transition-all group-hover:bg-maroon"
            style={{ height: `${Math.max((d.value / max) * 92, d.value > 0 ? 4 : 1)}%` }}
            title={d.title}
          />
          <span className="mt-1 hidden text-[9px] leading-none text-ink/40 sm:block">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    delivered: { text: "ส่งไฟล์แล้ว", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    paid: { text: "จ่ายแล้ว", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    pending: { text: "ยังไม่จ่าย", cls: "bg-paper text-ink/50 border-grid" },
  };
  const s = map[status] ?? { text: status, cls: "bg-paper text-ink/50 border-grid" };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${s.cls}`}>
      {s.text}
    </span>
  );
}

/* ================= อัตราส่วนสำคัญ (Conversion Ratios) ================= */

function RatioCard({
  title,
  numerator,
  denominator,
  numLabel,
  denLabel,
  hint,
}: {
  title: string;
  numerator: number;
  denominator: number;
  numLabel: string;
  denLabel: string;
  hint?: string;
}) {
  const ok = denominator > 0;
  const ratio = ok ? (numerator / denominator) * 100 : 0;
  return (
    <Card>
      <p className="text-xs font-semibold text-ink/50">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{ok ? pct(ratio) : "—"}</p>
      <p className="mt-0.5 text-xs text-ink/50">
        {ok
          ? `${numLabel} ${num(numerator)} ÷ ${denLabel} ${num(denominator)}`
          : hint ?? `ยังไม่มีข้อมูล${denLabel}`}
      </p>
      {ok && <Meter value={Math.min(ratio, 100)} className="mt-2 h-1.5" />}
    </Card>
  );
}

/**
 * อัตราส่วนการเปลี่ยนผู้เข้าชมเป็นลูกค้า (เจ้าของขอ 2026-07-26)
 *
 * ทุกตัวเลขมาจาก GA ทั้งเศษและส่วน — ห้ามผสมยอดซื้อจากตาราง orders เพราะ GA
 * เพิ่งเริ่มเก็บ 26 ก.ค. กรอบเวลาไม่ตรงกัน (เคยได้ 400% หลอกตามาแล้ว)
 * จำนวน "ซื้อ" จึงนับจากอีเวนต์ purchase_success ที่ยิงตอนถึงหน้าชำระเงินสำเร็จ
 */
function RatioCards({ ga }: { ga: GaSummary }) {
  const count = (event: string) => ga.events.find((e) => e.event === event)?.count ?? 0;
  const buys = count("purchase_success");
  const demo = count("download_sample");
  return (
    <>
      <RatioCard
        title="คนเข้าเว็บ → ซื้อ"
        numerator={buys}
        denominator={ga.activeUsers}
        numLabel="ซื้อสำเร็จ"
        denLabel="ผู้เข้าชม"
      />
      <RatioCard
        title="คนเข้าเว็บ → โหลดเดโม"
        numerator={demo}
        denominator={ga.activeUsers}
        numLabel="โหลดเดโม"
        denLabel="ผู้เข้าชม"
      />
      <RatioCard
        title="โหลดเดโม → ซื้อ"
        numerator={buys}
        denominator={demo}
        numLabel="ซื้อ"
        denLabel="คนโหลดเดโม"
      />
      <RatioCard
        title="เปิดฟอร์ม → จ่ายจริง"
        numerator={buys}
        denominator={count("open_buy_form")}
        numLabel="จ่ายสำเร็จ"
        denLabel="เปิดฟอร์ม"
      />
    </>
  );
}

/* ================= บัญชีรายรับรายจ่าย ================= */

/** วันนี้ตามเวลาไทยในรูปแบบ YYYY-MM-DD (ค่าเริ่มต้นของช่องวันที่) */
const todayBkk = () => new Date().toLocaleDateString("en-CA", TH_DATE);

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00+07:00`).toLocaleDateString("th-TH", {
    ...TH_DATE,
    month: "long",
    year: "numeric",
  });

function LedgerForm({
  categories,
  onSaved,
}: {
  categories: { expense: string[]; income: string[] };
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(categories.expense[0] ?? "อื่น ๆ");
  const [customCategory, setCustomCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayBkk());
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const list = kind === "expense" ? categories.expense : categories.income;

  function switchKind(next: "expense" | "income") {
    setKind(next);
    setCategory((next === "expense" ? categories.expense : categories.income)[0] ?? "อื่น ๆ");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setMsg("กรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurredOn,
          kind,
          category: category === "อื่น ๆ" && customCategory.trim() ? customCategory.trim() : category,
          note,
          amount: value,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setAmount("");
      setNote("");
      setCustomCategory("");
      setMsg("บันทึกแล้ว");
      onSaved();
    } catch {
      setMsg("เชื่อมต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-grid bg-paper px-3 py-2 text-sm outline-none focus:border-maroon";

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-1">
        <label className="text-xs text-ink/50">ประเภท</label>
        <select
          value={kind}
          onChange={(e) => switchKind(e.target.value as "expense" | "income")}
          className={field}
        >
          <option value="expense">รายจ่าย</option>
          <option value="income">รายรับ (นอกเว็บ)</option>
        </select>
      </div>
      <div className="lg:col-span-1">
        <label className="text-xs text-ink/50">วันที่</label>
        <input
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className={field}
        />
      </div>
      <div className="lg:col-span-1">
        <label className="text-xs text-ink/50">หมวด</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
          {list.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-1">
        <label className="text-xs text-ink/50">
          {category === "อื่น ๆ" ? "ตั้งชื่อหมวดเอง" : "รายละเอียด"}
        </label>
        {category === "อื่น ๆ" ? (
          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="เช่น ค่าพิมพ์เอกสาร"
            className={field}
          />
        ) : (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ไม่ใส่ก็ได้"
            className={field}
          />
        )}
      </div>
      <div className="lg:col-span-1">
        <label className="text-xs text-ink/50">จำนวนเงิน (บาท)</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={field}
        />
      </div>
      <div className="flex items-end gap-2 lg:col-span-1">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-dark disabled:opacity-50"
        >
          {busy ? "กำลังบันทึก…" : "เพิ่มรายการ"}
        </button>
      </div>
      {msg && <p className="text-xs text-maroon sm:col-span-2 lg:col-span-6">{msg}</p>}
    </form>
  );
}

function FinanceBlock({
  f,
  meta,
  onChanged,
}: {
  f: FinanceSummary;
  meta: StatsPayload["meta"];
  onChanged: () => void;
}) {
  async function remove(id: string, label: string) {
    if (!window.confirm(`ลบรายการ "${label}" ออกจากบัญชี?`)) return;
    await fetch(`/api/admin/ledger?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    onChanged();
  }

  const stripeDiff = meta.stripe ? meta.stripe.gross - f.income.shop : 0;

  return (
    <div className="space-y-4">
      {!meta.ledgerReady && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยังสร้างตารางบัญชีไม่ได้ — รันไฟล์ <code>supabase/migration-admin.sql</code> ใน Supabase ก่อน
          จึงจะบันทึกรายจ่ายได้ (ตัวเลขรายรับกับค่าธรรมเนียมด้านล่างยังถูกต้องอยู่)
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="รายรับรวม"
          value={baht(f.income.total)}
          sub={`ขายได้ ${num(f.income.shopUnits)} ชุด${
            f.income.manual > 0 ? ` + นอกเว็บ ${baht(f.income.manual)}` : ""
          }`}
        />
        <Kpi
          label="รายจ่ายรวม"
          value={baht(f.expense.total)}
          sub={`ค่าธรรมเนียม Stripe ${baht(f.expense.stripeFees)}`}
        />
        <Kpi label="กำไรสุทธิ" value={baht(f.profit)} sub={`อัตรากำไร ${pct(f.margin)}`} accent />
        <Kpi label="กำไรต่อ 1 ชุด" value={baht(f.profitPerUnit)} />
      </div>

      {/* กระทบยอดกับ Stripe — สองฝั่งควรตรงกัน ถ้าต่างกันมาก = มีออเดอร์ที่สถานะในเว็บไม่ตรงกับเงินที่เข้าจริง */}
      <p className="text-xs text-ink/50">
        {meta.stripe ? (
          <>
            Stripe รับจริง {baht(meta.stripe.gross)} ({num(meta.stripe.saleCount)} รายการ) ต่างจากยอดในเว็บ{" "}
            <span
              className={`font-semibold ${Math.abs(stripeDiff) > 1 ? "text-maroon" : "text-emerald-700"}`}
            >
              {baht(stripeDiff)}
            </span>
          </>
        ) : (
          "ยังดึงข้อมูลจาก Stripe ไม่ได้ รายจ่ายจึงยังไม่รวมค่าธรรมเนียม"
        )}
      </p>

      <Card>
        <p className="mb-3 text-sm font-semibold">บันทึกรายการใหม่</p>
        <LedgerForm categories={meta.categories} onSaved={onChanged} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold">กำไรรายเดือน</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink/50">
                  <th className="pb-2 font-medium">เดือน</th>
                  <th className="pb-2 text-right font-medium">รายรับ</th>
                  <th className="pb-2 text-right font-medium">รายจ่าย</th>
                  <th className="pb-2 text-right font-medium">กำไร</th>
                </tr>
              </thead>
              <tbody>
                {f.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-grid/60 last:border-0">
                    <td className="py-2">{monthLabel(m.month)}</td>
                    <td className="py-2 text-right tabular-nums">{baht(m.income)}</td>
                    <td className="py-2 text-right tabular-nums text-ink/60">{baht(m.expense)}</td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        m.profit < 0 ? "text-maroon" : ""
                      }`}
                    >
                      {baht(m.profit)}
                    </td>
                  </tr>
                ))}
                {!f.monthly.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-ink/40">
                      ยังไม่มีข้อมูลในช่วงที่นับ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <p className="mb-2 text-sm font-semibold">รายการที่บันทึกเอง</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-grid text-left text-xs text-ink/50">
                  <th className="pb-2 font-medium">วันที่</th>
                  <th className="pb-2 font-medium">หมวด</th>
                  <th className="pb-2 text-right font-medium">จำนวน</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {f.entries.map((e) => (
                  <tr key={e.id} className="border-b border-grid/60 last:border-0">
                    <td className="whitespace-nowrap py-2 pr-2 text-ink/60">
                      {dateOnly(`${e.occurred_on}T00:00:00+07:00`)}
                    </td>
                    <td className="py-2 pr-2">
                      {e.category}
                      {e.note && <span className="block text-xs text-ink/40">{e.note}</span>}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${
                        e.kind === "income" ? "text-emerald-700" : ""
                      }`}
                    >
                      {e.kind === "income" ? "+" : "−"}
                      {baht(e.amount)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <button
                        onClick={() => remove(e.id, `${e.category} ${baht(e.amount)}`)}
                        className="text-xs text-ink/40 hover:text-maroon"
                        title="ลบรายการนี้"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                {!f.entries.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-ink/40">
                      ยังไม่มีรายการที่บันทึกเอง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= ส่วน Google Analytics ================= */

function GaBlock({ ga, configured }: { ga: GaSummary | null; configured: boolean }) {
  if (!ga) {
    return (
      <Card>
        <p className="text-sm font-semibold">
          {configured ? "เชื่อม Google Analytics แล้ว แต่ดึงข้อมูลไม่สำเร็จ" : "ยังไม่ได้เชื่อม Google Analytics"}
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-ink/70">
          <li>เปิด Google Cloud Console → สร้าง Service Account → ดาวน์โหลดคีย์ JSON</li>
          <li>
            เปิดใช้งาน <b>Google Analytics Data API</b> ในโปรเจกต์นั้น
          </li>
          <li>
            ใน GA4 → Admin → Property access management → เพิ่มอีเมล service account เป็น <b>Viewer</b>
          </li>
          <li>
            ใส่ค่า <code className="rounded bg-paper px-1">GA4_PROPERTY_ID</code> (ตัวเลขล้วน),{" "}
            <code className="rounded bg-paper px-1">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{" "}
            <code className="rounded bg-paper px-1">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> ใน Vercel แล้ว deploy ใหม่
          </li>
        </ol>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="ผู้เข้าชม" value={num(ga.activeUsers)} sub={`ใหม่ ${num(ga.newUsers)} คน`} />
        <Kpi
          label="เวลาอยู่บนเว็บเฉลี่ย"
          value={`${Math.floor(ga.avgEngagementSec / 60)}:${String(ga.avgEngagementSec % 60).padStart(2, "0")}`}
          sub="นาที : วินาที ต่อเซสชัน"
        />
        <RatioCards ga={ga} />
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold">ผู้เข้าชมรายวัน</p>
        <Bars
          data={ga.daily.map((d) => ({
            label: dayLabel(d.date).split(" ")[0],
            value: d.users,
            title: `${dayLabel(d.date)} ${num(d.users)} คน`,
          }))}
          height="h-24"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="mb-2 text-sm font-semibold">คนมาจากไหน</p>
          <RankList rows={ga.sources.map((c) => ({ label: c.label, value: c.users }))} unit="คน" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">หน้าที่มีคนเข้ามากสุด</p>
          <RankList rows={ga.pages.map((c) => ({ label: c.label, value: c.views }))} unit="ครั้ง" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">กรวยการขาย</p>
          <RankList
            rows={ga.events.map((e) => ({ label: e.label, value: e.count }))}
            unit="ครั้ง"
            keepOrder
          />
        </Card>
      </div>
    </div>
  );
}

function RankList({
  rows,
  unit,
  keepOrder,
}: {
  rows: { label: string; value: number }[];
  unit: string;
  keepOrder?: boolean;
}) {
  const sorted = keepOrder ? rows : [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((r) => r.value), 1);
  if (!sorted.length) return <p className="text-sm text-ink/40">ยังไม่มีข้อมูล</p>;
  return (
    <ul className="space-y-2">
      {sorted.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink/70">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {num(r.value)} <span className="text-xs font-normal text-ink/40">{unit}</span>
            </span>
          </div>
          <Meter value={(r.value / max) * 100} className="mt-1 h-1.5" />
        </li>
      ))}
    </ul>
  );
}

/* ================= หน้าหลัก ================= */

export default function AdminDashboard() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (res.status === 401) {
        window.location.reload(); // คุกกี้หมดอายุ → กลับไปหน้าล็อกอิน
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as StatsPayload);
      setUpdatedAt(new Date());
      setError("");
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ กำลังลองใหม่อัตโนมัติ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    // กลับมาเปิดแท็บอีกครั้ง = ดึงข้อมูลใหม่ทันที ไม่ต้องรอครบ 30 วิ
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  if (loading && !data) {
    return (
      <main className="grid min-h-screen place-items-center grid-paper">
        <p className="text-sm text-ink/50">กำลังโหลดยอดขาย…</p>
      </main>
    );
  }

  const s = data?.sales;
  const ga = data?.ga ?? null;
  const gaBuys = ga?.events.find((e) => e.event === "purchase_success")?.count ?? 0;
  const exams = data?.exams ?? [];
  const examAttempts = exams.reduce((n, e) => n + e.attempts, 0);

  return (
    <main className="min-h-screen grid-paper px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* หัวหน้า */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Mr.tpat3 หลังร้าน</p>
            <h1 className="text-2xl font-bold sm:text-3xl">สรุปยอดขาย</h1>
            <p className="mt-0.5 text-xs text-ink/50">
              {updatedAt
                ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString("th-TH", TH_DATE)} (รีเฟรชเองทุก 30 วินาที)`
                : "กำลังอัปเดต…"}
            </p>
            {data?.meta.since && (
              <p className="mt-0.5 text-xs text-ink/50">เริ่มนับใหม่ตั้งแต่ {dateTime(data.meta.since)} น.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="rounded-xl border border-grid bg-white px-3 py-2 text-sm font-medium hover:border-maroon"
            >
              รีเฟรชเดี๋ยวนี้
            </button>
            <button
              onClick={logout}
              className="rounded-xl border border-grid bg-white px-3 py-2 text-sm font-medium text-ink/60 hover:border-maroon"
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        {error && (
          <p className="mt-4 rounded-xl border border-maroon/30 bg-maroon/5 px-3 py-2 text-sm text-maroon">
            {error}
          </p>
        )}

        {data && !data.meta.productColumnReady && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ยังไม่ได้เพิ่มคอลัมน์ <code>product_id</code> ในตาราง orders — ตอนนี้ระบบ<b>เดาสินค้าจากราคา</b>ให้ก่อน
            (แม่นสำหรับราคาปัจจุบัน) รันไฟล์ <code>supabase/migration-admin.sql</code> ใน Supabase เพื่อให้แม่นยำ 100%
          </p>
        )}

        {data && s && (
          <>
            {/* ===== ตัวเลขหลัก (ร้านเหลือสินค้าขายตัวเดียว จึงไม่แจกแจงรายสินค้าแล้ว — เจ้าของสั่ง 2026-09-27) ===== */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="วันนี้" value={baht(s.totals.today.revenue)} sub={`${num(s.totals.today.units)} ชุด`} accent />
              <Kpi label="7 วันล่าสุด" value={baht(s.totals.d7.revenue)} sub={`${num(s.totals.d7.units)} ชุด`} />
              <Kpi label="30 วันล่าสุด" value={baht(s.totals.d30.revenue)} sub={`${num(s.totals.d30.units)} ชุด`} />
              <Kpi label="ทั้งหมด" value={baht(s.totals.all.revenue)} sub={`${num(s.totals.all.units)} ชุด`} />
              <Kpi
                label="กำไรสุทธิ"
                value={baht(data.finance.profit)}
                sub={`อัตรากำไร ${pct(data.finance.margin)}`}
              />
              <Kpi
                label="คนเข้าเว็บ → ซื้อ"
                value={ga && ga.activeUsers > 0 ? pct((gaBuys / ga.activeUsers) * 100) : "—"}
                sub={
                  ga
                    ? `ซื้อ ${num(gaBuys)} จากผู้เข้าชม ${num(ga.activeUsers)} คน`
                    : "ยังไม่มีข้อมูล Google Analytics"
                }
              />
              <Kpi
                label="รับเล่มเนื้อหาฟรี"
                value={`${num(s.freeClaims.all)} คน`}
                sub={`วันนี้ ${num(s.freeClaims.today)} คน`}
              />
              <Kpi
                label="ทำข้อสอบแล้ว"
                value={`${num(examAttempts)} คน`}
                sub={
                  exams.length === 1 && examAttempts > 0
                    ? `เฉลี่ย ${exams[0].avgScore} สูงสุด ${exams[0].maxScore}`
                    : undefined
                }
              />
            </div>

            <Card className="mt-3">
              <p className="mb-2 text-sm font-semibold">ยอดขายรายวัน (30 วันล่าสุด)</p>
              <Bars
                data={s.daily.map((d) => ({
                  label: dayLabel(d.date).split(" ")[0],
                  value: d.revenue,
                  title: `${dayLabel(d.date)} ${baht(d.revenue)} (${num(d.units)} ชุด)`,
                }))}
              />
            </Card>

            <FoldSection
              title="บัญชีรายรับรายจ่าย"
              hint={`นับตั้งแต่ ${dateOnly(`${data.finance.startDate}T00:00:00+07:00`)}`}
            >
              <FinanceBlock f={data.finance} meta={data.meta} onChanged={load} />
            </FoldSection>

            <FoldSection
              title="ออเดอร์ล่าสุด"
              hint={`กดสั่ง ${num(s.paidOrders + s.pendingOrders)} ครั้ง จ่ายจริง ${num(s.paidOrders)} ครั้ง (${pct(s.closeRate)})`}
            >
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-grid text-left text-xs text-ink/50">
                      <th className="pb-2 font-medium">เวลา</th>
                      <th className="pb-2 font-medium">ชื่อ</th>
                      <th className="pb-2 font-medium">อีเมล</th>
                      <th className="pb-2 font-medium">สินค้า</th>
                      <th className="pb-2 text-right font-medium">ยอด</th>
                      <th className="pb-2 text-right font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recent.map((o) => (
                      <tr key={o.id} className={`border-b border-grid/60 last:border-0 ${o.paid ? "" : "opacity-60"}`}>
                        <td className="whitespace-nowrap py-2 pr-3 text-ink/60">{dateTime(o.createdAt)}</td>
                        <td className="py-2 pr-3">{o.name}</td>
                        <td className="py-2 pr-3 text-ink/60">{o.email}</td>
                        <td className="py-2 pr-3">{o.productName}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {o.paid && o.amount === 0 ? "ฟรี" : baht(o.amount)}
                        </td>
                        <td className="py-2 text-right">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </FoldSection>

            <FoldSection
              title="ผู้เข้าชมเว็บ"
              hint={ga && ga.days < 30 ? "Google Analytics ตั้งแต่เริ่มนับใหม่" : "Google Analytics 30 วันล่าสุด"}
            >
              <GaBlock ga={ga} configured={data.meta.gaConfigured} />
            </FoldSection>

            <p className="mt-10 pb-6 text-center text-xs text-ink/40">
              ออเดอร์ทั้งหมด {num(data.meta.orderCount)} รายการ
            </p>
          </>
        )}
      </div>
    </main>
  );
}
