/**
 * แปลงอายุลิงก์ (ชั่วโมง) เป็นข้อความไทยที่อ่านง่าย
 * ใช้ร่วมกันทั้งอีเมล หน้าจ่ายเงินสำเร็จ และหน้าผลสอบ เพื่อให้พูดตรงกันเสมอ
 *
 * คืน null เมื่อไม่มีวันหมดอายุ (0 หรือค่าติดลบ)
 * ไฟล์นี้ต้อง import ได้ทั้ง client และ server — ห้ามมี dependency ของ Node
 */
const HOURS_PER_DAY = 24;
const HOURS_PER_MONTH = HOURS_PER_DAY * 30; // นับเดือนละ 30 วันแบบกลม ๆ

export function formatExpiry(hours: number): string | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (hours % HOURS_PER_MONTH === 0) return `${hours / HOURS_PER_MONTH} เดือน`;
  if (hours % HOURS_PER_DAY === 0) return `${hours / HOURS_PER_DAY} วัน`;
  return `${hours} ชั่วโมง`;
}
