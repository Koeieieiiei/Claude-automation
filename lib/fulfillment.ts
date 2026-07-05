import { config } from "./config";
import { createDownloadToken } from "./download-token";
import { sendDownloadEmail } from "./email";
import { logSale } from "./sheets";
import { updateOrder } from "./orders";

/**
 * "ส่งของ" หลังจ่ายเงินสำเร็จ — ทำงานอัตโนมัติทั้งหมด (ไม่มีคนเกี่ยวข้อง):
 * 1) สร้างลิงก์ดาวน์โหลดแบบเซ็น + มีวันหมดอายุ (ไฟล์จะถูกใส่ลายน้ำตอนกดดาวน์โหลด)
 * 2) ส่งอีเมลลิงก์ให้ลูกค้า
 * 3) บันทึกการขายลง Google Sheets
 * 4) อัปเดตสถานะ order เป็น delivered
 *
 * ออกแบบให้ idempotent ได้ระดับหนึ่ง — เรียกซ้ำจะส่งอีเมลซ้ำ จึงควรกันซ้ำที่ผู้เรียก
 * (webhook เช็คสถานะ order ก่อนเรียก)
 */
export async function fulfillOrder(order: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
}): Promise<{ links: { label: string; url: string }[] }> {
  const token = createDownloadToken({
    orderId: order.id,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
  });

  // ลูกค้าได้รับ 2 ไฟล์: โจทย์ และ เฉลย (ใช้ token เดียวกัน ต่างกันที่ชนิดไฟล์)
  const links = [
    { label: "ไฟล์โจทย์", url: `${config.baseUrl}/api/download/questions/${token}` },
    { label: "ไฟล์เฉลย", url: `${config.baseUrl}/api/download/answers/${token}` },
  ];

  await sendDownloadEmail({
    to: order.email,
    firstName: order.firstName,
    productName: config.product.name,
    links,
    expiryHours: config.download.expiryHours,
  });

  await logSale(order);
  // ถ้า set delivered ไม่สำเร็จ อย่ากลืนเงียบ — log ไว้ เพราะ webhook retry อาจส่งอีเมลซ้ำ
  await updateOrder(order.id, { status: "delivered" }).catch((err) =>
    console.error(`อัปเดตสถานะ delivered ไม่สำเร็จ (order ${order.id}):`, err)
  );

  return { links };
}
