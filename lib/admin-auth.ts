import { createHmac, timingSafeEqual } from "crypto";
import { config, ready } from "./config";

/**
 * ระบบล็อกอินง่าย ๆ ของหน้า /admin (คนใช้คนเดียวคือเจ้าของร้าน)
 *
 * แนวคิด: กรอกรหัสผ่านถูก → ออก "คุกกี้ที่เซ็นด้วย HMAC" ให้ (ไม่เก็บ session ในฐานข้อมูล)
 * คุกกี้เป็น httpOnly ฝั่ง JS อ่านไม่ได้ และเซ็นด้วย DOWNLOAD_SECRET + แฮชของรหัสผ่าน
 * → เปลี่ยนรหัสผ่านเมื่อไหร่ คุกกี้เก่าทุกใบใช้ไม่ได้ทันที
 */

export const ADMIN_COOKIE = "mrtpat3_admin";

function passwordFingerprint(): string {
  return createHmac("sha256", config.download.secret)
    .update(`admin-password:${config.admin.password}`)
    .digest("hex");
}

function sign(data: string): string {
  return createHmac("sha256", `${config.download.secret}:${passwordFingerprint()}`)
    .update(data)
    .digest("hex");
}

/** เทียบสตริงแบบไม่รั่วเวลา (กันเดารหัสจากการจับเวลาตอบกลับ) */
function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** ตั้งค่าครบหรือยัง (ไม่ครบ = หน้า /admin จะบอกวิธีตั้งค่าแทนการให้ล็อกอิน) */
export function adminReady(): boolean {
  return ready.admin;
}

export function verifyAdminPassword(input: string): boolean {
  if (!adminReady()) return false;
  return safeEqual(input, config.admin.password);
}

/** สร้างค่าคุกกี้: "<หมดอายุ>.<ลายเซ็น>" */
export function createAdminSession(nowMs: number = Date.now()): { value: string; maxAge: number } {
  const maxAgeSec = config.admin.sessionDays * 24 * 60 * 60;
  const exp = nowMs + maxAgeSec * 1000;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: maxAgeSec };
}

export function verifyAdminSession(value: string | undefined, nowMs: number = Date.now()): boolean {
  if (!adminReady() || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  const expected = sign(exp);
  if (sig.length !== expected.length || !safeEqual(sig, expected)) return false;
  return Number(exp) > nowMs;
}

/* ================= กันเดารหัสผ่าน (rate limit ในหน่วยความจำ) ================= */

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * คืน true ถ้ายังลองได้ — เก็บในหน่วยความจำของ instance เท่านั้น
 * (Vercel มีหลาย instance จึงไม่ใช่การกันแบบเข้มงวด แต่พอชะลอการยิงรหัสมั่ว)
 */
export function allowLoginAttempt(ip: string, nowMs: number = Date.now()): boolean {
  const rec = attempts.get(ip);
  if (!rec || nowMs > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: nowMs + WINDOW_MS });
    return true;
  }
  rec.count += 1;
  return rec.count <= MAX_ATTEMPTS;
}

/** ล็อกอินสำเร็จแล้วล้างตัวนับของ IP นั้น */
export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip);
}
