import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

/**
 * โทเค็นดาวน์โหลดแบบเซ็นด้วย HMAC — กันการปลอมแปลง
 * ข้อมูลผู้ซื้อ (ชื่อ/อีเมล) ฝังอยู่ในโทเค็นเพื่อใช้สร้างลายน้ำตอนดาวน์โหลด
 * โดยไม่ต้องพึ่งฐานข้อมูล และมีวันหมดอายุในตัว
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
  exp: number; // unix ms
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

export function createDownloadToken(payload: Omit<DownloadPayload, "exp">): string {
  assertSecureSecret();
  const full: DownloadPayload = {
    ...payload,
    exp: Date.now() + config.download.expiryHours * 3600 * 1000,
  };
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
    if (Date.now() > payload.exp) return null; // หมดอายุ
    return payload;
  } catch {
    return null;
  }
}
