/**
 * สรุปสถิติการขายสำหรับหน้า /admin — "ฟังก์ชันล้วน" ไม่แตะฐานข้อมูล/เครือข่าย
 * (ผู้เรียกดึงแถว orders มาให้ แล้วส่งเข้า summarizeSales) เพื่อให้ทดสอบได้ตรง ๆ
 *
 * นิยามที่ใช้ทั้งไฟล์:
 * - "จ่ายแล้ว" = status paid หรือ delivered (delivered = ส่งไฟล์เรียบร้อยแล้ว)
 * - "ยังไม่จ่าย" (pending) = กดสั่งซื้อแล้วสร้างหน้าชำระเงิน แต่ไม่ได้จ่ายจริง
 * - เวลาทุกอย่างคิดตามเวลาไทย (UTC+7 คงที่ ไม่มี DST)
 */
import { PRODUCTS, ProductId } from "./catalog";

export interface OrderRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  amount: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
  /** เพิ่มภายหลัง — order เก่ายังไม่มีค่า จึงต้องเดาจากราคา (ดู resolveProduct) */
  product_id?: string | null;
}

/* ================= เวลาไทย ================= */

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** เลื่อนเวลาไป +7 ชม. แล้วอ่านด้วย getUTC* = ได้ปฏิทินไทยแบบไม่ต้องพึ่ง timezone ของเครื่อง */
function bkk(iso: string | number): Date {
  return new Date(new Date(iso).getTime() + BKK_OFFSET_MS);
}

/** คีย์วันแบบ YYYY-MM-DD ตามเวลาไทย */
export function bkkDayKey(iso: string | number): string {
  return bkk(iso).toISOString().slice(0, 10);
}

/** เวลาเที่ยงคืนของ "วันนี้" (เวลาไทย) เป็น epoch ms */
export function bkkStartOfToday(nowMs: number): number {
  const shifted = nowMs + BKK_OFFSET_MS;
  return shifted - (shifted % DAY_MS) - BKK_OFFSET_MS;
}

/* ================= สินค้าของแต่ละออเดอร์ ================= */

/**
 * ราคาที่เคยขาย → สินค้า สำหรับออเดอร์เก่าที่ยังไม่มีคอลัมน์ product_id
 * (299 = ยุคขายชุด Mock อย่างเดียว ก่อนมีระบบหลายสินค้า)
 */
const LEGACY_PRICE_TO_PRODUCT: Record<number, ProductId> = {
  99: "sum4",
  159: "mock1",
  199: "bundle-all",
  299: "mock1",
};

/**
 * สินค้าที่เคยขายแล้วเลิกไปแล้ว (ถูกลบออกจาก lib/catalog.ts)
 * ยังต้องรู้จักชื่อไว้ ไม่งั้นออเดอร์เก่าจะถูกเหมารวมเป็น "อื่น ๆ" หมด
 */
const RETIRED_PRODUCTS: Record<string, string> = {
  sum1: "สรุปเนื้อหา ชุดที่ 1 (เลิกขายแล้ว)",
  sum2: "สรุปเนื้อหา ชุดที่ 2 (เลิกขายแล้ว)",
  sum3: "สรุปเนื้อหา ชุดที่ 3 (เลิกขายแล้ว)",
  "bundle-sum": "เซ็ตสรุปเนื้อหา (เลิกขายแล้ว)",
};

export const OTHER_PRODUCT_ID = "other";
const OTHER_PRODUCT_NAME = "อื่น ๆ (ราคาเก่า / เลิกขายแล้ว)";

export interface ResolvedProduct {
  id: string;
  name: string;
  /** ราคาขายปัจจุบัน — null = ไม่ได้อยู่ในแคตตาล็อกแล้ว */
  price: number | null;
}

/** สินค้าของออเดอร์: ใช้ product_id ถ้ามี ไม่มีก็เดาจากราคาที่จ่าย */
export function resolveProduct(order: OrderRow): ResolvedProduct {
  const explicit = order.product_id;
  if (explicit && Object.prototype.hasOwnProperty.call(PRODUCTS, explicit)) {
    const p = PRODUCTS[explicit as ProductId];
    return { id: p.id, name: p.name, price: p.price };
  }
  if (explicit && RETIRED_PRODUCTS[explicit]) {
    return { id: explicit, name: RETIRED_PRODUCTS[explicit], price: null };
  }
  const guessed = LEGACY_PRICE_TO_PRODUCT[order.amount];
  if (guessed) {
    const p = PRODUCTS[guessed];
    return { id: p.id, name: p.name, price: p.price };
  }
  return { id: OTHER_PRODUCT_ID, name: OTHER_PRODUCT_NAME, price: null };
}

export function isPaid(order: OrderRow): boolean {
  return order.status === "paid" || order.status === "delivered";
}

/* ================= รูปแบบผลลัพธ์ ================= */

export interface Bucket {
  units: number;
  revenue: number;
}

export interface ProductStats {
  id: string;
  name: string;
  price: number | null;
  /** จำนวนที่ขายได้ทั้งหมด (จ่ายเงินแล้ว) */
  units: number;
  /** เป็นเงินทั้งหมด (บาท) */
  revenue: number;
  /** สัดส่วนจำนวนชิ้นเทียบสินค้าทั้งร้าน (%) */
  unitShare: number;
  /** สัดส่วนเงินเทียบยอดขายทั้งร้าน (%) */
  revenueShare: number;
  /** ราคาเฉลี่ยต่อชิ้นที่ขายได้จริง (ราคาเคยเปลี่ยน จึงไม่เท่าราคาป้ายเสมอ) */
  avgPrice: number;
  /** กดสั่งซื้อทั้งหมด (รวมที่ไม่ได้จ่าย) */
  attempted: number;
  /** กดสั่งแล้วไม่จ่าย */
  abandoned: number;
  /** อัตราปิดการขาย = จ่ายจริง / กดสั่งซื้อ (%) */
  closeRate: number;
  /** จำนวนลูกค้าไม่ซ้ำ (นับตามอีเมล) */
  customers: number;
  firstSaleAt: string | null;
  lastSaleAt: string | null;
  today: Bucket;
  d7: Bucket;
  prev7: Bucket;
  d30: Bucket;
  /** % การเปลี่ยนแปลงของยอดเงิน 7 วันล่าสุด เทียบ 7 วันก่อนหน้า (null = ไม่มีฐานให้เทียบ) */
  trend7: number | null;
  /** ขายได้เฉลี่ยกี่ชิ้นต่อวัน (คิดจาก 30 วันล่าสุด) */
  perDay30: number;
  /** ยอดเงินราย 14 วันล่าสุด (เก่า → ใหม่) ไว้วาดกราฟเส้นเล็ก */
  spark: number[];
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (เวลาไทย)
  units: number;
  revenue: number;
}

export interface RecentOrder {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  productId: string;
  productName: string;
  amount: number;
  status: string;
  paid: boolean;
}

export interface RepeatCustomer {
  email: string;
  name: string;
  orders: number;
  revenue: number;
  lastAt: string;
}

export interface SalesSummary {
  generatedAt: string;
  /** ช่วงเวลาที่มีข้อมูล */
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  totals: {
    today: Bucket;
    d7: Bucket;
    d30: Bucket;
    all: Bucket;
  };
  /** ยอดขายรวมเดือนนี้ (ตามปฏิทินไทย) */
  thisMonth: Bucket;
  paidOrders: number;
  pendingOrders: number;
  /** อัตราปิดการขายทั้งร้าน (%) */
  closeRate: number;
  avgOrderValue: number;
  customers: number;
  repeatCustomerCount: number;
  products: ProductStats[];
  daily: DailyPoint[]; // 30 วันล่าสุด (เติมวันที่ยอด 0 ให้ครบ)
  monthly: DailyPoint[]; // รายเดือนตั้งแต่เปิดร้าน (date = YYYY-MM)
  weekday: { day: number; units: number; revenue: number }[]; // 0=อาทิตย์
  hourly: { hour: number; units: number; revenue: number }[]; // 0-23 เวลาไทย
  recent: RecentOrder[];
  repeatCustomers: RepeatCustomer[];
}

/* ================= ตัวช่วย ================= */

const emptyBucket = (): Bucket => ({ units: 0, revenue: 0 });

function add(b: Bucket, amount: number) {
  b.units += 1;
  b.revenue += amount;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? round2((part / whole) * 100) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ================= ตัวหลัก ================= */

export function summarizeSales(orders: OrderRow[], nowMs: number = Date.now()): SalesSummary {
  const startToday = bkkStartOfToday(nowMs);
  const start7 = startToday - 6 * DAY_MS; // นับวันนี้เป็นวันที่ 7
  const startPrev7 = start7 - 7 * DAY_MS;
  const start30 = startToday - 29 * DAY_MS;
  const start14 = startToday - 13 * DAY_MS;
  const monthKey = bkkDayKey(nowMs).slice(0, 7);

  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const totals = {
    today: emptyBucket(),
    d7: emptyBucket(),
    d30: emptyBucket(),
    all: emptyBucket(),
  };
  const thisMonth = emptyBucket();

  const dailyMap = new Map<string, Bucket>();
  const monthlyMap = new Map<string, Bucket>();
  const weekday = Array.from({ length: 7 }, () => emptyBucket());
  const hourly = Array.from({ length: 24 }, () => emptyBucket());

  interface Acc {
    info: ResolvedProduct;
    units: number;
    revenue: number;
    attempted: number;
    emails: Set<string>;
    firstSaleAt: string | null;
    lastSaleAt: string | null;
    today: Bucket;
    d7: Bucket;
    prev7: Bucket;
    d30: Bucket;
    spark: number[];
  }
  const perProduct = new Map<string, Acc>();
  const accOf = (info: ResolvedProduct): Acc => {
    let acc = perProduct.get(info.id);
    if (!acc) {
      acc = {
        info,
        units: 0,
        revenue: 0,
        attempted: 0,
        emails: new Set(),
        firstSaleAt: null,
        lastSaleAt: null,
        today: emptyBucket(),
        d7: emptyBucket(),
        prev7: emptyBucket(),
        d30: emptyBucket(),
        spark: Array.from({ length: 14 }, () => 0),
      };
      perProduct.set(info.id, acc);
    }
    return acc;
  };

  const byEmail = new Map<string, { name: string; orders: number; revenue: number; lastAt: string }>();
  let paidOrders = 0;
  let pendingOrders = 0;

  for (const o of sorted) {
    const info = resolveProduct(o);
    const acc = accOf(info);
    acc.attempted += 1;

    if (!isPaid(o)) {
      pendingOrders += 1;
      continue;
    }

    paidOrders += 1;
    const t = new Date(o.created_at).getTime();
    const amount = Number(o.amount) || 0;
    const day = bkkDayKey(o.created_at);
    const month = day.slice(0, 7);
    const d = bkk(o.created_at);

    add(totals.all, amount);
    if (t >= start30) add(totals.d30, amount);
    if (t >= start7) add(totals.d7, amount);
    if (t >= startToday) add(totals.today, amount);
    if (month === monthKey) add(thisMonth, amount);

    if (!dailyMap.has(day)) dailyMap.set(day, emptyBucket());
    add(dailyMap.get(day)!, amount);
    if (!monthlyMap.has(month)) monthlyMap.set(month, emptyBucket());
    add(monthlyMap.get(month)!, amount);
    add(weekday[d.getUTCDay()], amount);
    add(hourly[d.getUTCHours()], amount);

    acc.units += 1;
    acc.revenue += amount;
    acc.emails.add(o.email.trim().toLowerCase());
    acc.firstSaleAt = acc.firstSaleAt ?? o.created_at;
    acc.lastSaleAt = o.created_at;
    if (t >= start30) add(acc.d30, amount);
    if (t >= start7) add(acc.d7, amount);
    else if (t >= startPrev7) add(acc.prev7, amount);
    if (t >= startToday) add(acc.today, amount);
    if (t >= start14) {
      const idx = Math.floor((t - start14) / DAY_MS);
      if (idx >= 0 && idx < 14) acc.spark[idx] += amount;
    }

    const key = o.email.trim().toLowerCase();
    const cust = byEmail.get(key) ?? {
      name: `${o.first_name} ${o.last_name}`.trim(),
      orders: 0,
      revenue: 0,
      lastAt: o.created_at,
    };
    cust.orders += 1;
    cust.revenue += amount;
    cust.lastAt = o.created_at;
    byEmail.set(key, cust);
  }

  const totalUnits = totals.all.units;
  const totalRevenue = totals.all.revenue;

  const products: ProductStats[] = [...perProduct.values()]
    // สินค้าที่เลิกขายแล้วและ "ไม่เคยขายได้เลย" (มีแต่คนกดสั่งแล้วไม่จ่าย) ไม่ต้องโชว์
    // — เจ้าของสั่งเอาออก 2026-07-26; ยอดกดสั่ง/อัตราปิดการขายรวมของร้านยังนับครบอยู่
    .filter((a) => a.units > 0 || Object.prototype.hasOwnProperty.call(PRODUCTS, a.info.id))
    .map((a) => ({
      id: a.info.id,
      name: a.info.name,
      price: a.info.price,
      units: a.units,
      revenue: round2(a.revenue),
      unitShare: pct(a.units, totalUnits),
      revenueShare: pct(a.revenue, totalRevenue),
      avgPrice: a.units > 0 ? round2(a.revenue / a.units) : 0,
      attempted: a.attempted,
      abandoned: a.attempted - a.units,
      closeRate: pct(a.units, a.attempted),
      customers: a.emails.size,
      firstSaleAt: a.firstSaleAt,
      lastSaleAt: a.lastSaleAt,
      today: a.today,
      d7: a.d7,
      prev7: a.prev7,
      d30: a.d30,
      // ไม่มียอดในรอบก่อน = ไม่มีฐานให้เทียบ (โชว์ "ใหม่" แทนตัวเลข %)
      trend7: a.prev7.revenue > 0 ? round2(((a.d7.revenue - a.prev7.revenue) / a.prev7.revenue) * 100) : null,
      perDay30: round2(a.d30.units / 30),
      spark: a.spark.map(round2),
    }))
    // สินค้าขายดีอยู่บนสุด · สินค้าที่ยังไม่เคยขายได้เรียงท้าย
    .sort((x, y) => y.revenue - x.revenue || y.attempted - x.attempted);

  // เติมสินค้าที่อยู่ในแคตตาล็อกแต่ยังไม่มีใครสั่งเลย เพื่อให้เห็นครบทุกตัว
  for (const p of Object.values(PRODUCTS)) {
    if (!products.some((row) => row.id === p.id)) {
      products.push({
        id: p.id,
        name: p.name,
        price: p.price,
        units: 0,
        revenue: 0,
        unitShare: 0,
        revenueShare: 0,
        avgPrice: 0,
        attempted: 0,
        abandoned: 0,
        closeRate: 0,
        customers: 0,
        firstSaleAt: null,
        lastSaleAt: null,
        today: emptyBucket(),
        d7: emptyBucket(),
        prev7: emptyBucket(),
        d30: emptyBucket(),
        trend7: null,
        perDay30: 0,
        spark: Array.from({ length: 14 }, () => 0),
      });
    }
  }

  const daily: DailyPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = bkkDayKey(startToday - i * DAY_MS);
    const b = dailyMap.get(key) ?? emptyBucket();
    daily.push({ date: key, units: b.units, revenue: round2(b.revenue) });
  }

  const monthly: DailyPoint[] = [...monthlyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, b]) => ({ date: month, units: b.units, revenue: round2(b.revenue) }));

  const repeatCustomers: RepeatCustomer[] = [...byEmail.entries()]
    .filter(([, c]) => c.orders > 1)
    .map(([email, c]) => ({ email, name: c.name, orders: c.orders, revenue: round2(c.revenue), lastAt: c.lastAt }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

  const recent: RecentOrder[] = [...sorted]
    .reverse()
    .slice(0, 40)
    .map((o) => {
      const info = resolveProduct(o);
      return {
        id: o.id,
        createdAt: o.created_at,
        name: `${o.first_name} ${o.last_name}`.trim(),
        email: o.email,
        productId: info.id,
        productName: info.name,
        amount: Number(o.amount) || 0,
        status: o.status,
        paid: isPaid(o),
      };
    });

  return {
    generatedAt: new Date(nowMs).toISOString(),
    firstOrderAt: sorted[0]?.created_at ?? null,
    lastOrderAt: sorted[sorted.length - 1]?.created_at ?? null,
    totals: {
      today: { units: totals.today.units, revenue: round2(totals.today.revenue) },
      d7: { units: totals.d7.units, revenue: round2(totals.d7.revenue) },
      d30: { units: totals.d30.units, revenue: round2(totals.d30.revenue) },
      all: { units: totals.all.units, revenue: round2(totals.all.revenue) },
    },
    thisMonth: { units: thisMonth.units, revenue: round2(thisMonth.revenue) },
    paidOrders,
    pendingOrders,
    closeRate: pct(paidOrders, paidOrders + pendingOrders),
    avgOrderValue: paidOrders > 0 ? round2(totalRevenue / paidOrders) : 0,
    customers: byEmail.size,
    repeatCustomerCount: repeatCustomers.length,
    products,
    daily,
    monthly,
    weekday: weekday.map((b, day) => ({ day, units: b.units, revenue: round2(b.revenue) })),
    hourly: hourly.map((b, hour) => ({ hour, units: b.units, revenue: round2(b.revenue) })),
    recent,
    repeatCustomers,
  };
}
