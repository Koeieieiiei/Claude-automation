import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

/**
 * โทเค็นดาวน์โหลดแบบเซ็นด้วย HMAC — กันการปลอมแปลง
 * ข้อมูลผู้ซื้อ (ชื่อ/อีเมล) ฝังอยู่ในโทเค็นเพื่อใช้สร้างลายน้ำตอนดาวน์โหลด
 * โดยไม่ต้องพึ่งฐานข้อมูล
 *
 * ค่าเริ่มต้น: ลิงก์ **ไม่มีวันหมดอายุ** (config.download.expiryHours = 0)
 * ตั้ง DOWNLOAD_EXPIRY_HOURS เป็นจำนวนบวกเมื่อไหร่ ระบบจะกลับมาฝัง exp และบังคับวันหมดอายุ
 */
export interface DownloadPayload {
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
  /**
   * รายชื่อไฟล์ที่โทเค็นนี้มีสิทธิ์ดาวน์โหลด (FileId จาก lib/catalog.ts)
   * โทเค็นรุ่นเก่าไม่มี field นี้ — ฝั่งตรวจสิทธิ์จะถือว่าเป็นชุด Mock เดิม (โจทย์+เฉลย)
   */
  files?: string[];
  /**
   * เวลาที่ออกลิงก์ (unix ms) — ฝั่งตรวจคำนวณวันหมดอายุจาก iat + ค่าปัจจุบันของร้าน
   * ทำแบบนี้เพื่อให้ "เปลี่ยนนโยบายอายุลิงก์" มีผลกับลิงก์ที่ออกไปแล้วด้วย
   * (เช่น ขยายจาก 3 เดือนเป็น 6 เดือน ลูกค้าเดิมได้ตามด้วยทันที ไม่ต้องขอลิงก์ใหม่)
   */
  iat?: number;
  /**
   * unix ms — วันหมดอายุแบบตายตัวของลิงก์รุ่นเก่า (ออกก่อนมี iat)
   * เก็บไว้อ่านอย่างเดียวเพื่อความเข้ากันได้ย้อนหลัง ลิงก์ใหม่ไม่ใช้แล้ว
   */
  exp?: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", config.download.secret).update(data).digest());
}

/**
 * fail closed: ถ้า DOWNLOAD_SECRET ไม่ปลอดภัย (ไม่ได้ตั้ง/สั้น/เป็น placeholder)
 * ให้หยุดทันที ดีกว่าปล่อยให้ใครก็ปลอมลิงก์ดาวน์โหลดไฟล์ฟรีได้
 *
 * อนุญาตให้ใช้ secret แบบ insecure ได้ "เฉพาะตอน dev" (NODE_ENV === "development") เท่านั้น
 * ที่อื่นทั้งหมด — production, staging, self-host, container ที่ไม่ได้ตั้ง NODE_ENV —
 * ถือว่ากำลังเสิร์ฟไฟล์จริง จึงต้องมี secret ที่ปลอดภัยเสมอ
 */
function assertSecureSecret(): void {
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && config.download.insecure) {
    throw new Error(
      "DOWNLOAD_SECRET ไม่ปลอดภัยหรือยังไม่ได้ตั้งค่า — ตั้งเป็นค่าสุ่มยาว (openssl rand -hex 32) ใน Environment Variables ก่อนใช้งานจริง"
    );
  }
}

/** เปิดใช้วันหมดอายุก็ต่อเมื่อตั้ง DOWNLOAD_EXPIRY_HOURS ไว้ (0 = ปิด ซึ่งเป็นค่าเริ่มต้น) */
function expiryEnabled(): boolean {
  return config.download.expiryHours !== 0;
}

export function createDownloadToken(
  payload: Omit<DownloadPayload, "exp" | "iat">
): string {
  assertSecureSecret();
  // ฝังเวลาที่ออกลิงก์เสมอ (แม้ตอนนี้ปิดวันหมดอายุอยู่) เผื่อวันหลังเปิดใช้
  const full: DownloadPayload = { ...payload, iat: Date.now() };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  return `${body}.${sign(body)}`;
}

export function verifyDownloadToken(token: string): DownloadPayload | null {
  assertSecureSecret();
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString()) as DownloadPayload;
    // ปิดวันหมดอายุอยู่ (DOWNLOAD_EXPIRY_HOURS=0) → ลิงก์ทุกใบใช้ได้ตลอด
    if (!expiryEnabled()) return payload;

    // ลิงก์ยุคใหม่: คิดวันหมดอายุจาก "เวลาที่ออก + นโยบายปัจจุบัน"
    // เปลี่ยนนโยบายเมื่อไหร่ ลิงก์ที่ออกไปแล้วได้ตามทันที
    if (typeof payload.iat === "number") {
      const expiresAt = payload.iat + config.download.expiryHours * 3600 * 1000;
      return Date.now() > expiresAt ? null : payload;
    }
    // ลิงก์รุ่นเก่าที่ฝังวันหมดอายุตายตัวไว้
    if (typeof payload.exp === "number" && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
