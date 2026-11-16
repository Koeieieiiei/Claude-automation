/**
 * รูปแบบ "คำตอบ" ในห้องสอบ + กติกาตรวจ — ใช้ร่วมกันทั้ง client (กระดาษคำตอบ) และ server (ตรวจ/สถิติ)
 *
 * คำตอบหนึ่งข้อเป็นได้ 2 แบบ:
 *   - ข้อปรนัย: ตัวเลข 0..choices (0 = ยังไม่ตอบ) — แบบเดิมของ TPAT3 ทุกข้อ
 *   - ข้อตอบเป็นตัวเลข (เช่น A-Level ฟิสิกส์ ข้อ 26–30): ข้อความที่ผู้สอบพิมพ์ เช่น "2.9"
 *     ("" หรือ 0 = ยังไม่ตอบ — 0 คือค่าตั้งต้นของทุกช่องตอนเริ่มสอบ)
 *
 * ตรวจข้อตัวเลข: ปัดคำตอบของผู้สอบให้มีทศนิยมเท่ากับเฉลยแล้วต้องเท่ากัน
 *   เฉลย "2.9"  → 2.86–2.94 ถูก (ทศนิยม 1 ตำแหน่ง)
 *   เฉลย "42"   → 41.5–42.4 ถูก (จำนวนเต็ม)
 *   เฉลย "0.10" → 0.095–0.104 ถูก
 * (เฉลยเก็บเป็นข้อความตามตารางเฉลยในไฟล์ เพื่อรักษาจำนวนทศนิยม เช่น "0.10")
 *
 * import ได้ทั้ง client และ server — ห้ามมีเฉลยในไฟล์นี้
 */
import type { ExamDef } from "./exams";

export type ExamAnswer = number | string;

/** ข้อนี้เป็นข้อตอบเป็นตัวเลขไหม (ตามช่วง exam.numeric) */
export function isNumericQuestion(exam: ExamDef, no: number): boolean {
  return Boolean(exam.numeric && no >= exam.numeric.from && no <= exam.numeric.to);
}

/** ตอบข้อนี้แล้วหรือยัง */
export function isAnswered(a: ExamAnswer | null | undefined): boolean {
  if (typeof a === "string") return a.trim() !== "";
  return typeof a === "number" && a > 0;
}

export function countAnswered(answers: ExamAnswer[]): number {
  return answers.filter(isAnswered).length;
}

/** กระดาษคำตอบว่างของสนามนี้ */
export function emptyAnswers(exam: ExamDef): ExamAnswer[] {
  return Array.from({ length: exam.totalQuestions }, (_, i) => (isNumericQuestion(exam, i + 1) ? "" : 0));
}

/** ตัวเลขที่ยอมให้พิมพ์ระหว่างพิมพ์ (ยังไม่ครบก็ได้ เช่น "-", "2.") — ยาวสุด 12 ตัวอักษร */
const NUMERIC_DRAFT = /^-?\d{0,8}(?:\.\d{0,6})?$/;

/** ทำความสะอาดข้อความที่ผู้สอบพิมพ์ในช่องตัวเลข: ตัดช่องว่าง, จุลภาคเป็นจุด — คืน null ถ้าไม่ใช่ตัวเลข */
export function cleanNumericInput(raw: string): string | null {
  const v = raw.replace(/\s+/g, "").replace(/,/g, ".");
  return NUMERIC_DRAFT.test(v) ? v : null;
}

/** แปลงข้อความเป็นตัวเลข (คืน null ถ้าว่าง/ไม่ครบ เช่น "-" หรือ ".") */
export function parseNumeric(v: string): number | null {
  if (!/\d/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function decimalsOf(v: string): number {
  const i = v.indexOf(".");
  return i < 0 ? 0 : v.length - i - 1;
}

/** ตรวจคำตอบหนึ่งข้อกับเฉลย */
export function isCorrectAnswer(my: ExamAnswer | null | undefined, key: ExamAnswer): boolean {
  if (typeof key === "number") return my === key; // ข้อปรนัย
  if (typeof my !== "string") return false;
  const mine = parseNumeric(my.trim());
  const want = parseNumeric(key);
  if (mine === null || want === null) return false;
  const scale = 10 ** decimalsOf(key);
  // บวกเศษเล็ก ๆ กันเลขทศนิยมของเครื่อง (เช่น 0.10 × 100 = 10.000000000000002)
  return Math.round(mine * scale + 1e-9) === Math.round(want * scale + 1e-9);
}

/**
 * ตรวจรูปแบบกระดาษคำตอบที่ส่งมาจากหน้าเว็บ — ผิดรูปแบบ = null (ไม่บันทึก)
 * ข้อปรนัยรับ 0..choices · ข้อตัวเลขรับข้อความตัวเลข (0 / "" = ไม่ตอบ)
 */
export function sanitizeAnswers(exam: ExamDef, raw: unknown): ExamAnswer[] | null {
  if (!Array.isArray(raw) || raw.length !== exam.totalQuestions) return null;
  const out: ExamAnswer[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (isNumericQuestion(exam, i + 1)) {
      if (v === 0 || v === "" || v === null) {
        out.push("");
        continue;
      }
      const s = typeof v === "number" ? String(v) : v;
      if (typeof s !== "string") return null;
      const clean = cleanNumericInput(s);
      if (clean === null) return null;
      out.push(clean);
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > exam.choices) return null;
    out.push(n);
  }
  return out;
}
