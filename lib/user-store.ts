import { createHash } from "crypto";
import { getSupabase } from "./supabase";
import { config } from "./config";
import { hashPassword, verifyPassword } from "./password";

/**
 * บัญชีผู้ใช้ (อีเมล + รหัสผ่าน) — เปลี่ยนจากล็อกอิน Google 2026-09-26 (เจ้าของสั่ง: Google ยืนยันหลายขั้นเกิน)
 *
 * เก็บเป็นไฟล์ JSON ต่อคนใน Supabase Storage บักเก็ตส่วนตัว (แบบเดียวกับผลสอบใน lib/exam-store.ts)
 *   auth/users/<sha256(email)>.json = { email, passwordHash, createdAt, passwordUpdatedAt }
 * เหตุผลที่ไม่ใช้ Supabase Auth: โปรเจกต์ปิด "Email logins" ไว้ (signInWithPassword ตอบ
 * "Email logins are disabled") และเจ้าของแก้ Dashboard เองไม่ถนัด — ที่เก็บนี้ไม่ต้องรัน migration/ตั้งค่าอะไรเพิ่ม
 * รหัสผ่านเก็บเป็น scrypt hash เท่านั้น (lib/password.ts) ไม่มีที่ไหนเก็บรหัสจริง
 *
 * ไม่มี Supabase (ตอนเทสต์/dev เปล่า) → เก็บในหน่วยความจำ หายเมื่อรีสตาร์ท
 */
export interface UserRecord {
  email: string; // lowercase เสมอ
  passwordHash: string;
  createdAt: string; // ISO
  passwordUpdatedAt: string; // ISO — ใช้ทำให้ลิงก์ตั้งรหัสผ่านที่ออกก่อนหน้านี้ใช้ซ้ำไม่ได้
}

const memory = new Map<string, UserRecord>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  // เช็คโครงพอประมาณ (มี @ และโดเมนมีจุด) — ความถูกต้องจริงพิสูจน์ตอนกดลิงก์ในอีเมล (ลืมรหัสผ่าน)
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function storageKey(email: string): string {
  return `auth/users/${createHash("sha256").update(normalizeEmail(email)).digest("hex")}.json`;
}

function isNotFound(error: { message?: string; status?: number; statusCode?: string | number }): boolean {
  return (
    error.status === 404 ||
    error.statusCode === 404 ||
    error.statusCode === "404" ||
    /not.?found/i.test(error.message ?? "")
  );
}

function isDuplicate(error: { message?: string; status?: number; statusCode?: string | number }): boolean {
  return (
    error.status === 409 ||
    error.statusCode === 409 ||
    error.statusCode === "409" ||
    /already exists|duplicate/i.test(error.message ?? "")
  );
}

export async function getUser(email: string): Promise<UserRecord | null> {
  const clean = normalizeEmail(email);
  const supabase = getSupabase();
  if (!supabase) return memory.get(clean) ?? null;
  const { data, error } = await supabase.storage.from(config.supabase.bucket).download(storageKey(clean));
  if (error || !data) {
    if (error && !isNotFound(error)) throw new Error(`อ่านบัญชีผู้ใช้ไม่สำเร็จ: ${error.message}`);
    return null;
  }
  try {
    const rec = JSON.parse(await data.text()) as UserRecord;
    return rec && typeof rec.passwordHash === "string" ? rec : null;
  } catch {
    return null;
  }
}

async function put(rec: UserRecord, opts: { create: boolean }): Promise<"ok" | "exists"> {
  const supabase = getSupabase();
  if (!supabase) {
    if (opts.create && memory.has(rec.email)) return "exists";
    memory.set(rec.email, rec);
    return "ok";
  }
  // สมัครใหม่: upsert=false → ถ้ามีไฟล์อยู่แล้ว Storage ปฏิเสธให้เอง (กันสมัครซ้ำพร้อมกันสองคำขอ)
  // cacheControl "0" เสมอ — ค่าเริ่มต้นแคช 1 ชม. จะทำให้เปลี่ยนรหัสผ่านแล้วยังตรวจกับ hash เก่า
  const { error } = await supabase.storage
    .from(config.supabase.bucket)
    .upload(storageKey(rec.email), JSON.stringify(rec), {
      contentType: "application/json",
      upsert: !opts.create,
      cacheControl: "0",
    });
  if (error) {
    if (opts.create && isDuplicate(error)) return "exists";
    throw new Error(`บันทึกบัญชีผู้ใช้ไม่สำเร็จ: ${error.message}`);
  }
  return "ok";
}

/** สมัครสมาชิก — คืน "exists" ถ้าอีเมลนี้มีบัญชีแล้ว (ไม่เขียนทับ) */
export async function createUser(email: string, password: string): Promise<{ status: "ok" | "exists"; user: UserRecord }> {
  const clean = normalizeEmail(email);
  const existing = await getUser(clean);
  if (existing) return { status: "exists", user: existing };
  const now = new Date().toISOString();
  const rec: UserRecord = { email: clean, passwordHash: await hashPassword(password), createdAt: now, passwordUpdatedAt: now };
  const status = await put(rec, { create: true });
  return { status, user: status === "ok" ? rec : (await getUser(clean)) ?? rec };
}

/** ตั้งรหัสผ่านใหม่ (จากลิงก์ในอีเมล) — ไม่มีบัญชีก็สร้างให้เลย เพราะพิสูจน์แล้วว่าเป็นเจ้าของอีเมล */
export async function setPassword(email: string, password: string): Promise<UserRecord> {
  const clean = normalizeEmail(email);
  const existing = await getUser(clean);
  const now = new Date().toISOString();
  const rec: UserRecord = {
    email: clean,
    passwordHash: await hashPassword(password),
    createdAt: existing?.createdAt ?? now,
    passwordUpdatedAt: now,
  };
  await put(rec, { create: false });
  return rec;
}

/** ตรวจอีเมล+รหัสผ่าน — คืนบัญชีถ้าถูก, null ถ้าไม่มีบัญชีหรือรหัสผิด (ใช้เวลาใกล้เคียงกันทั้งสองกรณี) */
export async function authenticate(email: string, password: string): Promise<UserRecord | null> {
  const user = await getUser(email);
  // ไม่มีบัญชี: ตรวจกับ hash หลอกให้ใช้เวลาเท่ากัน คนนอกจะได้เดาไม่ได้ว่าอีเมลไหนมีบัญชี
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
}

// hash ของสตริงสุ่ม — ไม่มีรหัสผ่านไหนตรง ใช้ถ่วงเวลาเฉย ๆ
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** ลบบัญชี (ใช้ในสคริปต์ทดสอบ/ดูแลระบบเท่านั้น) */
export async function deleteUser(email: string): Promise<void> {
  const clean = normalizeEmail(email);
  const supabase = getSupabase();
  if (!supabase) {
    memory.delete(clean);
    return;
  }
  await supabase.storage.from(config.supabase.bucket).remove([storageKey(clean)]);
}
