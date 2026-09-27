/**
 * จุดเริ่มนับตัวเลขบนหน้าหลังร้าน — เจ้าของสั่ง 2026-09-27: "รีเซ็ตหน้าแอดมินทุกอย่างเป็นศูนย์"
 *
 * ทำแบบ "กำหนดเวลาเริ่มนับ" ไม่ลบข้อมูล (แบบเดียวกับ lib/access-reset.ts):
 * ออเดอร์ / รายการบัญชี / ผลสอบ / ผู้เข้าชม ที่เกิดก่อนเวลานี้ไม่ถูกนับบนหน้า /admin
 * แต่ยังอยู่ครบในฐานข้อมูล — ลูกค้าที่ซื้อไปแล้วยังเข้าคอร์ส/ห้องสอบได้ตามเดิม
 * และสถิติบนหน้าผลสอบของผู้สอบไม่เกี่ยวกับค่านี้
 *
 * เปลี่ยนใจ: ตั้ง env ADMIN_STATS_START เป็นเวลาอื่น หรือ "0" = ไม่รีเซ็ต (เห็นยอดเก่าทั้งหมดเหมือนเดิม)
 * ควรตั้งให้ลงต้นชั่วโมงพอดี — Google Analytics ตัดได้ละเอียดสุดระดับชั่วโมง
 */
const raw = process.env.ADMIN_STATS_START ?? "2026-09-27T13:00:00Z"; // 20:00 น. เวลาไทย
export const ADMIN_STATS_START: number = raw === "0" ? 0 : Date.parse(raw) || 0;

/** เวลานี้อยู่หลังจุดเริ่มนับไหม (รับ ISO string หรือ unix ms) — ค่าว่าง/อ่านไม่ออก = ไม่นับ */
export function sinceAdminReset(at: string | number | null | undefined): boolean {
  const t = typeof at === "number" ? at : Date.parse(at ?? "");
  return Number.isFinite(t) && t >= ADMIN_STATS_START;
}
