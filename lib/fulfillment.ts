import { getProduct, PRODUCTS, Product } from "./catalog";
import { buildDownloadLinks } from "./downloads";
import { logSale } from "./sheets";
import { getMasterPdfBytes } from "./watermark";

/**
 * "ส่งของ" หลังจ่ายเงินสำเร็จ — ทำงานอัตโนมัติทั้งหมด (ไม่มีคนเกี่ยวข้อง):
 * 1) หาว่าสินค้าที่ซื้อประกอบด้วยไฟล์อะไรบ้าง (จากแคตตาล็อก lib/catalog.ts)
 * 2) เช็คว่าไฟล์ต้นฉบับทุกไฟล์พร้อมให้ดาวน์โหลดจริง
 * 3) บันทึกการขายลง Google Sheets
 *
 * ตั้งแต่ 2026-09-16 (เจ้าของสั่ง): **ไม่ส่งอีเมลลิงก์ดาวน์โหลดแล้ว** — ลูกค้าเข้าเรียน/โหลดไฟล์
 * ที่หน้า "คอร์สของฉัน" ด้วยบัญชี Google ที่ใช้ซื้อ (สิทธิ์อ่านจากตาราง orders โดยตรง)
 * ลิงก์ที่คืนไปยังใช้บนหน้า success ได้ (โค้ดส่งอีเมลเดิมยังอยู่ใน lib/email.ts เผื่อกลับมาใช้)
 *
 * หมายเหตุ: ฟังก์ชันนี้ "ไม่" อัปเดตสถานะ order — ผู้เรียกเป็นคนจัดการ
 * (webhook ใช้ claimDelivery กันส่งซ้ำก่อนเรียก และคืนสถานะเองถ้าล้มเหลว)
 */
export async function fulfillOrder(order: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
  productId: string;
}): Promise<{ links: { label: string; url: string }[] }> {
  // order เก่าที่เกิดก่อนระบบหลายสินค้าไม่มี productId — ถือเป็นชุด Mock เดิม
  const product: Product = getProduct(order.productId) ?? PRODUCTS.mock1;

  // เช็คว่าไฟล์ต้นฉบับมีจริงครบทุกไฟล์ — ถ้าไม่มี (เช่น ลืมอัปโหลดขึ้น Supabase Storage)
  // ให้ล้มดัง ๆ ตรงนี้ (webhook จะคืนสถานะให้ลองใหม่) ดีกว่าเปิดคอร์สที่โหลดไฟล์ไม่ได้
  // (ผลพลอยได้: อุ่น cache ให้การดาวน์โหลดจริงเร็วขึ้น)
  await Promise.all(product.files.map((file) => getMasterPdfBytes(file)));

  const links = buildDownloadLinks({
    id: order.id,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    product,
  });

  await logSale({ ...order, productName: product.name });

  return { links };
}
