import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";

/**
 * ล็อกอินของลูกค้า (ด้วย Google ผ่าน Supabase Auth)
 *
 * แนวคิดเดียวกับหน้า /admin: ล็อกอินสำเร็จ → ออก "คุกกี้ที่เซ็นด้วย HMAC" ให้
 * ไม่เก็บ session ในฐานข้อมูล และไม่ต้องพก access token ของ Supabase ไปมา
 * (Supabase ใช้แค่ยืนยันกับ Google ว่าอีเมลนี้เป็นของคนที่กดล็อกอินจริง)
 *
 * สิทธิ์ทุกอย่าง (ห้องสอบ / ไฟล์ที่ซื้อ) ผูกกับ "อีเมล" ในตาราง orders
 * → ล็อกอินด้วยบัญชี Google อีเมลเดียวกับตอนสั่งซื้อ = เห็นคอร์สของตัวเอง
 *
 * ⚠️ รูปแบบ "<body>.<sig>" หน้าตาเหมือนโทเค็นดาวน์โหลด/โทเค็นห้องสอบ จึงต้องกันสวมสิทธิ์ 2 ชั้น:
 * ฝัง t:"user" ไว้ในเนื้อ และเซ็นด้วยกุญแจที่แยกออกมา (secret + ":user-session")
 * — เอาลิงก์ดาวน์โหลดในอีเมลมาปลอมเป็นคุกกี้ล็อกอินไม่ได้
 */

export const USER_COOKIE = "mrtpat3_user";
/** คุกกี้ชั่วคราวระหว่างพาไปหน้า Google (เก็บ PKCE verifier + หน้าที่จะกลับไป) */
export const OAUTH_COOKIE = "mrtpat3_oauth";

/** ล็อกอินค้างไว้ได้นานแค่ไหน — ลูกค้ากลับมาโหลดไฟล์/ดูผลได้โดยไม่ต้องล็อกอินบ่อย */
export const SESSION_DAYS = 180;

export interface UserSession {
  t: "user";
  email: string; // lowercase เสมอ
  name: string;
  picture: string;
  iat: number; // unix ms
  exp: number; // unix ms
}

export type SessionUser = Pick<UserSession, "email" | "name" | "picture">;

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", `${config.download.secret}:user-session`).update(data).digest());
}

/** secret ไม่ปลอดภัย (ไม่ได้ตั้ง/สั้น/placeholder) = ห้ามออกคุกกี้ล็อกอินนอกเครื่อง dev */
function secretUsable(): boolean {
  return process.env.NODE_ENV === "development" || !config.download.insecure;
}

export function createUserSession(
  user: SessionUser,
  nowMs: number = Date.now()
): { value: string; maxAge: number } {
  if (!secretUsable()) {
    throw new Error("DOWNLOAD_SECRET ไม่ปลอดภัยหรือยังไม่ได้ตั้งค่า — ออกคุกกี้ล็อกอินไม่ได้");
  }
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const payload: UserSession = {
    t: "user",
    email: user.email.trim().toLowerCase(),
    name: user.name.trim(),
    picture: user.picture,
    iat: nowMs,
    exp: nowMs + maxAge * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return { value: `${body}.${sign(body)}`, maxAge };
}

export function verifyUserSession(
  value: string | undefined | null,
  nowMs: number = Date.now()
): SessionUser | null {
  if (!value || !secretUsable()) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(fromB64url(body).toString()) as UserSession;
    if (p.t !== "user" || typeof p.email !== "string" || !p.email) return null;
    if (typeof p.exp !== "number" || nowMs > p.exp) return null;
    return { email: p.email, name: p.name ?? "", picture: p.picture ?? "" };
  } catch {
    return null;
  }
}

/**
 * กันเปิด redirect ไปเว็บอื่น (open redirect): รับเฉพาะ path ภายในเว็บเราเท่านั้น
 * เช่น "/my-courses", "/?buy=mock1" — ของแปลก ("//evil.com", "https://…") = กลับหน้าคอร์สของฉัน
 */
export function safeNextPath(next: string | null | undefined, fallback = "/my-courses"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next.slice(0, 500);
}
