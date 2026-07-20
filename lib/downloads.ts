import { config } from "./config";
import { FILE_INFO, Product } from "./catalog";
import { createDownloadToken } from "./download-token";

/** ลิงก์ดาวน์โหลดหนึ่งไฟล์ — ใช้ได้ทั้งในอีเมลและบนหน้าเว็บ */
export interface DownloadLink {
  file: string;
  label: string;
  downloadName: string;
  url: string;
}

/**
 * สร้างลิงก์ดาวน์โหลดของสินค้าหนึ่งชิ้น — "แหล่งความจริงเดียว" ที่ทั้งอีเมล
 * (lib/fulfillment.ts) และปุ่มดาวน์โหลดบนหน้า success ใช้ร่วมกัน เพื่อให้ลิงก์
 * เหมือนกันเป๊ะเสมอ
 *
 * โทเค็นใบเดียวครอบทุกไฟล์ของสินค้า (เซ็น HMAC + มีวันหมดอายุ + จำกัดสิทธิ์เฉพาะ
 * ไฟล์ที่ซื้อ) ไฟล์จะถูกใส่ลายน้ำระบุผู้ซื้อตอนกดดาวน์โหลด
 */
export function buildDownloadLinks(order: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  product: Product;
}): DownloadLink[] {
  const token = createDownloadToken({
    orderId: order.id,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    files: order.product.files,
  });

  return order.product.files.map((file) => ({
    file,
    label: FILE_INFO[file].label,
    downloadName: FILE_INFO[file].downloadName,
    url: `${config.baseUrl}/api/download/${file}/${token}`,
  }));
}
