import { getProduct, isClaimableProduct, Product } from "./catalog";
import { createOrder, updateOrder } from "./orders";
import { fulfillOrder } from "./fulfillment";
import { getLibrary, ownsProduct } from "./library";

export type ClaimStatus = "claimed" | "already-owned";

/**
 * "รับคอร์สฟรี" — สำหรับสินค้าที่ price = 0 (ตอนนี้คือเล่มเนื้อหา TPAT3 — เจ้าของสั่ง 2026-09-27)
 *
 * สร้าง order ยอด 0 บาท สถานะ delivered ให้บัญชีที่ล็อกอินอยู่ — เท่ากับ "ซื้อแล้ว" ในสายตาของ
 * ระบบเดิมทุกส่วน: คอร์สของฉัน (lib/library.ts), ลิงก์ดาวน์โหลด (lib/downloads.ts), สถิติหลังร้าน
 * (ออเดอร์ยอด 0 = นับชุดได้ รายได้ 0) · สิทธิ์ห้องสอบไม่เกี่ยว เพราะเล่มเนื้อหาไม่มีไฟล์ questions
 * (lib/exam-store.ts อ่าน product_id ของออเดอร์ก่อนเสมอ ไม่เหมารวมออเดอร์ที่ไม่มี Stripe session เป็น Mock)
 *
 * กดซ้ำ = ไม่สร้าง order ซ้ำ (เช็คก่อนว่ามีไฟล์ครบของคอร์สนั้นแล้วหรือยัง)
 */
export async function claimProduct(
  user: { email: string; name?: string | null },
  productId: string
): Promise<{ status: ClaimStatus; product: Product }> {
  if (!isClaimableProduct(productId)) throw new Error(`คอร์สนี้ไม่ได้แจกฟรี: ${productId}`);
  const product = getProduct(productId)!;
  const email = user.email.trim().toLowerCase();

  const items = await getLibrary(email);
  if (ownsProduct(items, product)) return { status: "already-owned", product };

  // ไม่มีช่องกรอกชื่อในระบบสมัคร (อีเมล+รหัสผ่าน) → ชื่อในออเดอร์ = ส่วนหน้า @ (ไว้ดูในหลังร้าน)
  const firstName = (user.name ?? "").trim() || email.split("@")[0];
  const lastName = "";

  const order = await createOrder({ firstName, lastName, email, amount: 0, productId: product.id });
  // ตรวจว่าไฟล์ต้นฉบับพร้อมจริง + บันทึกลง Google Sheets (ขั้นเดียวกับ "ส่งของ" หลังจ่ายเงิน)
  // ถ้าไฟล์ไม่พร้อม จะล้มตรงนี้ก่อนเปิดสิทธิ์ — order ค้าง pending ไว้ ไม่มีผลกับสิทธิ์อะไร
  await fulfillOrder({ id: order.id, firstName, lastName, email, amount: 0, productId: product.id });
  await updateOrder(order.id, { status: "delivered" });
  return { status: "claimed", product };
}
