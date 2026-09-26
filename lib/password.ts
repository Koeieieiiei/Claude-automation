import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * เข้ารหัสรหัสผ่านด้วย scrypt (มีใน Node เอง ไม่ต้องลง dependency เพิ่ม)
 * รูปแบบที่เก็บ: scrypt$N$r$p$<salt base64>$<hash base64> — ฝังพารามิเตอร์ไว้ในตัว
 * วันหลังอยากเพิ่มความแข็งแรง เปลี่ยน N ได้ โดยรหัสเก่ายังตรวจได้เพราะอ่านค่าจากในสตริง
 *
 * ค่า N=16384 r=8 p=1 keylen=64 = ค่าที่ libsodium/OWASP แนะนำสำหรับล็อกอินทั่วไป (~50 ms ต่อครั้ง)
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024; // 128·N·r = 16 MB ต้องต่ำกว่านี้ (default 32 MB ก็พอ เผื่อไว้)

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** ตรวจรหัสผ่านกับค่าที่เก็บไว้ — คืน false ถ้ารูปแบบเพี้ยน (ไม่ throw ไม่ให้ล้มทั้งคำขอ) */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** กติการหัสผ่าน (ใช้ทั้งตอนสมัครและตั้งใหม่) — คืนข้อความผิดพลาดภาษาไทย หรือ null ถ้าผ่าน */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "กรุณากรอกรหัสผ่าน";
  if (password.length < PASSWORD_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`;
  if (password.length > PASSWORD_MAX) return `รหัสผ่านยาวเกิน ${PASSWORD_MAX} ตัวอักษร`;
  return null;
}
