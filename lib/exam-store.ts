import fs from "fs";
import path from "path";
import { EXAM, GRACE_MS, Difficulty, questionWeight, roundScore } from "./exam-config";

/**
 * ที่เก็บข้อมูลระบบทำข้อสอบ — เวอร์ชัน "แบบจำลอง" เก็บเป็นไฟล์ JSON ใน data/exam/
 *
 * ⚠️ ใช้ได้เฉพาะรันในเครื่อง (next dev / next start บนเครื่องเดียว) เท่านั้น
 * บน Vercel serverless ดิสก์เป็นแบบชั่วคราว ข้อมูลจะหาย — ก่อนขึ้น production จริง
 * ต้องย้ายไป Supabase (ดูโครงตารางเตรียมไว้ที่ supabase/exam-schema.sql)
 * โค้ดส่วนอื่นเรียกผ่านฟังก์ชันในไฟล์นี้เท่านั้น จึงสลับที่เก็บได้โดยไม่แตะหน้าเว็บ/API
 *
 * ไฟล์ที่ใช้:
 *   data/exam/answer-key.json   เฉลย+ความยากรายข้อ (สร้างโดย scripts/build-exam-assets.py)
 *   data/exam/population.json   ประชากรจำลองไว้โชว์สถิติ (DEMO — สร้างโดยสคริปต์เดียวกัน)
 *   data/exam/demo-buyers.json  ผู้ซื้อจำลองจากหน้า /exam/demo (ไม่แตะตาราง orders จริง)
 *   data/exam/attempts.json     การสอบของแต่ละอีเมล (1 อีเมล = 1 รอบ)
 */

const DATA_DIR = path.join(process.cwd(), "data", "exam");
const ATTEMPTS_FILE = path.join(DATA_DIR, "attempts.json");
const BUYERS_FILE = path.join(DATA_DIR, "demo-buyers.json");
const KEY_FILE = path.join(DATA_DIR, "answer-key.json");
const POPULATION_FILE = path.join(DATA_DIR, "population.json");

export interface ExamAttempt {
  email: string; // lowercase — ใช้เป็น key
  firstName: string;
  lastName: string;
  orderId: string;
  startedAt: string; // ISO — เวลาเริ่มนับถอยหลัง (ฝั่ง server เป็นคนกำหนด)
  submittedAt: string | null;
  answers: number[]; // ยาว 70 — 0 = ยังไม่ตอบ, 1-5 = ช้อยส์ที่เลือก
  correctCount: number | null; // คิดตอนส่งข้อสอบ
  score: number | null; // คะแนนถ่วงน้ำหนัก เต็ม 100 (ข้อ 1-60 × 4/3, ข้อ 61-70 × 2)
}

export interface DemoBuyer {
  email: string;
  firstName: string;
  lastName: string;
  orderId: string;
  createdAt: string;
}

interface AnswerKeyEntry {
  answer: number;
  difficulty: Difficulty;
}

interface PopulationData {
  nStudents: number;
  scoresRaw: number[]; // จำนวนข้อถูก (0-70) ของนักเรียนจำลองแต่ละคน
  scoresWeighted: number[]; // คะแนนถ่วงน้ำหนัก (เต็ม 100) ของแต่ละคน
  perQuestionCorrect: Record<string, number>;
}

/* ---------- อ่าน/เขียนไฟล์ (sync — โหลดต่ำพอสำหรับรันในเครื่อง) ---------- */

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file); // เขียนแบบ atomic กันไฟล์พังถ้าโปรเซสดับกลางคัน
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * อีเมลเจ้าของร้าน — ยกเว้นกติกาปกติเพื่อใช้ทดสอบระบบได้ตลอด:
 * เข้าสอบได้เสมอ (ไม่ต้องมีคำสั่งซื้อ) + ทำซ้ำได้ไม่จำกัด (เริ่มรอบใหม่ = แทนที่รอบเก่า)
 */
const UNLIMITED_ATTEMPT_EMAILS = new Set(["marcoco9no.1@gmail.com"]);

export function isUnlimitedEmail(email: string): boolean {
  return UNLIMITED_ATTEMPT_EMAILS.has(normalizeEmail(email));
}

/* ---------- เฉลย ---------- */

let keyCache: Record<string, AnswerKeyEntry> | null = null;

export function getAnswerKey(): Record<string, AnswerKeyEntry> {
  if (!keyCache) {
    keyCache = readJson<Record<string, AnswerKeyEntry> | null>(KEY_FILE, null);
    if (!keyCache || Object.keys(keyCache).length !== EXAM.totalQuestions) {
      throw new Error(
        "ไม่พบไฟล์เฉลย data/exam/answer-key.json — รัน `python scripts/build-exam-assets.py` ก่อน"
      );
    }
  }
  return keyCache;
}

/* ---------- ผู้ซื้อจำลอง (demo) ---------- */

export function listDemoBuyers(): DemoBuyer[] {
  return Object.values(readJson<Record<string, DemoBuyer>>(BUYERS_FILE, {}));
}

export function getDemoBuyer(email: string): DemoBuyer | null {
  const all = readJson<Record<string, DemoBuyer>>(BUYERS_FILE, {});
  return all[normalizeEmail(email)] ?? null;
}

export function grantDemoBuyer(input: {
  email: string;
  firstName: string;
  lastName: string;
}): DemoBuyer {
  const all = readJson<Record<string, DemoBuyer>>(BUYERS_FILE, {});
  const email = normalizeEmail(input.email);
  const buyer: DemoBuyer = {
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    orderId: all[email]?.orderId ?? `demo-${Date.now().toString(36)}`,
    createdAt: all[email]?.createdAt ?? new Date().toISOString(),
  };
  all[email] = buyer;
  writeJson(BUYERS_FILE, all);
  return buyer;
}

export function removeDemoBuyer(email: string): void {
  const all = readJson<Record<string, DemoBuyer>>(BUYERS_FILE, {});
  delete all[normalizeEmail(email)];
  writeJson(BUYERS_FILE, all);
}

/**
 * เช็คสิทธิ์เข้าห้องสอบของอีเมลนี้
 * เวอร์ชันแบบจำลอง: ดูจากรายชื่อผู้ซื้อจำลองเท่านั้น (ไม่แตะตาราง orders จริง)
 * TODO ก่อนขึ้น production: เพิ่มการเช็คจากตาราง orders (ต้องเพิ่มคอลัมน์ product_id ก่อน
 * เพราะสิทธิ์ทำข้อสอบมีเฉพาะสินค้าที่มีชุด Mock — ดู supabase/exam-schema.sql)
 */
export function findEntitlement(email: string): DemoBuyer | null {
  return getDemoBuyer(email);
}

/* ---------- การสอบ ---------- */

function readAttempts(): Record<string, ExamAttempt> {
  return readJson<Record<string, ExamAttempt>>(ATTEMPTS_FILE, {});
}

export function getAttempt(email: string): ExamAttempt | null {
  return readAttempts()[normalizeEmail(email)] ?? null;
}

export function deleteAttempt(email: string): void {
  const all = readAttempts();
  delete all[normalizeEmail(email)];
  writeJson(ATTEMPTS_FILE, all);
}

export function examDeadline(attempt: ExamAttempt): number {
  return new Date(attempt.startedAt).getTime() + EXAM.durationMinutes * 60 * 1000;
}

export type AttemptState = "none" | "in_progress" | "submitted";

/**
 * สถานะการสอบของอีเมลนี้ — มีผลข้างเคียงโดยตั้งใจ: ถ้าหมดเวลา (เลย grace) แล้วยังไม่ส่ง
 * จะปิดการสอบให้อัตโนมัติด้วยคำตอบล่าสุดที่บันทึกไว้ (กติกาเดียวกับห้องสอบจริง)
 */
export function getAttemptState(email: string): { state: AttemptState; attempt: ExamAttempt | null } {
  const attempt = getAttempt(email);
  if (!attempt) return { state: "none", attempt: null };
  if (attempt.submittedAt) return { state: "submitted", attempt };
  if (Date.now() > examDeadline(attempt) + GRACE_MS) {
    const finalized = submitAttempt(email, attempt.answers, { auto: true });
    return { state: "submitted", attempt: finalized };
  }
  return { state: "in_progress", attempt };
}

/** เริ่มสอบ (สร้างได้ครั้งเดียวต่ออีเมล) — คืน attempt เดิมถ้าเริ่มไปแล้ว */
export function startAttempt(buyer: {
  email: string;
  firstName: string;
  lastName: string;
  orderId: string;
}): ExamAttempt {
  const all = readAttempts();
  const email = normalizeEmail(buyer.email);
  if (all[email]) return all[email];

  const attempt: ExamAttempt = {
    email,
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    orderId: buyer.orderId,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    answers: Array(EXAM.totalQuestions).fill(0),
    correctCount: null,
    score: null,
  };
  all[email] = attempt;
  writeJson(ATTEMPTS_FILE, all);
  return attempt;
}

function sanitizeAnswers(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== EXAM.totalQuestions) return null;
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > EXAM.choices) return null;
    out.push(n);
  }
  return out;
}

/** บันทึกคำตอบระหว่างสอบ (autosave) — รับเฉพาะช่วงยังไม่หมดเวลา */
export function saveAnswers(email: string, rawAnswers: unknown): { ok: boolean; reason?: string } {
  const answers = sanitizeAnswers(rawAnswers);
  if (!answers) return { ok: false, reason: "รูปแบบคำตอบไม่ถูกต้อง" };

  const all = readAttempts();
  const attempt = all[normalizeEmail(email)];
  if (!attempt) return { ok: false, reason: "ยังไม่ได้เริ่มสอบ" };
  if (attempt.submittedAt) return { ok: false, reason: "ส่งข้อสอบไปแล้ว" };
  if (Date.now() > examDeadline(attempt) + GRACE_MS) return { ok: false, reason: "หมดเวลาสอบแล้ว" };

  attempt.answers = answers;
  writeJson(ATTEMPTS_FILE, all);
  return { ok: true };
}

/** ส่งข้อสอบ + ตรวจ — เรียกซ้ำไม่ตรวจซ้ำ (คืนผลเดิม) */
export function submitAttempt(
  email: string,
  rawAnswers: unknown,
  opts: { auto?: boolean } = {}
): ExamAttempt {
  const all = readAttempts();
  const attempt = all[normalizeEmail(email)];
  if (!attempt) throw new Error("ยังไม่ได้เริ่มสอบ");
  if (attempt.submittedAt) return attempt;

  // ถ้าคำขอส่งมาหลังหมดเวลา (เลย grace) ให้ใช้คำตอบที่ autosave ไว้แทนชุดที่ส่งมา
  const late = Date.now() > examDeadline(attempt) + GRACE_MS;
  const answers = late ? attempt.answers : (sanitizeAnswers(rawAnswers) ?? attempt.answers);

  const key = getAnswerKey();
  let correct = 0;
  let score = 0;
  for (let q = 1; q <= EXAM.totalQuestions; q++) {
    if (answers[q - 1] === key[String(q)].answer) {
      correct++;
      score += questionWeight(q);
    }
  }

  attempt.answers = answers;
  attempt.correctCount = correct;
  attempt.score = roundScore(score);
  attempt.submittedAt = new Date().toISOString();
  if (opts.auto) {
    // ปิดอัตโนมัติเพราะหมดเวลา — ประทับเวลา ณ เส้นตาย ไม่ใช่เวลาที่บังเอิญมีคนมา trigger
    attempt.submittedAt = new Date(examDeadline(attempt)).toISOString();
  }
  writeJson(ATTEMPTS_FILE, all);
  return attempt;
}

/* ---------- สถิติภาพรวม ---------- */

export interface ExamStatistics {
  nTotal: number; // จำนวนผู้สอบทั้งหมด (ประชากรจำลอง + ผู้สอบจริงที่ส่งแล้ว)
  mean: number; // ทุกค่าอยู่บนสเกลคะแนนถ่วงน้ำหนัก เต็ม 100
  sd: number;
  min: number;
  max: number;
  rank: number; // อันดับของคะแนนที่ส่งเข้ามา (1 = สูงสุด)
  histogram: { from: number; to: number; count: number; mine: boolean }[]; // ช่วงละ 10 คะแนน
  perQuestionPctCorrect: Record<string, number>; // % คนตอบถูกรายข้อ (0-100)
}

/**
 * สถิติเทียบกับผู้สอบทุกคน = ประชากรจำลอง (DEMO) + ทุก attempt จริงที่ส่งแล้วในเครื่องนี้
 * ทุกตัวเลขคิดบนคะแนนถ่วงน้ำหนัก (เต็ม 100)
 * หมายเหตุ: ตอนขึ้น production ต้องตัดสินใจว่าจะใช้ข้อมูลจำลองปนหรือใช้ผู้สอบจริงล้วน
 */
export function computeStatistics(myScore: number): ExamStatistics {
  const pop = readJson<PopulationData | null>(POPULATION_FILE, null);
  if (!pop || !pop.scoresWeighted) {
    throw new Error(
      "ไม่พบไฟล์ประชากร data/exam/population.json (เวอร์ชันคะแนนเต็ม 100) — รัน `python scripts/build-exam-assets.py` ก่อน"
    );
  }

  const realAttempts = Object.values(readAttempts()).filter((a) => a.submittedAt);
  const scores = [...pop.scoresWeighted, ...realAttempts.map((a) => a.score ?? 0)];

  const n = scores.length;
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const rank = 1 + scores.filter((v) => v > myScore).length;

  // ฮิสโตแกรม 10 ช่วง ช่วงละ 10 คะแนน (0-10, 10-20, …, 90-100)
  const binSize = 10;
  const binOf = (score: number) => Math.min(9, Math.max(0, Math.floor(score / binSize)));
  const myBin = binOf(myScore);
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    from: i * binSize,
    to: (i + 1) * binSize,
    count: 0,
    mine: i === myBin,
  }));
  for (const s of scores) histogram[binOf(s)].count++;

  const nAll = pop.nStudents + realAttempts.length;
  const perQuestionPctCorrect: Record<string, number> = {};
  for (let q = 1; q <= EXAM.totalQuestions; q++) {
    const fromPop = pop.perQuestionCorrect[String(q)] ?? 0;
    const key = getAnswerKey();
    const fromReal = realAttempts.filter((a) => a.answers[q - 1] === key[String(q)].answer).length;
    perQuestionPctCorrect[String(q)] = Math.round(((fromPop + fromReal) * 1000) / nAll) / 10;
  }

  return {
    nTotal: n,
    mean: roundScore(mean),
    sd: roundScore(sd),
    min: roundScore(Math.min(...scores)),
    max: roundScore(Math.max(...scores)),
    rank,
    histogram,
    perQuestionPctCorrect,
  };
}
