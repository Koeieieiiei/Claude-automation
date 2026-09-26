import { describe, it, expect, vi } from "vitest";

/**
 * ทดสอบ "รับคอร์สฟรี" (lib/claim.ts) ในโหมด memory-store (ยังไม่ได้ตั้งค่า Supabase)
 * — หัวใจคือ order ที่สร้างต้องเป็นยอด 0 สถานะ delivered ผูก product_id ให้ระบบเดิมอ่านได้
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
  return { ...claim, ...orders, fulfillOrder };
}

describe("claimProduct (รับคอร์สฟรี)", () => {
  it("สร้าง order ยอด 0 สถานะ delivered ผูกอีเมล (ตัวเล็ก) + product_id + ชื่อจากบัญชี Google", async () => {
    const { claimProduct, listOrders, fulfillOrder } = await load();
    const r = await claimProduct({ email: "Som@Example.com", name: "สมชาย ใจดี" }, "mock1");
    expect(r.status).toBe("claimed");
    expect(r.product.id).toBe("mock1");
    const all = await listOrders();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      email: "som@example.com",
      amount: 0,
      status: "delivered",
      product_id: "mock1",
      first_name: "สมชาย",
      last_name: "ใจดี",
    });
    expect(fulfillOrder).toHaveBeenCalledOnce();
  });

  it("ไม่มีชื่อบัญชี → ใช้ส่วนหน้า @ ของอีเมลเป็นชื่อ (หลังร้านจะได้ไม่ว่าง)", async () => {
    const { claimProduct, listOrders } = await load();
    await claimProduct({ email: "n0name@example.com" }, "sum4");
    const [o] = await listOrders();
    expect(o.first_name).toBe("n0name");
    expect(o.product_id).toBe("sum4");
  });

  it("คอร์สที่ไม่เปิดให้รับ (bundle-all ยุคขาย / id มั่ว) → โยน error และไม่สร้าง order", async () => {
    const { claimProduct, listOrders } = await load();
    await expect(claimProduct({ email: "a@b.com" }, "bundle-all")).rejects.toThrow();
    await expect(claimProduct({ email: "a@b.com" }, "ของปลอม")).rejects.toThrow();
    expect(await listOrders()).toHaveLength(0);
  });

  it("ส่งของล้ม (ไฟล์ต้นฉบับไม่พร้อม) → order ค้าง pending ไม่เปิดสิทธิ์", async () => {
    const { claimProduct, listOrders } = await load(async () => {
      throw new Error("ไม่พบไฟล์ต้นฉบับ");
    });
    await expect(claimProduct({ email: "a@b.com" }, "mock1")).rejects.toThrow("ไม่พบไฟล์ต้นฉบับ");
    const [o] = await listOrders();
    expect(o.status).toBe("pending");
  });
});
