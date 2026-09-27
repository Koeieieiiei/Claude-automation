import { google } from "googleapis";
import { bkkDayKey } from "./admin-stats";
import { config, ready } from "./config";

/**
 * ดึงสถิติผู้เข้าชมจาก Google Analytics 4 (Data API v1beta) มาโชว์บนหน้า /admin
 *
 * ต้องตั้งค่า 3 อย่าง: GA4_PROPERTY_ID (ตัวเลขล้วน) + service account
 * (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
 * แล้วเพิ่มอีเมล service account เป็น Viewer ใน GA4 property
 *
 * ถ้ายังไม่ได้ตั้งค่า → คืน null (หน้าเว็บจะโชว์วิธีตั้งค่าแทน ไม่พัง)
 */

const FUNNEL_EVENTS = [
  { event: "download_sample", label: "โหลดไฟล์ตัวอย่าง (เดโม)" },
  { event: "open_buy_form", label: "เปิดฟอร์มสั่งซื้อ" },
  { event: "begin_checkout", label: "ไปหน้าชำระเงิน" },
  { event: "purchase_success", label: "ชำระเงินสำเร็จ" },
  { event: "claim_free", label: "กดรับเล่มเนื้อหาฟรี" },
  { event: "click_exam_cta", label: "กดปุ่มทำข้อสอบ" },
  { event: "exam_start", label: "เริ่มทำข้อสอบ" },
  { event: "exam_submit", label: "ส่งข้อสอบ" },
] as const;

export interface GaRow {
  label: string;
  users: number;
  sessions?: number;
}

export interface GaSummary {
  days: number;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgEngagementSec: number;
  daily: { date: string; users: number; sessions: number }[];
  channels: GaRow[];
  sources: GaRow[];
  pages: { label: string; views: number }[];
  devices: GaRow[];
  events: { event: string; label: string; count: number }[];
}

let cachedClient: ReturnType<typeof google.analyticsdata> | null = null;

function getClient() {
  if (!cachedClient) {
    const auth = new google.auth.JWT({
      email: config.ga.clientEmail,
      key: config.ga.privateKey,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });
    cachedClient = google.analyticsdata({ version: "v1beta", auth });
  }
  return cachedClient;
}

const num = (v: string | null | undefined) => Number(v ?? 0) || 0;

/** YYYYMMDD (รูปแบบที่ GA คืนมา) → YYYY-MM-DD */
function isoDate(gaDate: string): string {
  return `${gaDate.slice(0, 4)}-${gaDate.slice(4, 6)}-${gaDate.slice(6, 8)}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface GaWindow {
  /** วันแรกที่นับ (YYYY-MM-DD เวลาไทย) */
  startDate: string;
  /** จำนวนวันในช่วง นับรวมวันนี้ — 0 = จุดเริ่มนับยังมาไม่ถึง ไม่มีอะไรให้นับ */
  days: number;
  /** ชั่วโมงของวันแรกที่ต้องตัดทิ้ง (รูปแบบ dateHour ของ GA: YYYYMMDDHH) เพราะเกิดก่อนจุดเริ่มนับ */
  excludedDateHours: string[];
}

/**
 * ช่วงเวลาที่จะขอจาก GA: ย้อนหลัง maxDays วัน แต่ไม่ย้อนเกินจุดเริ่มนับ (sinceMs, 0 = ไม่จำกัด)
 * GA ตัดได้ละเอียดสุดระดับชั่วโมง — จุดเริ่มนับที่ไม่ลงต้นชั่วโมงจะเริ่มนับที่ต้นชั่วโมงถัดไป
 */
export function gaWindow(nowMs: number, maxDays: number, sinceMs = 0): GaWindow {
  const today = bkkDayKey(nowMs);
  const rollingStart = bkkDayKey(nowMs - (maxDays - 1) * DAY_MS);
  const sinceDay = sinceMs ? bkkDayKey(sinceMs) : "";
  if (!sinceDay || sinceDay <= rollingStart) {
    return { startDate: rollingStart, days: maxDays, excludedDateHours: [] };
  }
  if (sinceMs > nowMs) return { startDate: sinceDay, days: 0, excludedDateHours: [] };

  const dayDiff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sinceDay}T00:00:00Z`)) / DAY_MS);
  const firstHour = Math.ceil(((sinceMs + BKK_OFFSET_MS) % DAY_MS) / (60 * 60 * 1000));
  const ymd = sinceDay.replace(/-/g, "");
  return {
    startDate: sinceDay,
    days: dayDiff + 1,
    excludedDateHours: Array.from({ length: firstHour }, (_, h) => `${ymd}${String(h).padStart(2, "0")}`),
  };
}

/** sinceMs = นับเฉพาะตั้งแต่เวลานี้ (จุดเริ่มนับของหน้าหลังร้าน — lib/admin-reset.ts) */
export async function fetchGaSummary(maxDays = 30, sinceMs = 0): Promise<GaSummary | null> {
  if (!ready.ga) return null;

  const window = gaWindow(Date.now(), maxDays, sinceMs);
  const days = window.days;
  if (days === 0) {
    return {
      days: 0,
      activeUsers: 0,
      newUsers: 0,
      sessions: 0,
      pageViews: 0,
      avgEngagementSec: 0,
      daily: [],
      channels: [],
      sources: [],
      pages: [],
      devices: [],
      events: FUNNEL_EVENTS.map((e) => ({ event: e.event, label: e.label, count: 0 })),
    };
  }

  const property = `properties/${config.ga.propertyId}`;
  const dateRanges = [{ startDate: window.startDate, endDate: "today" }];
  // ตัดชั่วโมงก่อนจุดเริ่มนับของวันแรกทิ้ง (ใส่ในทุกรายงาน ให้ทุกตัวเลขนับช่วงเดียวกัน)
  const dimensionFilter = window.excludedDateHours.length
    ? {
        notExpression: {
          filter: { fieldName: "dateHour", inListFilter: { values: window.excludedDateHours } },
        },
      }
    : undefined;
  const client = getClient();

  try {
    // ยิงหลายรายงานพร้อมกันด้วย batchRunReports (GA จำกัด batch ละ 5 รายงาน
    // — เรามี 6 จึงแยกรายงานอีเวนต์ไปยิงคู่ขนานต่างหาก)
    const batchPromise = client.properties.batchRunReports({
      property,
      requestBody: {
        requests: [
          // 0) ภาพรวม + รายวัน
          {
            dateRanges,
            dimensionFilter,
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "activeUsers" },
              { name: "newUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
              { name: "userEngagementDuration" },
            ],
            orderBys: [{ dimension: { dimensionName: "date" } }],
            limit: "400",
            // ขอยอดรวมทั้งช่วงมาด้วย — ผู้ใช้รวมต้องนับแบบไม่ซ้ำคน
            // (เอารายวันมาบวกกันจะนับคนที่กลับมาหลายวันซ้ำ)
            metricAggregations: ["TOTAL"],
          },
          // 1) ช่องทางที่มา (กลุ่มใหญ่ เช่น Organic Social / Direct)
          {
            dateRanges,
            dimensionFilter,
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: "10",
          },
          // 2) แหล่งที่มาละเอียด (เช่น tiktok / google / instagram)
          {
            dateRanges,
            dimensionFilter,
            dimensions: [{ name: "sessionSource" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: "10",
          },
          // 3) หน้าที่มีคนเข้ามากสุด
          {
            dateRanges,
            dimensionFilter,
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: "10",
          },
          // 4) อุปกรณ์
          {
            dateRanges,
            dimensionFilter,
            dimensions: [{ name: "deviceCategory" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: "5",
          },
        ],
      },
    });

    // 5) เหตุการณ์กรวยการขายที่ฝังไว้ใน lib/analytics.ts — รายงานที่ 6 เกินโควตา batch
    const eventsPromise = client.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensionFilter,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: "100",
      },
    });

    const [{ data }, { data: eventsData }] = await Promise.all([batchPromise, eventsPromise]);
    const reports = data.reports ?? [];
    const rowsOf = (i: number) => reports[i]?.rows ?? [];

    let activeUsers = 0;
    let newUsers = 0;
    let sessions = 0;
    let pageViews = 0;
    let engagementSec = 0;
    // GA คืนเฉพาะวันที่มีข้อมูล — เก็บใส่ map ก่อน แล้วค่อยเติมวันว่างให้ครบช่วง
    // (ไม่งั้นกราฟรายวันจะเหลือแค่แท่งเดียวเต็มความกว้าง)
    const byDay = new Map<string, { users: number; sessions: number }>();
    for (const r of rowsOf(0)) {
      const m = r.metricValues ?? [];
      newUsers += num(m[1]?.value);
      sessions += num(m[2]?.value);
      pageViews += num(m[3]?.value);
      engagementSec += num(m[4]?.value);
      byDay.set(isoDate(r.dimensionValues?.[0]?.value ?? ""), {
        users: num(m[0]?.value),
        sessions: num(m[2]?.value),
      });
    }
    const daily = Array.from({ length: days }, (_, i) => {
      const date = bkkDayKey(Date.now() - (days - 1 - i) * DAY_MS);
      const d = byDay.get(date);
      return { date, users: d?.users ?? 0, sessions: d?.sessions ?? 0 };
    });
    // ผู้ใช้รวมของทั้งช่วงต้องไม่เอารายวันมาบวกกัน (คนเดิมกลับมาจะถูกนับซ้ำ)
    // — ใช้ค่ารวมจาก report totals (metricAggregations) ถ้ามี ไม่มีค่อย fallback เป็นผลบวก
    activeUsers = num(reports[0]?.totals?.[0]?.metricValues?.[0]?.value);
    if (!activeUsers) activeUsers = daily.reduce((s, d) => s + d.users, 0);

    const toRows = (i: number): GaRow[] =>
      rowsOf(i).map((r) => ({
        label: r.dimensionValues?.[0]?.value || "(ไม่ระบุ)",
        users: num(r.metricValues?.[0]?.value),
        sessions: num(r.metricValues?.[1]?.value),
      }));

    const eventCounts = new Map<string, number>();
    for (const r of eventsData.rows ?? []) {
      eventCounts.set(r.dimensionValues?.[0]?.value ?? "", num(r.metricValues?.[0]?.value));
    }

    return {
      days,
      activeUsers,
      newUsers,
      sessions,
      pageViews,
      avgEngagementSec: sessions > 0 ? Math.round(engagementSec / sessions) : 0,
      daily,
      channels: toRows(1),
      sources: toRows(2),
      pages: rowsOf(3).map((r) => ({
        label: r.dimensionValues?.[0]?.value || "/",
        views: num(r.metricValues?.[0]?.value),
      })),
      devices: toRows(4),
      events: FUNNEL_EVENTS.map((e) => ({
        event: e.event,
        label: e.label,
        count: eventCounts.get(e.event) ?? 0,
      })),
    };
  } catch (err) {
    // GA ล่ม/สิทธิ์ไม่ถึง ต้องไม่ทำให้หน้ายอดขายทั้งหน้าพัง
    console.error("ดึงข้อมูล Google Analytics ไม่สำเร็จ:", err);
    return null;
  }
}
