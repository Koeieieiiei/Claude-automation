import { google } from "googleapis";
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
  { event: "open_buy_form", label: "เปิดฟอร์มสั่งซื้อ" },
  { event: "begin_checkout", label: "ไปหน้าชำระเงิน" },
  { event: "purchase_success", label: "ชำระเงินสำเร็จ" },
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

export async function fetchGaSummary(days = 30): Promise<GaSummary | null> {
  if (!ready.ga) return null;

  const property = `properties/${config.ga.propertyId}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
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
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: "10",
          },
          // 2) แหล่งที่มาละเอียด (เช่น tiktok / google / instagram)
          {
            dateRanges,
            dimensions: [{ name: "sessionSource" }],
            metrics: [{ name: "activeUsers" }, { name: "sessions" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: "10",
          },
          // 3) หน้าที่มีคนเข้ามากสุด
          {
            dateRanges,
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: "10",
          },
          // 4) อุปกรณ์
          {
            dateRanges,
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
    const daily = rowsOf(0).map((r) => {
      const m = r.metricValues ?? [];
      newUsers += num(m[1]?.value);
      sessions += num(m[2]?.value);
      pageViews += num(m[3]?.value);
      engagementSec += num(m[4]?.value);
      return {
        date: isoDate(r.dimensionValues?.[0]?.value ?? ""),
        users: num(m[0]?.value),
        sessions: num(m[2]?.value),
      };
    });
    // ผู้ใช้รวมของทั้งช่วงต้องไม่เอารายวันมาบวกกัน (คนเดิมกลับมาจะถูกนับซ้ำ)
    // — ใช้ค่ารวมจาก report totals ถ้ามี ไม่มีค่อย fallback เป็นผลบวก
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
