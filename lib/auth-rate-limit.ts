/**
 * กันยิงรัว (rate limit) ในหน่วยความจำ — ใช้กับล็อกอิน/สมัคร/ขอลิงก์ตั้งรหัสผ่าน
 * นับต่อ instance ของเซิร์ฟเวอร์ (บน Vercel มีหลาย instance) จึงเป็นแค่ด่านแรกกันสคริปต์เดารหัสง่าย ๆ
 * ไม่ใช่ระบบกันโจมตีระดับโครงสร้าง — ถ้าวันหนึ่งโดนหนักจริงค่อยย้ายไปเก็บตัวนับใน Supabase
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** อนุญาตคำขอนี้ไหม — key เช่น "login:<ip>" หรือ "login:<email>" */
export function allow(key: string, max: number, windowMs: number, nowMs: number = Date.now()): boolean {
  const rec = buckets.get(key);
  if (!rec || nowMs > rec.resetAt) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  rec.count += 1;
  return rec.count <= max;
}

/** ล้างตัวนับหลังสำเร็จ (ล็อกอินถูก = ไม่ใช่คนเดารหัส) */
export function reset(key: string): void {
  buckets.delete(key);
}

export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
