import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { getSupabase } from "./supabase";
import { getStripe } from "./stripe";
import { config } from "./config";
import { PRODUCTS } from "./catalog";
import { GRACE_MS, Difficulty, roundScore } from "./exam-config";
import { ExamDef, questionWeight } from "./exams";

/**
 * ที่เก็บข้อมูลระบบทำข้อสอบ — ทุกอย่างแยกตาม "สนามสอบ" (ExamDef จาก lib/exams.ts)
 *
 * production (Vercel): เก็บบน Supabase Storage ทั้งหมด — ดิสก์ของ serverless เขียนไม่ได้
 * และหายทุกครั้งที่ instance เปลี่ยน จึงห้ามพึ่งไฟล์ในเครื่อง
 *   ebooks/exam/<examId>/answer-key.json      เฉลย + ระดับความยากรายข้อ
 *   ebooks/exam/<examId>/population.json      ประชากรอ้างอิงสำหรับสถิติ
 *   ebooks/exam/<examId>/pages/page-NN.png    รูปหน้าโจทย์ (เสิร์ฟผ่าน API ที่เช็คสิทธิ์)
 *   ebooks/exam/<examId>/attempts/<hash>.json การสอบของแต่ละอีเมล (hash = sha256 ของอีเมล)
 *   ebooks/exam/<examId>/aggregate.json       ผลรวมของผู้สอบจริง ไว้คิดสถิติเร็ว ๆ
 *
 * ตอนรันในเครื่องที่ยังไม่ตั้งค่า Supabase: ใช้ไฟล์ data/exam/<examId>/ และ
 * assets/exam-pages/<examId>/ แทน (สร้างด้วย scripts/build-exam-assets.py แล้วอัป
 * ขึ้น Storage ด้วย scripts/upload-exam-assets.mjs)
 *
 * สิทธิ์เข้าสอบมาจากตาราง orders จริง — ดู findEntitlementByEmail()
 * กติกา "1 อีเมล 1 รอบ" นับแยกต่อสนาม: สอบ TPAT3 แล้วยังสอบสนามอื่นได้
 */

const DATA_ROOT = path.join(process.cwd(), "data", "exam");
const PAGES_ROOT = path.join(process.cwd(), "assets", "exam-pages");
const BUYERS_FILE = path.join(DATA_ROOT, "demo-buyers.json"); // ผู้ซื้อจำลอง — ใช้ร่วมทุกสนาม

const sKey = (exam: ExamDef) => `exam/${exam.id}/answer-key.json`;
const sPop = (exam: ExamDef) => `exam/${exam.id}/population.json`;
const sAgg = (exam: ExamDef) => `exam/${exam.id}/aggregate.json`;
const sAttempt = (exam: ExamDef, email: string) =>
  `exam/${exam.id}/attempts/${createHash("sha256").update(normalizeEmail(email)).digest("hex")}.json`;
export const storagePagePath = (exam: ExamDef, pageNo: number) =>
  `exam/${exam.id}/pages/page-${String(pageNo).padStart(2, "0")}.png`;

const localAttemptsFile = (exam: ExamDef) => path.join(DATA_ROOT, exam.id, "attempts.json");
const localDataFile = (exam: ExamDef, name: string) => path.join(DATA_ROOT, exam.id, name);
const localPageFile = (exam: ExamDef, pageNo: number) =>
  path.join(PAGES_ROOT, exam.id, `page-${String(pageNo).padStart(2, "0")}.png`);

export interface ExamAttempt {
  examId?: string; // ข้อมูลรุ่นแรก (ก่อนมีหลายสนาม) ไม่มี field นี้ = สนามหลัก
  email: string; // lowercase — ใช้เป็น key
  firstName: string;
  lastName: string;
  orderId: string;
  startedAt: string; // ISO — เวลาเริ่มนับถอยหลัง (server เป็นคนกำหนด)
  submittedAt: string | null;
  answers: number[]; // 0 = ยังไม่ตอบ, 1..choices = ช้อยส์ที่เลือก
  correctCount: number | null;
  score: number | null; // คะแนนถ่วงน้ำหนัก (เต็ม exam.maxScore)
}

export interface Entitlement {
  email: string;
  firstName: string;
  lastName: string;
  orderId: string;
}

interface AnswerKeyEntry {
  answer: number;
  difficulty: Difficulty;
}

interface PopulationData {
  nStudents: number;
  scoresWeighted: number[];
  perQuestionCorrect: Record<string, number>;
}

/** ผลรวมของผู้สอบจริง — อัปเดตตอนส่งข้อสอบ ไม่ต้องไล่อ่านไฟล์ทุกคนตอนคิดสถิติ */
interface Aggregate {
  scores: number[];
  perQuestionCorrect: Record<string, number>;
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

/** เปิดเครื่องมือจำลองการซื้อ (หน้า /exam/demo) — ห้ามเปิดบน production */
export function demoEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.EXAM_DEMO === "1";
}

/* ================= อ่าน/เขียน Storage (มี fallback เป็นไฟล์ local ตอน dev) ================= */

function readLocalJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file); // atomic กันไฟล์พังถ้าโปรเซสดับกลางคัน
}

async function storageGetJson<T>(key: string): Promise<T | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from(config.supabase.bucket).download(key);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return null;
  }
}

/**
 * เขียนข้อมูลที่ "เปลี่ยนได้ตลอด" (ผลสอบ/สถิติรวม) ลง Storage
 *
 * ⚠️ ต้องสั่ง cacheControl: "0" เสมอ — ค่าเริ่มต้นของ Supabase คือแคช 1 ชั่วโมง
 * ซึ่งทำให้อ่านค่าเก่ากลับมาได้ (เคยเจอจริง: ลบไฟล์ผลสอบแล้วยังดาวน์โหลดเจอ
 * ทำให้ "เริ่มสอบรอบใหม่" ไม่ทำงาน และผลรวมสถิติมีสิทธิ์ตกหล่น)
 */
async function storagePutJson(key: string, value: unknown): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase — บันทึกข้อมูลสอบไม่ได้");
  const { error } = await supabase.storage
    .from(config.supabase.bucket)
    .upload(key, JSON.stringify(value), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    });
  if (error) throw new Error(`บันทึกข้อมูลสอบไม่สำเร็จ: ${error.message}`);
}

/** ค่าที่เขียนทับก่อนลบไฟล์ — กันกรณีแคชยังจ่ายไฟล์เก่าหลังลบ (ดูหมายเหตุใน storagePutJson) */
const TOMBSTONE = { deleted: true } as const;

async function storageRemove(key: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // เขียนทับด้วย tombstone (ไม่แคช) ก่อน แล้วค่อยลบจริง — ถ้าแคชยังจ่ายของเก่า
  // สิ่งที่ได้จะเป็น tombstone ซึ่งฝั่งอ่านตีความว่า "ไม่มีข้อมูล" อยู่แล้ว
  try {
    await storagePutJson(key, TOMBSTONE);
  } catch {
    // เขียน tombstone ไม่สำเร็จก็ลบต่อไป ไม่ต้องล้มทั้งคำขอ
  }
  await supabase.storage.from(config.supabase.bucket).remove([key]);
}

/** ไฟล์ที่ถูกลบไปแล้ว (หรือแคชค้าง) — ถือว่าไม่มีข้อมูล */
function isTombstone(v: unknown): boolean {
  return typeof v === "object" && v !== null && (v as { deleted?: unknown }).deleted === true;
}

/* ================= เฉลย / ประชากรอ้างอิง / รูปหน้าโจทย์ (cache ต่อสนาม) ================= */

const keyCache = new Map<string, Record<string, AnswerKeyEntry>>();
const popCache = new Map<string, PopulationData>();
const pageCache = new Map<string, Uint8Array>();

export async function getAnswerKey(exam: ExamDef): Promise<Record<string, AnswerKeyEntry>> {
  const cached = keyCache.get(exam.id);
  if (cached) return cached;
  const key =
    (await storageGetJson<Record<string, AnswerKeyEntry>>(sKey(exam))) ??
    readLocalJson<Record<string, AnswerKeyEntry> | null>(localDataFile(exam, "answer-key.json"), null);
  if (!key || Object.keys(key).length !== exam.totalQuestions) {
    throw new Error(
      `ไม่พบเฉลยของสนาม ${exam.id} (${config.supabase.bucket}/${sKey(exam)}) — ` +
        `รัน scripts/build-exam-assets.py ${exam.id} แล้ว scripts/upload-exam-assets.mjs ${exam.id}`
    );
  }
  keyCache.set(exam.id, key);
  return key;
}

async function getPopulation(exam: ExamDef): Promise<PopulationData> {
  const cached = popCache.get(exam.id);
  if (cached) return cached;
  const pop =
    (await storageGetJson<PopulationData>(sPop(exam))) ??
    readLocalJson<PopulationData | null>(localDataFile(exam, "population.json"), null);
  if (!pop || !Array.isArray(pop.scoresWeighted)) {
    throw new Error(
      `ไม่พบประชากรอ้างอิงของสนาม ${exam.id} (${config.supabase.bucket}/${sPop(exam)}) — ` +
        `รัน scripts/upload-exam-assets.mjs ${exam.id}`
    );
  }
  popCache.set(exam.id, pop);
  return pop;
}

export async function getExamPageImage(exam: ExamDef, pageNo: number): Promise<Uint8Array> {
  const cacheId = `${exam.id}:${pageNo}`;
  const cached = pageCache.get(cacheId);
  if (cached) return cached;

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucket)
      .download(storagePagePath(exam, pageNo));
    if (data && !error) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      pageCache.set(cacheId, bytes);
      return bytes;
    }
  }

  const local = localPageFile(exam, pageNo);
  if (!fs.existsSync(local)) {
    throw new Error(
      `ไม่พบรูปหน้าโจทย์หน้า ${pageNo} ของสนาม ${exam.id} — อัปโหลดขึ้น ` +
        `${config.supabase.bucket}/${storagePagePath(exam, pageNo)} ก่อน`
    );
  }
  const bytes = new Uint8Array(fs.readFileSync(local));
  pageCache.set(cacheId, bytes);
  return bytes;
}

/* ================= สิทธิ์เข้าสอบ (จากคำสั่งซื้อจริง) ================= */

/**
 * สินค้าที่เลิกขายไปแล้วและ "ไม่มี" ไฟล์ข้อสอบ Mock — ใช้ตัดสินคำสั่งซื้อเก่า
 * ที่ productId ยังอยู่ใน Stripe แต่ไม่มีในแคตตาล็อกปัจจุบันแล้ว (lib/catalog.ts)
 * ⚠️ เพิ่มสินค้าใหม่ที่ไม่มีข้อสอบเมื่อไหร่ ต้องเพิ่มชื่อเข้าลิสต์นี้ด้วย
 */
const LEGACY_PRODUCTS_WITHOUT_MOCK = new Set([
  "sum1",
  "sum2",
  "sum3",
  "sum4",
  "bundle-sum",
  "summary1",
  "summary2",
  "summary3",
]);

/**
 * ตาราง orders ไม่ได้เก็บว่าซื้อสินค้าตัวไหน — แหล่งความจริงคือ metadata.productId
 * ที่ฝังไว้ตอนสร้าง Stripe Checkout Session (ดู app/api/checkout/route.ts)
 * cache ไว้ระดับ module เพื่อไม่ต้องยิง Stripe ซ้ำภายใน instance เดียวกัน
 */
const orderProductCache = new Map<string, { productId: string | null; verified: boolean }>();

async function lookupOrderProduct(order: {
  id: string;
  stripe_session_id: string | null;
}): Promise<{ productId: string | null; verified: boolean }> {
  const cached = orderProductCache.get(order.id);
  if (cached) return cached;

  let result: { productId: string | null; verified: boolean };
  if (!order.stripe_session_id) {
    // order รุ่นเก่าก่อนมีระบบหลายสินค้า — ตอนนั้นขายแต่ชุด Mock TPAT3
    result = { productId: null, verified: true };
  } else {
    const stripe = getStripe();
    if (!stripe) {
      result = { productId: null, verified: false };
    } else {
      try {
        const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
        result = { productId: session.metadata?.productId ?? null, verified: true };
      } catch (err) {
        console.error(`อ่านข้อมูลสินค้าของ order ${order.id} จาก Stripe ไม่สำเร็จ:`, err);
        result = { productId: null, verified: false };
      }
    }
  }
  orderProductCache.set(order.id, result);
  return result;
}

/** คำสั่งซื้อใบนี้ให้สิทธิ์สอบสนามนี้ไหม (ตรวจไม่ได้ = ไม่ให้สิทธิ์ เพื่อไม่แจกเกิน) */
async function orderGrantsExam(
  order: { id: string; stripe_session_id: string | null },
  exam: ExamDef
): Promise<boolean> {
  const { productId, verified } = await lookupOrderProduct(order);
  if (!verified) return false;
  // order ยุคสินค้าเดียว (ไม่มี session id / ไม่มี productId) = ชุด Mock TPAT3 เดิม
  if (!productId) return exam.entitlementFile === "questions";
  const product = PRODUCTS[productId as keyof typeof PRODUCTS];
  if (product) return product.files.includes(exam.entitlementFile);
  // productId เก่าที่ไม่อยู่ในแคตตาล็อกแล้ว — สมัยนั้นมีแต่สินค้าตระกูล TPAT3
  if (LEGACY_PRODUCTS_WITHOUT_MOCK.has(productId)) return false;
  return exam.entitlementFile === "questions";
}

/** รายชื่อผู้มีสิทธิ์สอบ "สนามนี้" ของอีเมลนี้ (1 อีเมลอาจมีหลายคำสั่งซื้อ) */
export async function findEntitlementByEmail(
  exam: ExamDef,
  email: string
): Promise<Entitlement[]> {
  const clean = normalizeEmail(email);
  const out: Entitlement[] = [];

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,first_name,last_name,email,status,stripe_session_id")
      .ilike("email", clean)
      .eq("status", "delivered");
    if (error) {
      console.error("ค้นหาคำสั่งซื้อไม่สำเร็จ:", error.message);
    } else {
      for (const o of data ?? []) {
        if (!(await orderGrantsExam(o, exam))) continue;
        out.push({
          email: clean,
          firstName: o.first_name ?? "",
          lastName: o.last_name ?? "",
          orderId: o.id,
        });
      }
    }
  }

  // โหมดทดสอบในเครื่อง: ผู้ซื้อจำลอง = ซื้อชุด Mock (ให้สิทธิ์สนามที่ใช้ไฟล์ questions)
  if (demoEnabled() && exam.entitlementFile === "questions") {
    const demo = readLocalJson<Record<string, Entitlement>>(BUYERS_FILE, {})[clean];
    if (demo) out.push(demo);
  }

  return out;
}

/* ================= ผู้ซื้อจำลอง (ใช้เฉพาะตอนทดสอบในเครื่อง) ================= */

export function listDemoBuyers(): Entitlement[] {
  return Object.values(readLocalJson<Record<string, Entitlement>>(BUYERS_FILE, {}));
}

export function grantDemoBuyer(input: {
  email: string;
  firstName: string;
  lastName: string;
}): Entitlement {
  const all = readLocalJson<Record<string, Entitlement>>(BUYERS_FILE, {});
  const email = normalizeEmail(input.email);
  const buyer: Entitlement = {
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    orderId: all[email]?.orderId ?? `demo-${Date.now().toString(36)}`,
  };
  all[email] = buyer;
  writeLocalJson(BUYERS_FILE, all);
  return buyer;
}

export function removeDemoBuyer(email: string): void {
  const all = readLocalJson<Record<string, Entitlement>>(BUYERS_FILE, {});
  delete all[normalizeEmail(email)];
  writeLocalJson(BUYERS_FILE, all);
}

/* ================= การสอบ (แยกต่อสนาม) ================= */

/** อ่าน attempt: Storage ก่อน ถ้าไม่มี Supabase ค่อยใช้ไฟล์ local (dev) */
export async function getAttempt(exam: ExamDef, email: string): Promise<ExamAttempt | null> {
  const clean = normalizeEmail(email);
  if (getSupabase()) {
    const found = await storageGetJson<ExamAttempt>(sAttempt(exam, clean));
    return found && !isTombstone(found) ? found : null;
  }
  return readLocalJson<Record<string, ExamAttempt>>(localAttemptsFile(exam), {})[clean] ?? null;
}

async function putAttempt(exam: ExamDef, attempt: ExamAttempt): Promise<void> {
  if (getSupabase()) {
    await storagePutJson(sAttempt(exam, attempt.email), attempt);
    return;
  }
  const all = readLocalJson<Record<string, ExamAttempt>>(localAttemptsFile(exam), {});
  all[attempt.email] = attempt;
  writeLocalJson(localAttemptsFile(exam), all);
}

export async function deleteAttempt(exam: ExamDef, email: string): Promise<void> {
  const clean = normalizeEmail(email);
  if (getSupabase()) {
    await storageRemove(sAttempt(exam, clean));
    return;
  }
  const all = readLocalJson<Record<string, ExamAttempt>>(localAttemptsFile(exam), {});
  delete all[clean];
  writeLocalJson(localAttemptsFile(exam), all);
}

export function examDeadline(exam: ExamDef, attempt: ExamAttempt): number {
  return new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60 * 1000;
}

export type AttemptState = "none" | "in_progress" | "submitted";

/**
 * สถานะการสอบของอีเมลนี้ในสนามนี้ — มีผลข้างเคียงโดยตั้งใจ: ถ้าหมดเวลา (เลย grace)
 * แล้วยังไม่ส่ง จะปิดการสอบให้อัตโนมัติด้วยคำตอบล่าสุดที่บันทึกไว้
 */
export async function getAttemptState(
  exam: ExamDef,
  email: string
): Promise<{ state: AttemptState; attempt: ExamAttempt | null }> {
  const attempt = await getAttempt(exam, email);
  if (!attempt) return { state: "none", attempt: null };
  if (attempt.submittedAt) return { state: "submitted", attempt };
  if (Date.now() > examDeadline(exam, attempt) + GRACE_MS) {
    const finalized = await submitAttempt(exam, email, attempt.answers, { auto: true });
    return { state: "submitted", attempt: finalized };
  }
  return { state: "in_progress", attempt };
}

/** เริ่มสอบ (สร้างได้ครั้งเดียวต่ออีเมลต่อสนาม) — คืน attempt เดิมถ้าเริ่มไปแล้ว */
export async function startAttempt(exam: ExamDef, buyer: Entitlement): Promise<ExamAttempt> {
  const email = normalizeEmail(buyer.email);
  const existing = await getAttempt(exam, email);
  if (existing) return existing;

  const attempt: ExamAttempt = {
    examId: exam.id,
    email,
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    orderId: buyer.orderId,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    answers: Array(exam.totalQuestions).fill(0),
    correctCount: null,
    score: null,
  };
  await putAttempt(exam, attempt);
  return attempt;
}

function sanitizeAnswers(exam: ExamDef, raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== exam.totalQuestions) return null;
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > exam.choices) return null;
    out.push(n);
  }
  return out;
}

/** บันทึกคำตอบระหว่างสอบ (autosave) — รับเฉพาะช่วงยังไม่หมดเวลา */
export async function saveAnswers(
  exam: ExamDef,
  email: string,
  rawAnswers: unknown
): Promise<{ ok: boolean; reason?: string }> {
  const answers = sanitizeAnswers(exam, rawAnswers);
  if (!answers) return { ok: false, reason: "รูปแบบคำตอบไม่ถูกต้อง" };

  const attempt = await getAttempt(exam, email);
  if (!attempt) return { ok: false, reason: "ยังไม่ได้เริ่มสอบ" };
  if (attempt.submittedAt) return { ok: false, reason: "ส่งข้อสอบไปแล้ว" };
  if (Date.now() > examDeadline(exam, attempt) + GRACE_MS) {
    return { ok: false, reason: "หมดเวลาสอบแล้ว" };
  }

  attempt.answers = answers;
  await putAttempt(exam, attempt);
  return { ok: true };
}

/** ส่งข้อสอบ + ตรวจ — เรียกซ้ำไม่ตรวจซ้ำ (คืนผลเดิม) */
export async function submitAttempt(
  exam: ExamDef,
  email: string,
  rawAnswers: unknown,
  opts: { auto?: boolean } = {}
): Promise<ExamAttempt> {
  const attempt = await getAttempt(exam, email);
  if (!attempt) throw new Error("ยังไม่ได้เริ่มสอบ");
  if (attempt.submittedAt) return attempt;

  // ถ้าคำขอส่งมาหลังหมดเวลา (เลย grace) ให้ใช้คำตอบที่ autosave ไว้แทนชุดที่ส่งมา
  const late = Date.now() > examDeadline(exam, attempt) + GRACE_MS;
  const answers = late ? attempt.answers : (sanitizeAnswers(exam, rawAnswers) ?? attempt.answers);

  const key = await getAnswerKey(exam);
  let correct = 0;
  let score = 0;
  for (let q = 1; q <= exam.totalQuestions; q++) {
    if (answers[q - 1] === key[String(q)].answer) {
      correct++;
      score += questionWeight(exam, q);
    }
  }

  attempt.answers = answers;
  attempt.correctCount = correct;
  attempt.score = roundScore(score);
  // ปิดอัตโนมัติเพราะหมดเวลา — ประทับเวลา ณ เส้นตาย ไม่ใช่เวลาที่บังเอิญมีคนมา trigger
  attempt.submittedAt = opts.auto
    ? new Date(examDeadline(exam, attempt)).toISOString()
    : new Date().toISOString();

  await putAttempt(exam, attempt);
  await addToAggregate(exam, attempt, key);
  return attempt;
}

/* ================= สถิติ (แยกต่อสนาม) ================= */

async function readAggregate(exam: ExamDef): Promise<Aggregate> {
  if (getSupabase()) {
    return (await storageGetJson<Aggregate>(sAgg(exam))) ?? { scores: [], perQuestionCorrect: {} };
  }
  // dev (ไม่มี Supabase): คิดสดจากไฟล์ attempts ในเครื่อง
  const agg: Aggregate = { scores: [], perQuestionCorrect: {} };
  const all = readLocalJson<Record<string, ExamAttempt>>(localAttemptsFile(exam), {});
  const key = await getAnswerKey(exam);
  for (const a of Object.values(all)) {
    if (!a.submittedAt) continue;
    agg.scores.push(a.score ?? 0);
    for (let q = 1; q <= exam.totalQuestions; q++) {
      if (a.answers[q - 1] === key[String(q)].answer) {
        agg.perQuestionCorrect[String(q)] = (agg.perQuestionCorrect[String(q)] ?? 0) + 1;
      }
    }
  }
  return agg;
}

/**
 * บวกผลของผู้สอบคนนี้เข้าไปในผลรวม (เรียกตอนส่งข้อสอบเท่านั้น)
 * ถ้าเขียนไม่สำเร็จ ไม่ให้ล้มทั้งคำขอ — ผลสอบรายคนบันทึกไปแล้ว เสียแค่ตัวเลขรวม
 */
async function addToAggregate(
  exam: ExamDef,
  attempt: ExamAttempt,
  key: Record<string, AnswerKeyEntry>
): Promise<void> {
  if (!getSupabase()) return; // dev คิดสดจากไฟล์อยู่แล้ว
  try {
    const agg =
      (await storageGetJson<Aggregate>(sAgg(exam))) ?? { scores: [], perQuestionCorrect: {} };
    agg.scores.push(attempt.score ?? 0);
    for (let q = 1; q <= exam.totalQuestions; q++) {
      if (attempt.answers[q - 1] === key[String(q)].answer) {
        agg.perQuestionCorrect[String(q)] = (agg.perQuestionCorrect[String(q)] ?? 0) + 1;
      }
    }
    await storagePutJson(sAgg(exam), agg);
  } catch (err) {
    console.error("อัปเดตสถิติรวมไม่สำเร็จ (ผลสอบรายคนบันทึกแล้ว):", err);
  }
}

/** ลบผลของอีเมลหนึ่งออกจากผลรวม — ใช้ตอนเจ้าของร้านรีเซ็ตรอบสอบของตัวเอง */
async function removeFromAggregate(exam: ExamDef, attempt: ExamAttempt): Promise<void> {
  if (!getSupabase() || !attempt.submittedAt) return;
  try {
    const agg = await storageGetJson<Aggregate>(sAgg(exam));
    if (!agg) return;
    const i = agg.scores.indexOf(attempt.score ?? 0);
    if (i >= 0) agg.scores.splice(i, 1);
    const key = await getAnswerKey(exam);
    for (let q = 1; q <= exam.totalQuestions; q++) {
      if (attempt.answers[q - 1] === key[String(q)].answer) {
        const cur = agg.perQuestionCorrect[String(q)] ?? 0;
        agg.perQuestionCorrect[String(q)] = Math.max(0, cur - 1);
      }
    }
    await storagePutJson(sAgg(exam), agg);
  } catch (err) {
    console.error("ถอนผลออกจากสถิติรวมไม่สำเร็จ:", err);
  }
}

/** ลบการสอบ + ถอนผลออกจากสถิติ (ใช้กับอีเมลที่ทำซ้ำได้) */
export async function resetAttempt(exam: ExamDef, email: string): Promise<void> {
  const attempt = await getAttempt(exam, email);
  if (attempt) await removeFromAggregate(exam, attempt);
  await deleteAttempt(exam, email);
}

export interface ExamStatistics {
  nTotal: number; // ผู้สอบทั้งหมด (ประชากรอ้างอิง + ผู้สอบจริง)
  mean: number; // ทุกค่าอยู่บนสเกลคะแนนถ่วงน้ำหนักของสนามนั้น
  sd: number;
  min: number;
  max: number;
  rank: number; // อันดับของคะแนนที่ส่งเข้ามา (1 = สูงสุด)
  histogram: { from: number; to: number; count: number; mine: boolean }[];
  perQuestionPctCorrect: Record<string, number>; // % คนตอบถูกรายข้อ (0-100)
}

/**
 * สถิติเทียบกับผู้สอบทุกคนในสนามนี้ = ประชากรอ้างอิง + ผู้สอบจริงที่ส่งแล้ว
 * (ประชากรอ้างอิงจำเป็นช่วงแรกที่ผู้สอบจริงยังน้อย ไม่งั้นอันดับไม่มีความหมาย)
 */
export async function computeStatistics(exam: ExamDef, myScore: number): Promise<ExamStatistics> {
  const [pop, agg] = await Promise.all([getPopulation(exam), readAggregate(exam)]);
  const scores = [...pop.scoresWeighted, ...agg.scores];

  const n = scores.length;
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const rank = 1 + scores.filter((v) => v > myScore).length;

  // ฮิสโตแกรม 10 ช่วงเท่า ๆ กันตามคะแนนเต็มของสนาม (เต็ม 100 → ช่วงละ 10)
  const binSize = exam.maxScore / 10;
  const binOf = (score: number) =>
    Math.min(9, Math.max(0, Math.floor(score / binSize)));
  const myBin = binOf(myScore);
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    from: i * binSize,
    to: (i + 1) * binSize,
    count: 0,
    mine: i === myBin,
  }));
  for (const s of scores) histogram[binOf(s)].count++;

  const nAll = pop.nStudents + agg.scores.length;
  const perQuestionPctCorrect: Record<string, number> = {};
  for (let q = 1; q <= exam.totalQuestions; q++) {
    const fromPop = pop.perQuestionCorrect[String(q)] ?? 0;
    const fromReal = agg.perQuestionCorrect[String(q)] ?? 0;
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
