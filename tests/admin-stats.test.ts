import { describe, it, expect } from "vitest";
import {
  bkkDayKey,
  bkkStartOfToday,
  resolveProduct,
  summarizeSales,
  type OrderRow,
} from "@/lib/admin-stats";

/**
 * ตัวเลขบนหน้า /admin ต้องเชื่อถือได้ — เทสต์ครอบ "กติกาคิดเงิน" ทั้งหมด:
 * นับเฉพาะที่จ่ายแล้ว, แยกสินค้าถูกตัว (รวมออเดอร์เก่าที่ไม่มี product_id),
 * และการตัดวันต้องใช้เวลาไทยไม่ใช่ UTC
 */

const DAY = 24 * 60 * 60 * 1000;
// 2026-07-26 12:00 น. เวลาไทย
const NOW = Date.parse("2026-07-26T05:00:00.000Z");

let seq = 0;
function order(patch: Partial<OrderRow> = {}): OrderRow {
  seq += 1;
  return {
    id: `order-${seq}`,
    first_name: "สมชาย",
    last_name: "ใจดี",
    email: `buyer${seq}@example.com`,
    amount: 159,
    status: "delivered",
    stripe_session_id: `cs_${seq}`,
    created_at: new Date(NOW).toISOString(),
    ...patch,
  };
}

describe("เวลาไทย", () => {
  it("ออเดอร์ตอน 6 โมงเช้าเวลาไทย (23:00 UTC ของเมื่อวาน) ต้องนับเป็นวันไทย ไม่ใช่วัน UTC", () => {
    expect(bkkDayKey("2026-07-25T23:30:00.000Z")).toBe("2026-07-26");
  });

  it("เที่ยงคืนเวลาไทยของวันนี้ = 17:00 UTC ของเมื่อวาน", () => {
    expect(new Date(bkkStartOfToday(NOW)).toISOString()).toBe("2026-07-25T17:00:00.000Z");
  });
});

describe("รู้ว่าออเดอร์ไหนคือสินค้าอะไร", () => {
  it("ใช้ product_id ถ้ามี", () => {
    expect(resolveProduct(order({ product_id: "sum4", amount: 99 })).id).toBe("sum4");
  });

  it("ออเดอร์เก่าที่ไม่มี product_id → เดาจากราคา (299 = ยุคขาย Mock อย่างเดียว)", () => {
    expect(resolveProduct(order({ amount: 299 })).id).toBe("mock1");
    expect(resolveProduct(order({ amount: 199 })).id).toBe("bundle-all");
  });

  it("ราคาที่เลิกขายไปแล้ว → กองรวมเป็น 'อื่น ๆ'", () => {
    expect(resolveProduct(order({ amount: 649 })).id).toBe("other");
  });

  it("สินค้าที่เลิกขายแล้ว (sum1/bundle-sum) ยังรู้จักชื่อ ไม่ถูกเหมารวมเป็น 'อื่น ๆ'", () => {
    const sum1 = resolveProduct(order({ product_id: "sum1", amount: 189 }));
    expect(sum1.id).toBe("sum1");
    expect(sum1.name).toContain("เลิกขายแล้ว");
    expect(sum1.price).toBeNull();
    expect(resolveProduct(order({ product_id: "bundle-sum", amount: 449 })).id).toBe("bundle-sum");
  });

  it("product_id มั่ว ๆ ไม่ทำให้พัง — ตกไปใช้ราคาแทน", () => {
    expect(resolveProduct(order({ product_id: "ของปลอม", amount: 99 })).id).toBe("sum4");
  });
});

describe("summarizeSales", () => {
  it("นับเฉพาะออเดอร์ที่จ่ายเงินแล้ว (pending ไม่เข้ายอดขาย แต่เข้าอัตราปิดการขาย)", () => {
    const s = summarizeSales(
      [
        order({ amount: 159, status: "delivered" }),
        order({ amount: 99, status: "paid" }),
        order({ amount: 199, status: "pending" }),
      ],
      NOW
    );
    expect(s.totals.all).toEqual({ units: 2, revenue: 258 });
    expect(s.paidOrders).toBe(2);
    expect(s.pendingOrders).toBe(1);
    expect(s.closeRate).toBeCloseTo(66.67, 1);
  });

  it("แยกยอดรายสินค้า พร้อมสัดส่วน % ของทั้งร้าน", () => {
    const s = summarizeSales(
      [
        order({ product_id: "mock1", amount: 159 }),
        order({ product_id: "mock1", amount: 159 }),
        order({ product_id: "sum4", amount: 99 }),
        order({ product_id: "bundle-all", amount: 199, status: "pending" }),
      ],
      NOW
    );
    const mock1 = s.products.find((p) => p.id === "mock1")!;
    const sum4 = s.products.find((p) => p.id === "sum4")!;
    const bundle = s.products.find((p) => p.id === "bundle-all")!;

    expect(mock1.units).toBe(2);
    expect(mock1.revenue).toBe(318);
    expect(mock1.unitShare).toBeCloseTo(66.67, 1);
    expect(mock1.revenueShare).toBeCloseTo(76.26, 1); // 318 / 417
    expect(sum4.units).toBe(1);

    // สั่งแล้วไม่จ่าย: ไม่มียอดขาย แต่ต้องเห็นว่ามีคนสนใจกี่ครั้ง
    expect(bundle.units).toBe(0);
    expect(bundle.attempted).toBe(1);
    expect(bundle.abandoned).toBe(1);
    expect(bundle.closeRate).toBe(0);
  });

  it("สินค้าในแคตตาล็อกที่ยังไม่เคยขาย ต้องยังโผล่ในรายการ (ยอด 0)", () => {
    const s = summarizeSales([order({ product_id: "mock1" })], NOW);
    expect(s.products.map((p) => p.id)).toContain("sum4");
    expect(s.products.find((p) => p.id === "sum4")!.units).toBe(0);
  });

  it("สินค้าเลิกขายที่ไม่เคยขายได้ (มีแต่กดสั่งไม่จ่าย) ถูกซ่อนจากรายการ แต่ถ้าเคยขายได้ต้องยังโชว์", () => {
    const s = summarizeSales(
      [
        order({ product_id: "mock1" }),
        order({ product_id: "sum1", amount: 189, status: "pending" }), // เลิกขาย + ไม่เคยจ่าย → ซ่อน
        order({ product_id: "bundle-sum", amount: 449 }), // เลิกขายแต่เคยขายได้ → ต้องโชว์
      ],
      NOW
    );
    const ids = s.products.map((p) => p.id);
    expect(ids).not.toContain("sum1");
    expect(ids).toContain("bundle-sum");
    // ยอดรวมของร้านยังนับออเดอร์ pending ของสินค้าที่ถูกซ่อนอยู่ (อัตราปิดการขายไม่เพี้ยน)
    expect(s.pendingOrders).toBe(1);
  });

  it("แบ่งช่วงเวลา วันนี้ / 7 วัน / 30 วัน ถูกต้อง", () => {
    const s = summarizeSales(
      [
        order({ amount: 100, created_at: new Date(NOW).toISOString() }), // วันนี้
        order({ amount: 200, created_at: new Date(NOW - 3 * DAY).toISOString() }), // ใน 7 วัน
        order({ amount: 400, created_at: new Date(NOW - 20 * DAY).toISOString() }), // ใน 30 วัน
        order({ amount: 800, created_at: new Date(NOW - 60 * DAY).toISOString() }), // เก่ากว่านั้น
      ],
      NOW
    );
    expect(s.totals.today.revenue).toBe(100);
    expect(s.totals.d7.revenue).toBe(300);
    expect(s.totals.d30.revenue).toBe(700);
    expect(s.totals.all.revenue).toBe(1500);
    expect(s.daily).toHaveLength(30);
    expect(s.daily[s.daily.length - 1].revenue).toBe(100); // ช่องสุดท้าย = วันนี้
  });

  it("แนวโน้ม 7 วัน เทียบกับ 7 วันก่อนหน้า", () => {
    const s = summarizeSales(
      [
        order({ product_id: "sum4", amount: 200, created_at: new Date(NOW - 1 * DAY).toISOString() }),
        order({ product_id: "sum4", amount: 100, created_at: new Date(NOW - 9 * DAY).toISOString() }),
      ],
      NOW
    );
    const sum4 = s.products.find((p) => p.id === "sum4")!;
    expect(sum4.d7.revenue).toBe(200);
    expect(sum4.prev7.revenue).toBe(100);
    expect(sum4.trend7).toBe(100); // โต 100%
  });

  it("ลูกค้าซื้อซ้ำ นับจากอีเมลเดียวกัน (ไม่สนตัวพิมพ์เล็กใหญ่/ช่องว่าง)", () => {
    const s = summarizeSales(
      [
        order({ email: "a@example.com", amount: 159 }),
        order({ email: " A@Example.com ", amount: 99 }),
        order({ email: "b@example.com", amount: 99 }),
      ],
      NOW
    );
    expect(s.customers).toBe(2);
    expect(s.repeatCustomerCount).toBe(1);
    expect(s.repeatCustomers[0].orders).toBe(2);
    expect(s.repeatCustomers[0].revenue).toBe(258);
  });

  it("ไม่มีออเดอร์เลยก็ต้องไม่พัง (ไม่หารด้วยศูนย์)", () => {
    const s = summarizeSales([], NOW);
    expect(s.totals.all).toEqual({ units: 0, revenue: 0 });
    expect(s.closeRate).toBe(0);
    expect(s.avgOrderValue).toBe(0);
    expect(s.daily).toHaveLength(30);
  });
});
