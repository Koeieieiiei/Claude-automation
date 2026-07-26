/**
 * สรุปบัญชีรายรับรายจ่ายของร้าน — "ฟังก์ชันล้วน" (ทดสอบได้ตรง ๆ ไม่แตะฐานข้อมูล)
 *
 * รายรับมี 2 ทาง: (1) การขายบนเว็บ อ่านจากตาราง orders อัตโนมัติ
 *                 (2) รายรับนอกเว็บที่กรอกเองในสมุดบัญชี (lib/ledger.ts)
 * รายจ่ายมี 2 ทาง: (1) ค่าธรรมเนียม Stripe ดึงจาก Stripe อัตโนมัติ
 *                 (2) รายจ่ายที่กรอกเอง เช่น ค่าโฆษณา ค่าโดเมน
 */
import { bkkDayKey, isPaid, type OrderRow } from "./admin-stats";
import type { LedgerEntry } from "./ledger";

/**
 * วันเริ่มต้นนับบัญชี — เจ้าของกำหนด "ตั้งแต่ Mock ราคา 159" (2026-07-24
 * คือวันแรกที่มีออเดอร์ราคา 159; ก่อนหน้านั้นเป็นยุคขายชุดเดียวราคา 299)
 * เปลี่ยนได้ด้วย environment variable LEDGER_START_DATE
 */
export const LEDGER_START = process.env.LEDGER_START_DATE || "2026-07-24";

export const STRIPE_FEE_CATEGORY = "ค่าธรรมเนียม Stripe";

export interface FinanceRow {
  label: string;
  amount: number;
  /** สัดส่วนเทียบยอดรวมฝั่งเดียวกัน (%) */
  share: number;
  /** รายการนี้ระบบดึงมาให้อัตโนมัติ (ลบเองไม่ได้) */
  auto?: boolean;
}

export interface FinanceMonth {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  profit: number;
}

export interface FinanceSummary {
  startDate: string;
  income: {
    shop: number;
    shopUnits: number;
    manual: number;
    total: number;
  };
  expense: {
    stripeFees: number;
    /** null = ยังดึงค่าธรรมเนียมจาก Stripe ไม่ได้ (จะไม่ถูกนับเป็นรายจ่าย) */
    stripeFeesAvailable: boolean;
    manual: number;
    total: number;
    byCategory: FinanceRow[];
  };
  profit: number;
  /** กำไรคิดเป็น % ของรายรับ */
  margin: number;
  /** เงินที่เข้ากระเป๋าจริงต่อการขาย 1 ชุด (กำไร ÷ จำนวนชุดที่ขายได้) */
  profitPerUnit: number;
  monthly: FinanceMonth[];
  entries: LedgerEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

export function summarizeFinance(input: {
  orders: OrderRow[];
  entries: LedgerEntry[];
  /** ค่าธรรมเนียมที่ Stripe หักไปจริง (บาท) — null = ดึงไม่ได้/ยังไม่ได้ตั้งค่า */
  stripeFees: number | null;
  startDate?: string;
}): FinanceSummary {
  const startDate = input.startDate ?? LEDGER_START;

  const monthMap = new Map<string, FinanceMonth>();
  const month = (key: string): FinanceMonth => {
    let m = monthMap.get(key);
    if (!m) {
      m = { month: key, income: 0, expense: 0, profit: 0 };
      monthMap.set(key, m);
    }
    return m;
  };

  // ---- รายรับจากการขายบนเว็บ ----
  let shop = 0;
  let shopUnits = 0;
  for (const o of input.orders) {
    if (!isPaid(o)) continue;
    const day = bkkDayKey(o.created_at);
    if (day < startDate) continue;
    const amount = Number(o.amount) || 0;
    shop += amount;
    shopUnits += 1;
    month(day.slice(0, 7)).income += amount;
  }

  // ---- รายการที่กรอกเอง ----
  let manualIncome = 0;
  let manualExpense = 0;
  const byCategory = new Map<string, number>();
  const entries = input.entries
    .filter((e) => e.occurred_on >= startDate)
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));

  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    const m = month(e.occurred_on.slice(0, 7));
    if (e.kind === "income") {
      manualIncome += amount;
      m.income += amount;
    } else {
      manualExpense += amount;
      m.expense += amount;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    }
  }

  // ---- ค่าธรรมเนียม Stripe (อัตโนมัติ) ----
  const stripeFeesAvailable = input.stripeFees !== null;
  const stripeFees = input.stripeFees ?? 0;
  if (stripeFees > 0) {
    byCategory.set(STRIPE_FEE_CATEGORY, (byCategory.get(STRIPE_FEE_CATEGORY) ?? 0) + stripeFees);
    // ค่าธรรมเนียมเกิดคู่กับการขาย จึงลงเดือนตามสัดส่วนรายรับของแต่ละเดือน
    const totalShop = shop;
    if (totalShop > 0) {
      for (const m of monthMap.values()) {
        m.expense += round2((m.income / totalShop) * stripeFees);
      }
    }
  }

  const totalIncome = round2(shop + manualIncome);
  const totalExpense = round2(stripeFees + manualExpense);
  const profit = round2(totalIncome - totalExpense);

  const monthly = [...monthMap.values()]
    .map((m) => ({
      month: m.month,
      income: round2(m.income),
      expense: round2(m.expense),
      profit: round2(m.income - m.expense),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return {
    startDate,
    income: {
      shop: round2(shop),
      shopUnits,
      manual: round2(manualIncome),
      total: totalIncome,
    },
    expense: {
      stripeFees: round2(stripeFees),
      stripeFeesAvailable,
      manual: round2(manualExpense),
      total: totalExpense,
      byCategory: [...byCategory.entries()]
        .map(([label, amount]) => ({
          label,
          amount: round2(amount),
          share: pct(amount, stripeFees + manualExpense),
          auto: label === STRIPE_FEE_CATEGORY,
        }))
        .sort((a, b) => b.amount - a.amount),
    },
    profit,
    margin: pct(profit, totalIncome),
    profitPerUnit: shopUnits > 0 ? round2(profit / shopUnits) : 0,
    monthly,
    entries,
  };
}
