import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * ทดสอบ claimDelivery ในโหมด memory-store (ยังไม่ได้ตั้งค่า Supabase)
 * — หัวใจของการกันส่งของซ้ำเมื่อ Stripe ส่ง webhook ซ้ำ
 */
async function loadOrders() {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return import("@/lib/orders");
}

const buyer = { firstName: "สมชาย", lastName: "ใจดี", email: "som@example.com", amount: 199 };

describe("claimDelivery (idempotency กันส่งของซ้ำ)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("claim ครั้งแรกได้ 'claimed', ครั้งต่อไปได้ 'already-delivered'", async () => {
    const { createOrder, claimDelivery } = await loadOrders();
    const order = await createOrder(buyer);

    expect(await claimDelivery(order.id)).toBe("claimed");
    // webhook ที่มาซ้ำ/พร้อมกันต้อง claim ไม่ได้ → ถูกข้าม ไม่ส่งอีเมลรอบสอง
    expect(await claimDelivery(order.id)).toBe("already-delivered");
    expect(await claimDelivery(order.id)).toBe("already-delivered");
  });

  it("order ที่ไม่มีอยู่ → 'not-found'", async () => {
    const { claimDelivery } = await loadOrders();
    expect(await claimDelivery("ไม่มี-order-นี้")).toBe("not-found");
  });

  it("หลัง claim สำเร็จ สถานะ order เปลี่ยนเป็น delivered", async () => {
    const { createOrder, claimDelivery, getOrder } = await loadOrders();
    const order = await createOrder(buyer);
    await claimDelivery(order.id);
    const after = await getOrder(order.id);
    expect(after?.status).toBe("delivered");
  });
});
