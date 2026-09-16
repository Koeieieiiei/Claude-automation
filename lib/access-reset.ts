/**
 * วันรีเซ็ตสิทธิ์ทั้งระบบ — เจ้าของสั่ง 2026-09-16: "ทุกอีเมลไม่เคยชำระเงินมาก่อน ต้องชำระใหม่"
 *
 * ทำแบบ "กำหนดวันตัด" ไม่ลบข้อมูล: ออเดอร์ / ลิงก์ดาวน์โหลด / รอบสอบ ที่เกิดก่อนเวลานี้
 * ไม่ให้สิทธิ์ใด ๆ อีก (คอร์สของฉันว่าง, เข้าห้องสอบไม่ได้, ลิงก์ในอีเมลเก่าใช้ไม่ได้)
 * สถิติ/บัญชีหลังร้าน (/admin) ยังเห็นออเดอร์เก่าครบ
 *
 * เปลี่ยนใจ: ตั้ง env ACCESS_RESET_AT เป็นเวลาอื่น หรือ "0" = ไม่รีเซ็ต (ทุกอย่างกลับมาเหมือนเดิม)
 * import ได้ทั้ง client และ server
 */
const raw = process.env.ACCESS_RESET_AT ?? "2026-09-16T12:00:00Z"; // 19:00 น. เวลาไทย
export const ACCESS_RESET_AT: number = raw === "0" ? 0 : Date.parse(raw) || 0;

/** ISO string สำหรับใช้ใน query ฐานข้อมูล (created_at >= …) */
export const accessResetIso = (): string => new Date(ACCESS_RESET_AT).toISOString();

/** เวลานี้อยู่หลังวันรีเซ็ตไหม (รับ ISO string หรือ unix ms) — ค่าว่าง/อ่านไม่ออก = ไม่ผ่าน */
export function afterReset(at: string | number | null | undefined): boolean {
  const t = typeof at === "number" ? at : Date.parse(at ?? "");
  return Number.isFinite(t) && t >= ACCESS_RESET_AT;
}
