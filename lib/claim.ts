import { getProduct, isClaimableProduct, Product } from "./catalog";
import { createOrder, updateOrder } from "./orders";
import { fulfillOrder } from "./fulfillment";
import { getLibrary, ownsProduct } from "./library";
import { splitName } from "./name";

export type ClaimStatus = "claimed" | "already-owned";

/**
 * "รับคอร์สฟรี" — มาแทนการสั่งซื้อ+จ่ายเงินเดิมทั้งหมด (2026-09-26 เจ้าของสั่งแจกฟรี)
 *
 * สร้าง order ยอด 0 บาท สถานะ delivered ให้บัญชี Google ที่ล็อกอินอยู่ — เท่ากับ "ซื้อแล้ว"
 * ในสายตาของระบบเดิมทุกส่วน: คอร์สของฉัน (lib/library.ts), สิทธิ์ห้องสอบ (lib/exam-store.ts),
 * ลิงก์ดาวน์โหลด (lib/downloads.ts) และสถิติหลังร้าน (lib/admin-stats.ts) ไม่ต้องแก้อะไร
 *
 * กดซ้ำ = ไม่สร้าง order ซ้ำ (เช็คก่อนว่ามีไฟล์ครบของคอร์สนั้นแล้วหรือยัง)
 */
export async function claimProduct(
  user: { email: string; name?: string | null },
  productId: string
): Promise<{ status: ClaimStatus; product: Product }> {
  if (!isClaimableProduct(productId)) throw new Error(`ไม่พบคอร์สที่ขอรับ: ${productId}`);
  const product = getProduct(productId)!;
  const email = user.email.trim().toLowerCase();

  const items = await getLibrary(email);
  if (ownsProduct(items, product)) return { status: "already-owned", product };

  // ชื่อจากบัญชี Google — ไว้ดูในหลังร้าน (ลายน้ำเป็นแบรนด์ ไม่ใช้ชื่อแล้ว) ไม่มีชื่อก็ใช้ส่วนหน้า @
  const n = splitName(user.name ?? "");
  const firstName = n.firstName || email.split("@")[0];
  const lastName = n.lastName;

  const order = await createOrder({ firstName, lastName, email, amount: 0, productId: product.id });
  // ตรวจว่าไฟล์ต้นฉบับพร้อมจริงทุกไฟล์ + บันทึกลง Google Sheets (ขั้นเดียวกับ "ส่งของ" หลังจ่ายเงินเดิม)
  // ถ้าไฟล์ไม่พร้อม จะล้มตรงนี้ก่อนเปิดสิทธิ์ — order ค้าง pending ไว้ ไม่มีผลกับสิทธิ์อะไร
  await fulfillOrder({ id: order.id, firstName, lastName, email, amount: 0, productId: product.id });
  await updateOrder(order.id, { status: "delivered" });
  return { status: "claimed", product };
}
