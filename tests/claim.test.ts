import { describe, it, expect, vi } from "vitest";

/**
 * ทดสอบ "รับคอร์สฟรี" (lib/claim.ts) ในโหมด memory-store (ยังไม่ได้ตั้งค่า Supabase)
 * — order ที่สร้างต้องเป็นยอด 0 สถานะ delivered ผูก product_id ให้ระบบเดิมอ่านได้
 * และรับได้เฉพาะสินค้าที่ price = 0 (เล่มเนื้อหา) — Mock (ขาย ฿199) / bundle (เลิกขาย) ต้องไม่ผ่าน
 * fulfillOrder (เช็คไฟล์ต้นฉบับ + Google Sheets) ถูก mock เพราะไม่มีไฟล์จริงตอนเทสต์
 */
async function load(fulfill: () => Promise<unknown> = async () => ({ links: [] })) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fulfillOrder = vi.fn(fulfill);
  vi.doMock("@/lib/fulfillment", () => ({ fulfillOrder }));
  const claim = await import("@/lib/claim");
  const orders = await import("@/lib/orders");
  const catalog = await import("@/lib/catalog");
  return { ...claim, ...orders, ...catalog, fulfillOrder };
}

describe("claimProduct (รับเล่มเนื้อหาฟรี)", () => {
  it("สร้าง order ยอด 0 สถานะ delivered ผูกอีเมล (ตัวเล็ก) + product_id sum4", async () => {
    const { claimProduct, listOrders, fulfillOrder } = await load();
    const r = await claimProduct({ email: "Som@Example.com" }, "sum4");
    expect(r.status).toBe("claimed");
    const all = await listOrders();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ email: "som@example.com", amount: 0, status: "delivered", product_id: "sum4", first_name: "som" });
    expect(fulfillOrder).toHaveBeenCalledOnce();
  });

  it("Mock (ขาย) / bundle (เลิกขาย) / id มั่ว → โยน error และไม่สร้าง order", async () => {
    const { claimProduct, listOrders, isClaimableProduct, isPurchasableProduct } = await load();
    expect(isClaimableProduct("sum4")).toBe(true);
    expect(isClaimableProduct("mock1")).toBe(false);
    expect(isPurchasableProduct("mock1")).toBe(true);
    expect(isPurchasableProduct("sum4")).toBe(false);
    expect(isPurchasableProduct("bundle-all")).toBe(false);
    await expect(claimProduct({ email: "a@b.com" }, "mock1")).rejects.toThrow();
    await expect(claimProduct({ email: "a@b.com" }, "bundle-all")).rejects.toThrow();
    await expect(claimProduct({ email: "a@b.com" }, "ของปลอม")).rejects.toThrow();
    expect(await listOrders()).toHaveLength(0);
  });

  it("ส่งของล้ม (ไฟล์ต้นฉบับไม่พร้อม) → order ค้าง pending ไม่เปิดสิทธิ์", async () => {
    const { claimProduct, listOrders } = await load(async () => {
      throw new Error("ไม่พบไฟล์ต้นฉบับ");
    });
    await expect(claimProduct({ email: "a@b.com" }, "sum4")).rejects.toThrow("ไม่พบไฟล์ต้นฉบับ");
    const [o] = await listOrders();
    expect(o.status).toBe("pending");
  });
});
