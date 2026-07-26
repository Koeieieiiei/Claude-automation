import { describe, it, expect } from "vitest";
import { summarizeFinance } from "@/lib/finance";
import type { OrderRow } from "@/lib/admin-stats";
import type { LedgerEntry } from "@/lib/ledger";

/**
 * บัญชีต้องตรง — เทสต์กติกาสำคัญ: นับเฉพาะที่จ่ายเงินแล้ว, ตัดของก่อนวันเริ่มนับทิ้ง,
 * ค่าธรรมเนียม Stripe เป็นรายจ่ายอัตโนมัติ, และกำไร = รายรับ - รายจ่าย เสมอ
 */

const START = "2026-07-24";

let seq = 0;
function order(patch: Partial<OrderRow> = {}): OrderRow {
  seq += 1;
  return {
    id: `o${seq}`,
    first_name: "ก",
    last_name: "ข",
    email: `x${seq}@example.com`,
    amount: 159,
    status: "delivered",
    stripe_session_id: null,
    created_at: "2026-07-25T03:00:00.000Z",
    ...patch,
  };
}

function entry(patch: Partial<LedgerEntry> = {}): LedgerEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    occurred_on: "2026-07-25",
    kind: "expense",
    category: "ค่าโฆษณา",
    note: "",
    amount: 500,
    created_at: "2026-07-25T00:00:00.000Z",
    ...patch,
  };
}

describe("summarizeFinance", () => {
  it("รายรับ = ยอดขายที่จ่ายแล้วตั้งแต่วันเริ่มนับ (ของเก่ากว่านั้นไม่นับ)", () => {
    const f = summarizeFinance({
      orders: [
        order({ amount: 159 }),
        order({ amount: 199 }),
        order({ amount: 299, created_at: "2026-07-20T03:00:00.000Z" }), // ยุค 299 ก่อนวันเริ่มนับ
        order({ amount: 159, status: "pending" }), // ยังไม่จ่าย
      ],
      entries: [],
      stripeFees: null,
      startDate: START,
    });
    expect(f.income.shop).toBe(358);
    expect(f.income.shopUnits).toBe(2);
    expect(f.income.total).toBe(358);
  });

  it("ค่าธรรมเนียม Stripe ถูกนับเป็นรายจ่ายอัตโนมัติ และกำไร = รายรับ - รายจ่าย", () => {
    const f = summarizeFinance({
      orders: [order({ amount: 159 }), order({ amount: 199 })],
      entries: [entry({ amount: 100, category: "ค่าโฆษณา" })],
      stripeFees: 13.07,
      startDate: START,
    });
    expect(f.expense.stripeFees).toBe(13.07);
    expect(f.expense.manual).toBe(100);
    expect(f.expense.total).toBe(113.07);
    expect(f.profit).toBe(358 - 113.07);
    expect(f.income.total - f.expense.total).toBeCloseTo(f.profit, 2);
    // ค่าธรรมเนียมโผล่เป็นหมวดหนึ่งในรายจ่าย และทำเครื่องหมายว่าเป็นของอัตโนมัติ
    const auto = f.expense.byCategory.find((c) => c.auto);
    expect(auto?.amount).toBe(13.07);
  });

  it("ดึงค่าธรรมเนียมไม่ได้ (null) → ไม่นับเป็นรายจ่าย และบอกสถานะไว้", () => {
    const f = summarizeFinance({
      orders: [order({ amount: 159 })],
      entries: [],
      stripeFees: null,
      startDate: START,
    });
    expect(f.expense.stripeFeesAvailable).toBe(false);
    expect(f.expense.total).toBe(0);
    expect(f.profit).toBe(159);
  });

  it("รายรับนอกเว็บที่กรอกเองรวมเข้ารายรับ ส่วนรายการก่อนวันเริ่มนับถูกตัดทิ้ง", () => {
    const f = summarizeFinance({
      orders: [order({ amount: 159 })],
      entries: [
        entry({ kind: "income", category: "ขายนอกเว็บ (โอนตรง)", amount: 300 }),
        entry({ kind: "expense", amount: 999, occurred_on: "2026-07-01" }), // ก่อนวันเริ่มนับ
      ],
      stripeFees: 0,
      startDate: START,
    });
    expect(f.income.manual).toBe(300);
    expect(f.income.total).toBe(459);
    expect(f.expense.total).toBe(0);
    expect(f.entries).toHaveLength(1);
  });

  it("กำไรติดลบได้ถ้ารายจ่ายมากกว่ารายรับ", () => {
    const f = summarizeFinance({
      orders: [order({ amount: 159 })],
      entries: [entry({ amount: 2000, category: "ค่าโฆษณา" })],
      stripeFees: 0,
      startDate: START,
    });
    expect(f.profit).toBe(-1841);
    expect(f.margin).toBeLessThan(0);
  });

  it("สรุปรายเดือน: รายรับ/รายจ่าย/กำไร แยกเดือนตามเวลาไทย", () => {
    const f = summarizeFinance({
      orders: [
        order({ amount: 159, created_at: "2026-07-25T03:00:00.000Z" }),
        order({ amount: 199, created_at: "2026-08-02T03:00:00.000Z" }),
        // 31 ส.ค. 23:30 UTC = 1 ก.ย. 06:30 เวลาไทย → ต้องเข้าเดือนกันยายน
        order({ amount: 99, created_at: "2026-08-31T23:30:00.000Z" }),
      ],
      entries: [entry({ amount: 200, occurred_on: "2026-08-10" })],
      stripeFees: 0,
      startDate: START,
    });
    const byMonth = Object.fromEntries(f.monthly.map((m) => [m.month, m]));
    expect(byMonth["2026-07"].income).toBe(159);
    expect(byMonth["2026-08"].income).toBe(199);
    expect(byMonth["2026-08"].expense).toBe(200);
    expect(byMonth["2026-08"].profit).toBe(-1);
    expect(byMonth["2026-09"].income).toBe(99);
  });

  it("ไม่มีข้อมูลเลยก็ไม่พัง", () => {
    const f = summarizeFinance({ orders: [], entries: [], stripeFees: null, startDate: START });
    expect(f.income.total).toBe(0);
    expect(f.profit).toBe(0);
    expect(f.margin).toBe(0);
    expect(f.profitPerUnit).toBe(0);
    expect(f.monthly).toEqual([]);
  });
});
