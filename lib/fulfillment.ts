import { config } from "./config";
import { FILE_INFO, getProduct, PRODUCTS, Product } from "./catalog";
import { createDownloadToken } from "./download-token";
import { sendDownloadEmail } from "./email";
import { logSale } from "./sheets";
import { getMasterPdfBytes } from "./watermark";

/**
 * "ส่งของ" หลังจ่ายเงินสำเร็จ — ทำงานอัตโนมัติทั้งหมด (ไม่มีคนเกี่ยวข้อง):
 * 1) หาว่าสินค้าที่ซื้อประกอบด้วยไฟล์อะไรบ้าง (จากแคตตาล็อก lib/catalog.ts)
 * 2) เช็คว่าไฟล์ต้นฉบับทุกไฟล์พร้อมให้ดาวน์โหลดจริง
 * 3) สร้างลิงก์ดาวน์โหลดแบบเซ็น + มีวันหมดอายุ + จำกัดสิทธิ์เฉพาะไฟล์ที่ซื้อ
 *    (ไฟล์จะถูกใส่ลายน้ำตอนกดดาวน์โหลด)
 * 4) ส่งอีเมลลิงก์ให้ลูกค้า
 * 5) บันทึกการขายลง Google Sheets
 *
 * หมายเหตุ: ฟังก์ชันนี้ "ไม่" อัปเดตสถานะ order — ผู้เรียกเป็นคนจัดการ
 * (webhook ใช้ claimDelivery กันส่งซ้ำก่อนเรียก และคืนสถานะเองถ้าล้มเหลว)
 * เรียกซ้ำจะส่งอีเมลซ้ำ จึงต้องกันซ้ำที่ผู้เรียกเสมอ
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

  // เช็คก่อนส่งอีเมลว่าไฟล์ต้นฉบับมีจริงครบทุกไฟล์ — ถ้าไม่มี (เช่น ลืมอัปโหลดขึ้น
  // Supabase Storage) ให้ล้มดัง ๆ ตรงนี้ ดีกว่าส่งอีเมล "สำเร็จ" พร้อมลิงก์เสียให้ลูกค้า
  // (ผลพลอยได้: อุ่น cache ให้การดาวน์โหลดจริงเร็วขึ้น)
  await Promise.all(product.files.map((file) => getMasterPdfBytes(file)));

  const token = createDownloadToken({
    orderId: order.id,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    files: product.files,
  });

  // ลิงก์ดาวน์โหลดหนึ่งลิงก์ต่อหนึ่งไฟล์ (token เดียวกัน ต่างกันที่ชนิดไฟล์)
  const links = product.files.map((file) => ({
    label: FILE_INFO[file].label,
    url: `${config.baseUrl}/api/download/${file}/${token}`,
  }));

  await sendDownloadEmail({
    to: order.email,
    firstName: order.firstName,
    productName: product.name,
    links,
    expiryHours: config.download.expiryHours,
  });

  await logSale({ ...order, productName: product.name });

  return { links };
}
