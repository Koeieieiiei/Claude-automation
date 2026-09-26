import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

/**
 * โทเค็นในลิงก์ "ตั้งรหัสผ่าน" ที่ส่งทางอีเมล — เซ็นด้วย HMAC แบบเดียวกับคุกกี้ล็อกอิน
 * แต่ใช้กุญแจแยก (secret + ":password-reset") และฝัง t:"reset" → เอาคุกกี้/ลิงก์ดาวน์โหลดมาสวมไม่ได้
 *
 * อายุ 30 นาที · ใช้แล้วใช้ซ้ำไม่ได้: ฝั่งตั้งรหัสเทียบ iat กับ passwordUpdatedAt ของบัญชี
 * (ลิงก์ที่ออกก่อนการตั้งรหัสครั้งล่าสุด = หมดสภาพ) จึงไม่ต้องเก็บสถานะโทเค็นที่ไหน
 */
export const RESET_TOKEN_MINUTES = 30;

export interface ResetPayload {
  t: "reset";
  email: string;
  iat: number; // unix ms
  exp: number; // unix ms
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", `${config.download.secret}:password-reset`).update(data).digest());
}

function secretUsable(): boolean {
  return process.env.NODE_ENV === "development" || !config.download.insecure;
}

export function createResetToken(email: string, nowMs: number = Date.now()): string {
  if (!secretUsable()) {
    throw new Error("DOWNLOAD_SECRET ไม่ปลอดภัยหรือยังไม่ได้ตั้งค่า — ออกลิงก์ตั้งรหัสผ่านไม่ได้");
  }
  const payload: ResetPayload = {
    t: "reset",
    email: email.trim().toLowerCase(),
    iat: nowMs,
    exp: nowMs + RESET_TOKEN_MINUTES * 60 * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function verifyResetToken(token: string | null | undefined, nowMs: number = Date.now()): ResetPayload | null {
  if (!token || !secretUsable()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(fromB64url(body).toString()) as ResetPayload;
    if (p.t !== "reset" || typeof p.email !== "string" || !p.email) return null;
    if (typeof p.iat !== "number" || typeof p.exp !== "number" || nowMs > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}
