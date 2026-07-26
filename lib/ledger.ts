import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";

/**
 * สมุดบัญชีรายรับรายจ่ายของร้าน (ตาราง ledger บน Supabase)
 *
 * รายรับจากการขายบนเว็บ **ไม่ต้องกรอก** — ระบบอ่านจากตาราง orders ให้เอง (lib/finance.ts)
 * ตารางนี้เก็บเฉพาะ "รายจ่าย" กับ "รายรับนอกเว็บ" ที่เจ้าของกรอกเองบนหน้า /admin
 */

export interface LedgerEntry {
  id: string;
  occurred_on: string; // YYYY-MM-DD
  kind: "income" | "expense";
  category: string;
  note: string;
  amount: number;
  created_at: string;
}

/** หมวดที่ให้เลือกบนหน้าเว็บ (พิมพ์หมวดใหม่เองก็ได้) */
export const EXPENSE_CATEGORIES = [
  "ค่าธรรมเนียม Stripe",
  "ค่าโฆษณา",
  "ค่าโดเมน",
  "ค่าโฮสต์ (Vercel)",
  "ค่าฐานข้อมูล (Supabase)",
  "ค่าอีเมล (Resend)",
  "ค่าจ้างงาน/ฟรีแลนซ์",
  "ค่าอุปกรณ์/ซอฟต์แวร์",
  "อื่น ๆ",
];

export const INCOME_CATEGORIES = ["ขายนอกเว็บ (โอนตรง)", "รับคืน/ส่วนลดค่าบริการ", "อื่น ๆ"];

/** dev ที่ยังไม่ได้ตั้ง Supabase — เก็บในหน่วยความจำพอให้เดินดูหน้าเว็บได้ */
const memoryStore = new Map<string, LedgerEntry>();

/** ตารางยังไม่ถูกสร้าง (ยังไม่ได้รัน supabase/migration-admin.sql) */
function isMissingTable(error: { message?: string; code?: string }): boolean {
  return error.code === "42P01" || Boolean(error.message?.includes("ledger"));
}

export class LedgerTableMissingError extends Error {
  constructor() {
    super("ยังไม่ได้สร้างตาราง ledger — รัน supabase/migration-admin.sql ใน Supabase ก่อน");
  }
}

export async function listLedger(): Promise<LedgerEntry[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [...memoryStore.values()].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
  }
  const { data, error } = await supabase
    .from("ledger")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    if (isMissingTable(error)) throw new LedgerTableMissingError();
    throw new Error(`อ่านสมุดบัญชีไม่สำเร็จ: ${error.message}`);
  }
  return (data as LedgerEntry[]) ?? [];
}

export async function addLedgerEntry(input: {
  occurredOn: string;
  kind: "income" | "expense";
  category: string;
  note?: string;
  amount: number;
}): Promise<LedgerEntry> {
  const entry: LedgerEntry = {
    id: randomUUID(),
    occurred_on: input.occurredOn,
    kind: input.kind,
    category: input.category,
    note: input.note ?? "",
    amount: input.amount,
    created_at: new Date().toISOString(),
  };
  const supabase = getSupabase();
  if (!supabase) {
    memoryStore.set(entry.id, entry);
    return entry;
  }
  const { error } = await supabase.from("ledger").insert(entry);
  if (error) {
    if (isMissingTable(error)) throw new LedgerTableMissingError();
    throw new Error(`บันทึกรายการไม่สำเร็จ: ${error.message}`);
  }
  return entry;
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    memoryStore.delete(id);
    return;
  }
  const { error } = await supabase.from("ledger").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) throw new LedgerTableMissingError();
    throw new Error(`ลบรายการไม่สำเร็จ: ${error.message}`);
  }
}
