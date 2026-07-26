"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductStats, SalesSummary } from "@/lib/admin-stats";
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
  exams: ExamStat[];
  ga: GaSummary | null;
  meta: { gaConfigured: boolean; productColumnReady: boolean; orderCount: number };
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

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {hint && <p className="text-xs text-ink/50">{hint}</p>}
      </div>
      {children}
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

/** กราฟเส้นจิ๋ว 14 วัน */
function Spark({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke="#6E1423" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Trend({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-ink/40">ไม่มีรอบก่อนให้เทียบ</span>;
  const up = value >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-700" : "text-maroon"}`}>
      {up ? "▲" : "▼"} {pct(Math.abs(value))} เทียบ 7 วันก่อนหน้า
    </span>
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

/* ================= การ์ดสินค้าแต่ละตัว (หัวใจของหน้านี้) ================= */

function ProductCard({ p, rank }: { p: ProductStats; rank: number }) {
  const rows: { label: string; units: number; revenue: number }[] = [
    { label: "วันนี้", ...p.today },
    { label: "7 วันล่าสุด", ...p.d7 },
    { label: "30 วันล่าสุด", ...p.d30 },
    { label: "ทั้งหมด", units: p.units, revenue: p.revenue },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">อันดับ {rank}</p>
          <h3 className="mt-1 font-bold leading-6">{p.name}</h3>
          <p className="mt-0.5 text-xs text-ink/50">
            {p.price !== null ? `ราคาป้าย ${baht(p.price)}` : "ไม่ได้ขายแล้ว"}
            {p.avgPrice > 0 && p.avgPrice !== p.price && ` · ขายได้จริงเฉลี่ย ${baht(p.avgPrice)}/ชุด`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-maroon">{baht(p.revenue)}</p>
          <p className="text-xs text-ink/50">{num(p.units)} ชุด</p>
        </div>
      </div>

      {/* สัดส่วนของทั้งร้าน */}
      <div className="mt-4 space-y-2">
        <div>
          <div className="flex justify-between text-xs">
            <span className="text-ink/60">สัดส่วนรายได้ของร้าน</span>
            <span className="font-semibold tabular-nums">{pct(p.revenueShare)}</span>
          </div>
          <Meter value={p.revenueShare} className="mt-1" />
        </div>
        <div>
          <div className="flex justify-between text-xs">
            <span className="text-ink/60">สัดส่วนจำนวนชุดที่ขายได้</span>
            <span className="font-semibold tabular-nums">{pct(p.unitShare)}</span>
          </div>
          <Meter value={p.unitShare} className="mt-1" />
        </div>
      </div>

      {/* ยอดแยกตามช่วงเวลา */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink/40">
            <th className="font-medium">ช่วงเวลา</th>
            <th className="text-right font-medium">ชุด</th>
            <th className="text-right font-medium">เป็นเงิน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-grid/60">
              <td className="py-1.5 text-ink/70">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{num(r.units)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{baht(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3">
        <Spark data={p.spark} />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ink/40">ยอดขาย 14 วันล่าสุด</span>
          <Trend value={p.trend7} />
        </div>
      </div>

      {/* รายละเอียดอื่น ๆ */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-grid pt-3 text-xs">
        <div>
          <dt className="text-ink/50">อัตราปิดการขาย</dt>
          <dd className="font-semibold tabular-nums">
            {pct(p.closeRate)}{" "}
            <span className="font-normal text-ink/50">
              ({num(p.units)}/{num(p.attempted)} ที่กดสั่ง)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-ink/50">กดสั่งแล้วไม่จ่าย</dt>
          <dd className="font-semibold tabular-nums">{num(p.abandoned)} ครั้ง</dd>
        </div>
        <div>
          <dt className="text-ink/50">ลูกค้าไม่ซ้ำ</dt>
          <dd className="font-semibold tabular-nums">{num(p.customers)} คน</dd>
        </div>
        <div>
          <dt className="text-ink/50">เฉลี่ยต่อวัน (30 วัน)</dt>
          <dd className="font-semibold tabular-nums">{p.perDay30.toFixed(2)} ชุด</dd>
        </div>
        <div>
          <dt className="text-ink/50">ขายได้ครั้งแรก</dt>
          <dd className="font-semibold">{p.firstSaleAt ? dateOnly(p.firstSaleAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-ink/50">ขายได้ล่าสุด</dt>
          <dd className="font-semibold">{p.lastSaleAt ? dateTime(p.lastSaleAt) : "—"}</dd>
        </div>
      </dl>
    </Card>
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

  const maxDaily = Math.max(...ga.daily.map((d) => d.users), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={`ผู้เข้าชม (${ga.days} วัน)`} value={num(ga.activeUsers)} sub={`ใหม่ ${num(ga.newUsers)} คน`} />
        <Kpi label="เซสชัน" value={num(ga.sessions)} />
        <Kpi label="จำนวนหน้าที่เปิด" value={num(ga.pageViews)} />
        <Kpi
          label="เวลาอยู่บนเว็บเฉลี่ย"
          value={`${Math.floor(ga.avgEngagementSec / 60)}:${String(ga.avgEngagementSec % 60).padStart(2, "0")}`}
          sub="นาที : วินาที ต่อเซสชัน"
        />
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold">ผู้เข้าชมรายวัน</p>
        <Bars
          data={ga.daily.map((d) => ({
            label: dayLabel(d.date).split(" ")[0],
            value: d.users,
            title: `${dayLabel(d.date)} · ${num(d.users)} คน / ${num(d.sessions)} เซสชัน`,
          }))}
          height="h-24"
        />
        <p className="mt-1 text-[10px] text-ink/40">สูงสุด {num(maxDaily)} คนต่อวัน</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-semibold">คนมาจากไหน (ช่องทาง)</p>
          <RankList rows={ga.channels.map((c) => ({ label: c.label, value: c.users }))} unit="คน" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">แหล่งที่มาละเอียด</p>
          <RankList rows={ga.sources.map((c) => ({ label: c.label, value: c.users }))} unit="คน" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">หน้าที่มีคนเข้ามากสุด</p>
          <RankList rows={ga.pages.map((c) => ({ label: c.label, value: c.views }))} unit="ครั้ง" />
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">อุปกรณ์</p>
          <RankList rows={ga.devices.map((c) => ({ label: c.label, value: c.users }))} unit="คน" />
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-sm font-semibold">กรวยการขาย (นับจากอีเวนต์ใน GA)</p>
        <RankList
          rows={ga.events.map((e) => ({ label: e.label, value: e.count }))}
          unit="ครั้ง"
          keepOrder
        />
      </Card>
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

  return (
    <main className="min-h-screen grid-paper px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        {/* หัวหน้า */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Mr.tpat3 · หลังร้าน</p>
            <h1 className="text-2xl font-bold sm:text-3xl">สรุปยอดขาย</h1>
            <p className="mt-0.5 text-xs text-ink/50">
              {updatedAt
                ? `อัปเดตล่าสุด ${updatedAt.toLocaleTimeString("th-TH", TH_DATE)} · รีเฟรชอัตโนมัติทุก 30 วินาที`
                : "กำลังอัปเดต…"}
            </p>
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
            (แม่นสำหรับราคาปัจจุบัน) รันไฟล์ <code>supabase/migration-product-id.sql</code> ใน Supabase เพื่อให้แม่นยำ 100%
          </p>
        )}

        {s && (
          <>
            {/* ===== ภาพรวม ===== */}
            <Section title="ภาพรวม" hint={`ข้อมูลตั้งแต่ ${s.firstOrderAt ? dateOnly(s.firstOrderAt) : "—"} ถึงตอนนี้`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Kpi label="วันนี้" value={baht(s.totals.today.revenue)} sub={`${num(s.totals.today.units)} ชุด`} accent />
                <Kpi label="7 วันล่าสุด" value={baht(s.totals.d7.revenue)} sub={`${num(s.totals.d7.units)} ชุด`} />
                <Kpi label="30 วันล่าสุด" value={baht(s.totals.d30.revenue)} sub={`${num(s.totals.d30.units)} ชุด`} />
                <Kpi label="เดือนนี้" value={baht(s.thisMonth.revenue)} sub={`${num(s.thisMonth.units)} ชุด`} />
                <Kpi label="ยอดขายรวมทั้งหมด" value={baht(s.totals.all.revenue)} sub={`${num(s.totals.all.units)} ชุด`} />
                <Kpi label="เฉลี่ยต่อออเดอร์" value={baht(s.avgOrderValue)} sub={`ลูกค้า ${num(s.customers)} คน`} />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Card>
                  <p className="text-xs text-ink/50">อัตราปิดการขาย</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{pct(s.closeRate)}</p>
                  <Meter value={s.closeRate} className="mt-2" />
                  <p className="mt-1.5 text-xs text-ink/50">
                    กดสั่งซื้อ {num(s.paidOrders + s.pendingOrders)} ครั้ง → จ่ายจริง {num(s.paidOrders)} ครั้ง
                    (ค้างจ่าย {num(s.pendingOrders)})
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-ink/50">ลูกค้าที่ซื้อซ้ำ</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{num(s.repeatCustomerCount)} คน</p>
                  <p className="mt-1.5 text-xs text-ink/50">
                    จากลูกค้าทั้งหมด {num(s.customers)} คน
                    {s.customers > 0 && ` (${pct((s.repeatCustomerCount / s.customers) * 100)})`}
                  </p>
                </Card>
                <Card>
                  <p className="text-xs text-ink/50">ห้องสอบออนไลน์</p>
                  {data.exams.length ? (
                    <ul className="mt-1 space-y-1">
                      {data.exams.map((e) => (
                        <li key={e.id} className="text-sm">
                          <span className="font-bold tabular-nums">{num(e.attempts)} คน</span>{" "}
                          <span className="text-ink/50">
                            ทำ {e.title} · เฉลี่ย {e.avgScore} · สูงสุด {e.maxScore}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-ink/40">ยังไม่มีคนส่งข้อสอบ</p>
                  )}
                </Card>
              </div>
            </Section>

            {/* ===== แจกแจงรายสินค้า ===== */}
            <Section
              title="แจกแจงรายสินค้า"
              hint="เรียงตามรายได้มากไปน้อย · นับเฉพาะออเดอร์ที่จ่ายเงินแล้ว"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {s.products.map((p, i) => (
                  <ProductCard key={p.id} p={p} rank={i + 1} />
                ))}
              </div>

              {/* ตารางสรุปเทียบกันในหน้าจอเดียว */}
              <Card className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-grid text-left text-xs text-ink/50">
                      <th className="pb-2 font-medium">สินค้า</th>
                      <th className="pb-2 text-right font-medium">ขายได้ (ชุด)</th>
                      <th className="pb-2 text-right font-medium">% จำนวน</th>
                      <th className="pb-2 text-right font-medium">เป็นเงิน</th>
                      <th className="pb-2 text-right font-medium">% รายได้</th>
                      <th className="pb-2 text-right font-medium">ปิดการขาย</th>
                      <th className="pb-2 text-right font-medium">ลูกค้า</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.products.map((p) => (
                      <tr key={p.id} className="border-b border-grid/60 last:border-0">
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className="py-2 text-right tabular-nums">{num(p.units)}</td>
                        <td className="py-2 text-right tabular-nums">{pct(p.unitShare)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{baht(p.revenue)}</td>
                        <td className="py-2 text-right tabular-nums">{pct(p.revenueShare)}</td>
                        <td className="py-2 text-right tabular-nums">{pct(p.closeRate)}</td>
                        <td className="py-2 text-right tabular-nums">{num(p.customers)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-grid font-bold">
                      <td className="py-2">รวมทั้งร้าน</td>
                      <td className="py-2 text-right tabular-nums">{num(s.totals.all.units)}</td>
                      <td className="py-2 text-right">100%</td>
                      <td className="py-2 text-right tabular-nums">{baht(s.totals.all.revenue)}</td>
                      <td className="py-2 text-right">100%</td>
                      <td className="py-2 text-right tabular-nums">{pct(s.closeRate)}</td>
                      <td className="py-2 text-right tabular-nums">{num(s.customers)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </Section>

            {/* ===== แนวโน้ม ===== */}
            <Section title="แนวโน้มยอดขาย">
              <Card>
                <p className="mb-2 text-sm font-semibold">รายวัน (30 วันล่าสุด)</p>
                <Bars
                  data={s.daily.map((d) => ({
                    label: dayLabel(d.date).split(" ")[0],
                    value: d.revenue,
                    title: `${dayLabel(d.date)} · ${baht(d.revenue)} (${num(d.units)} ชุด)`,
                  }))}
                />
              </Card>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Card>
                  <p className="mb-2 text-sm font-semibold">รายเดือน</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {[...s.monthly].reverse().map((m) => (
                        <tr key={m.date} className="border-b border-grid/60 last:border-0">
                          <td className="py-1.5">
                            {new Date(`${m.date}-01T00:00:00+07:00`).toLocaleDateString("th-TH", {
                              ...TH_DATE,
                              month: "long",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-ink/60">{num(m.units)} ชุด</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{baht(m.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                <Card>
                  <p className="mb-2 text-sm font-semibold">ขายดีวันไหน / เวลาไหน</p>
                  <Bars
                    data={s.weekday.map((w) => ({
                      label: WEEKDAYS_SHORT[w.day],
                      value: w.revenue,
                      title: `วัน${WEEKDAYS[w.day]} · ${baht(w.revenue)} (${num(w.units)} ชุด)`,
                    }))}
                    height="h-20"
                  />
                  <p className="mb-1 mt-4 text-xs text-ink/50">ตามชั่วโมง (เวลาไทย)</p>
                  <Bars
                    data={s.hourly.map((h) => ({
                      label: h.hour % 6 === 0 ? String(h.hour) : "",
                      value: h.revenue,
                      title: `${String(h.hour).padStart(2, "0")}:00 น. · ${baht(h.revenue)} (${num(h.units)} ชุด)`,
                    }))}
                    height="h-20"
                  />
                </Card>
              </div>
            </Section>

            {/* ===== ลูกค้าซื้อซ้ำ ===== */}
            {s.repeatCustomers.length > 0 && (
              <Section title="ลูกค้าที่ซื้อซ้ำ" hint="ซื้อมากกว่า 1 ครั้ง">
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-grid text-left text-xs text-ink/50">
                        <th className="pb-2 font-medium">ชื่อ</th>
                        <th className="pb-2 font-medium">อีเมล</th>
                        <th className="pb-2 text-right font-medium">ครั้ง</th>
                        <th className="pb-2 text-right font-medium">รวมเป็นเงิน</th>
                        <th className="pb-2 text-right font-medium">ซื้อล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.repeatCustomers.map((c) => (
                        <tr key={c.email} className="border-b border-grid/60 last:border-0">
                          <td className="py-2">{c.name}</td>
                          <td className="py-2 text-ink/60">{c.email}</td>
                          <td className="py-2 text-right tabular-nums">{num(c.orders)}</td>
                          <td className="py-2 text-right font-semibold tabular-nums">{baht(c.revenue)}</td>
                          <td className="py-2 text-right text-ink/60">{dateOnly(c.lastAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </Section>
            )}

            {/* ===== ออเดอร์ล่าสุด ===== */}
            <Section title="ออเดอร์ล่าสุด" hint="รวมรายการที่กดสั่งแล้วยังไม่จ่ายด้วย">
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
                        <td className="py-2 text-right font-semibold tabular-nums">{baht(o.amount)}</td>
                        <td className="py-2 text-right">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>

            {/* ===== Google Analytics ===== */}
            <Section title="ผู้เข้าชมเว็บ (Google Analytics)" hint="30 วันล่าสุด">
              <GaBlock ga={data.ga} configured={data.meta.gaConfigured} />
            </Section>

            <p className="mt-10 pb-6 text-center text-xs text-ink/40">
              ข้อมูลอ่านสดจากฐานข้อมูลร้านทุกครั้งที่รีเฟรช · ออเดอร์ทั้งหมด {num(data.meta.orderCount)} รายการ
            </p>
          </>
        )}
      </div>
    </main>
  );
}
