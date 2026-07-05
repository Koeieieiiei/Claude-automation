import { config } from "./config";
import { createDownloadToken } from "./download-token";
import { sendDownloadEmail } from "./email";
import { logSale } from "./sheets";
import { getMasterPdfBytes } from "./watermark";

/**
 * "ส่งของ" หลังจ่ายเงินสำเร็จ — ทำงานอัตโนมัติทั้งหมด (ไม่มีคนเกี่ยวข้อง):
 * 1) เช็คว่าไฟล์ต้นฉบับ (โจทย์+เฉลย) พร้อมให้ดาวน์โหลดจริง
 * 2) สร้างลิงก์ดาวน์โหลดแบบเซ็น + มีวันหมดอายุ (ไฟล์จะถูกใส่ลายน้ำตอนกดดาวน์โหลด)
 * 3) ส่งอีเมลลิงก์ให้ลูกค้า
 * 4) บันทึกการขายลง Google Sheets
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
}): Promise<{ links: { label: string; url: string }[] }> {
  // เช็คก่อนส่งอีเมลว่าไฟล์ต้นฉบับมีจริงทั้ง 2 ไฟล์ — ถ้าไม่มี (เช่น ลืมอัปโหลดขึ้น
  // Supabase Storage) ให้ล้มดัง ๆ ตรงนี้ ดีกว่าส่งอีเมล "สำเร็จ" พร้อมลิงก์เสียให้ลูกค้า
  // (ผลพลอยได้: อุ่น cache ให้การดาวน์โหลดจริงเร็วขึ้น)
  await Promise.all([getMasterPdfBytes("questions"), getMasterPdfBytes("answers")]);

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

  return { links };
}
