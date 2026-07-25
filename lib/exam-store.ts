import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { getSupabase } from "./supabase";
import { getStripe } from "./stripe";
import { config } from "./config";
import { PRODUCTS } from "./catalog";
import { EXAM, GRACE_MS, Difficulty, questionWeight, roundScore } from "./exam-config";

/**
 * ที่เก็บข้อมูลระบบทำข้อสอบ
 *
 * production (Vercel): เก็บบน Supabase Storage ทั้งหมด — ดิสก์ของ serverless เขียนไม่ได้
 * และหายทุกครั้งที่ instance เปลี่ยน จึงห้ามพึ่งไฟล์ในเครื่อง
 *   ebooks/exam/answer-key.json      เฉลย + ระดับความยากรายข้อ
 *   ebooks/exam/population.json      ประชากรอ้างอิงสำหรับสถิติ
 *   ebooks/exam/pages/page-NN.png    รูปหน้าโจทย์ (เสิร์ฟผ่าน API ที่เช็คสิทธิ์)
 *   ebooks/exam/attempts/<hash>.json การสอบของแต่ละอีเมล (hash = sha256 ของอีเมล)
 *   ebooks/exam/aggregate.json       ผลรวมของผู้สอบจริง ไว้คิดสถิติโดยไม่ต้องอ่านทุกไฟล์
 *
 * ตอนรันในเครื่องที่ยังไม่ตั้งค่า Supabase: ใช้ไฟล์ใน data/exam/ และ assets/exam-pages/ แทน
 * (สร้างด้วย `python scripts/build-exam-assets.py` แล้วอัปขึ้น Storage ด้วย
 *  `node scripts/upload-exam-assets.mjs`)
 *
 * สิทธิ์เข้าสอบมาจากตาราง orders จริง — ดู findEntitlementByEmail()
 */

const DATA_DIR = path.join(process.cwd(), "data", "exam");
const LOCAL_PAGES_DIR = path.join(process.cwd(), "assets", "exam-pages");
const BUYERS_FILE = path.join(DATA_DIR, "demo-buyers.json");
const ATTEMPTS_FILE = path.join(DATA_DIR, "attempts.json");

const S_KEY = "exam/answer-key.json";
const S_POP = "exam/population.json";
const S_AGG = "exam/aggregate.json";
const sAttempt = (email: string) =>
  `exam/attempts/${createHash("sha256").update(normalizeEmail(email)).digest("hex")}.json`;
export const storagePagePath = (pageNo: number) =>
  `exam/pages/page-${String(pageNo).padStart(2, "0")}.png`;

export interface ExamAttempt {
  email: string; // lowercase — ใช้เป็น key
  firstName: string;
  lastName: string;
  orderId: string;
  startedAt: string; // ISO — เวลาเริ่มนับถอยหลัง (server เป็นคนกำหนด)
  submittedAt: string | null;
  answers: number[]; // ยาว 70 — 0 = ยังไม่ตอบ, 1-5 = ช้อยส์ที่เลือก
  correctCount: number | null;
  score: number | null; // คะแนนถ่วงน้ำหนัก เต็ม 100
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
  scores: number[]; // คะแนนถ่วงน้ำหนักของผู้สอบจริงทุกคน
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

/* ================= อ่าน/เขียน Storage (มี fallback เป็นไฟล์ local) ================= */

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

async function storagePutJson(key: string, value: unknown): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase — บันทึกข้อมูลสอบไม่ได้");
  const { error } = await supabase.storage
    .from(config.supabase.bucket)
    .upload(key, JSON.stringify(value), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(`บันทึกข้อมูลสอบไม่สำเร็จ: ${error.message}`);
}

async function storageRemove(key: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.storage.from(config.supabase.bucket).remove([key]);
}

/* ================= เฉลย / ประชากรอ้างอิง ================= */

let keyCache: Record<string, AnswerKeyEntry> | null = null;
let popCache: PopulationData | null = null;

export async function getAnswerKey(): Promise<Record<string, AnswerKeyEntry>> {
  if (keyCache) return keyCache;
  const fromStorage = await storageGetJson<Record<string, AnswerKeyEntry>>(S_KEY);
  const key =
    fromStorage ??
    readLocalJson<Record<string, AnswerKeyEntry> | null>(path.join(DATA_DIR, "answer-key.json"), null);
  if (!key || Object.keys(key).length !== EXAM.totalQuestions) {
    throw new Error(
      `ไม่พบเฉลยข้อสอบ (${config.supabase.bucket}/${S_KEY}) — รัน scripts/build-exam-assets.py แล้ว scripts/upload-exam-assets.mjs`
    );
  }
  keyCache = key;
  return key;
}

async function getPopulation(): Promise<PopulationData> {
  if (popCache) return popCache;
  const fromStorage = await storageGetJson<PopulationData>(S_POP);
  const pop =
    fromStorage ?? readLocalJson<PopulationData | null>(path.join(DATA_DIR, "population.json"), null);
  if (!pop || !Array.isArray(pop.scoresWeighted)) {
    throw new Error(
      `ไม่พบข้อมูลประชากรอ้างอิง (${config.supabase.bucket}/${S_POP}) — รัน scripts/upload-exam-assets.mjs`
    );
  }
  popCache = pop;
  return pop;
}

/** รูปหน้าโจทย์ — cache ระดับ module เพื่อลดการดาวน์โหลดซ้ำบน instance เดียวกัน */
const pageCache = new Map<number, Uint8Array>();

export async function getExamPageImage(pageNo: number): Promise<Uint8Array> {
  const cached = pageCache.get(pageNo);
  if (cached) return cached;

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucket)
      .download(storagePagePath(pageNo));
    if (data && !error) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      pageCache.set(pageNo, bytes);
      return bytes;
    }
  }

  const local = path.join(LOCAL_PAGES_DIR, `page-${String(pageNo).padStart(2, "0")}.png`);
  if (!fs.existsSync(local)) {
    throw new Error(
      `ไม่พบรูปหน้าโจทย์หน้า ${pageNo} — อัปโหลดขึ้น ${config.supabase.bucket}/${storagePagePath(pageNo)} ก่อน`
    );
  }
  const bytes = new Uint8Array(fs.readFileSync(local));
  pageCache.set(pageNo, bytes);
  return bytes;
}

/* ================= สิทธิ์เข้าสอบ (จากคำสั่งซื้อจริง) ================= */

/**
 * สินค้าที่เลิกขายไปแล้วและ "ไม่มี" ไฟล์ข้อสอบ Mock — ใช้ตัดสินคำสั่งซื้อเก่า
 * ที่ productId ยังอยู่ใน Stripe แต่ไม่มีในแคตตาล็อกปัจจุบันแล้ว (lib/catalog.ts)
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
    // order รุ่นเก่าก่อนมีระบบหลายสินค้า — ตอนนั้นขายแต่ชุด Mock (ดู lib/fulfillment.ts)
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

/** คำสั่งซื้อใบนี้รวมไฟล์ข้อสอบ Mock ไหม (ตรวจไม่ได้ = ถือว่าไม่มี เพื่อไม่ให้สิทธิ์เกิน) */
async function orderIncludesMock(order: {
  id: string;
  stripe_session_id: string | null;
}): Promise<boolean> {
  const { productId, verified } = await lookupOrderProduct(order);
  if (!verified) return false;
  if (!productId) return true; // order รุ่นเก่า = ชุด Mock
  const product = PRODUCTS[productId as keyof typeof PRODUCTS];
  if (product) return product.files.includes("questions");
  return !LEGACY_PRODUCTS_WITHOUT_MOCK.has(productId);
}

/** รายชื่อผู้มีสิทธิ์สอบของอีเมลนี้ (1 อีเมลอาจมีหลายคำสั่งซื้อ) */
export async function findEntitlementByEmail(email: string): Promise<Entitlement[]> {
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
        if (!(await orderIncludesMock(o))) continue;
        out.push({
          email: clean,
          firstName: o.first_name ?? "",
          lastName: o.last_name ?? "",
          orderId: o.id,
        });
      }
    }
  }

  // โหมดทดสอบในเครื่อง: รวมผู้ซื้อจำลองจากหน้า /exam/demo ด้วย
  if (demoEnabled()) {
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

/* ================= การสอบ ================= */

/** อ่าน attempt: Storage ก่อน ถ้าไม่มี Supabase ค่อยใช้ไฟล์ local (dev) */
export async function getAttempt(email: string): Promise<ExamAttempt | null> {
  const clean = normalizeEmail(email);
  if (getSupabase()) {
    return await storageGetJson<ExamAttempt>(sAttempt(clean));
  }
  return readLocalJson<Record<string, ExamAttempt>>(ATTEMPTS_FILE, {})[clean] ?? null;
}

async function putAttempt(attempt: ExamAttempt): Promise<void> {
  if (getSupabase()) {
    await storagePutJson(sAttempt(attempt.email), attempt);
    return;
  }
  const all = readLocalJson<Record<string, ExamAttempt>>(ATTEMPTS_FILE, {});
  all[attempt.email] = attempt;
  writeLocalJson(ATTEMPTS_FILE, all);
}

export async function deleteAttempt(email: string): Promise<void> {
  const clean = normalizeEmail(email);
  if (getSupabase()) {
    await storageRemove(sAttempt(clean));
    return;
  }
  const all = readLocalJson<Record<string, ExamAttempt>>(ATTEMPTS_FILE, {});
  delete all[clean];
  writeLocalJson(ATTEMPTS_FILE, all);
}

export function examDeadline(attempt: ExamAttempt): number {
  return new Date(attempt.startedAt).getTime() + EXAM.durationMinutes * 60 * 1000;
}

export type AttemptState = "none" | "in_progress" | "submitted";

/**
 * สถานะการสอบของอีเมลนี้ — มีผลข้างเคียงโดยตั้งใจ: ถ้าหมดเวลา (เลย grace) แล้วยังไม่ส่ง
 * จะปิดการสอบให้อัตโนมัติด้วยคำตอบล่าสุดที่บันทึกไว้ (กติกาเดียวกับห้องสอบจริง)
 */
export async function getAttemptState(
  email: string
): Promise<{ state: AttemptState; attempt: ExamAttempt | null }> {
  const attempt = await getAttempt(email);
  if (!attempt) return { state: "none", attempt: null };
  if (attempt.submittedAt) return { state: "submitted", attempt };
  if (Date.now() > examDeadline(attempt) + GRACE_MS) {
    const finalized = await submitAttempt(email, attempt.answers, { auto: true });
    return { state: "submitted", attempt: finalized };
  }
  return { state: "in_progress", attempt };
}

/** เริ่มสอบ (สร้างได้ครั้งเดียวต่ออีเมล) — คืน attempt เดิมถ้าเริ่มไปแล้ว */
export async function startAttempt(buyer: Entitlement): Promise<ExamAttempt> {
  const email = normalizeEmail(buyer.email);
  const existing = await getAttempt(email);
  if (existing) return existing;

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
  await putAttempt(attempt);
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
export async function saveAnswers(
  email: string,
  rawAnswers: unknown
): Promise<{ ok: boolean; reason?: string }> {
  const answers = sanitizeAnswers(rawAnswers);
  if (!answers) return { ok: false, reason: "รูปแบบคำตอบไม่ถูกต้อง" };

  const attempt = await getAttempt(email);
  if (!attempt) return { ok: false, reason: "ยังไม่ได้เริ่มสอบ" };
  if (attempt.submittedAt) return { ok: false, reason: "ส่งข้อสอบไปแล้ว" };
  if (Date.now() > examDeadline(attempt) + GRACE_MS) return { ok: false, reason: "หมดเวลาสอบแล้ว" };

  attempt.answers = answers;
  await putAttempt(attempt);
  return { ok: true };
}

/** ส่งข้อสอบ + ตรวจ — เรียกซ้ำไม่ตรวจซ้ำ (คืนผลเดิม) */
export async function submitAttempt(
  email: string,
  rawAnswers: unknown,
  opts: { auto?: boolean } = {}
): Promise<ExamAttempt> {
  const attempt = await getAttempt(email);
  if (!attempt) throw new Error("ยังไม่ได้เริ่มสอบ");
  if (attempt.submittedAt) return attempt;

  // ถ้าคำขอส่งมาหลังหมดเวลา (เลย grace) ให้ใช้คำตอบที่ autosave ไว้แทนชุดที่ส่งมา
  const late = Date.now() > examDeadline(attempt) + GRACE_MS;
  const answers = late ? attempt.answers : (sanitizeAnswers(rawAnswers) ?? attempt.answers);

  const key = await getAnswerKey();
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
  // ปิดอัตโนมัติเพราะหมดเวลา — ประทับเวลา ณ เส้นตาย ไม่ใช่เวลาที่บังเอิญมีคนมา trigger
  attempt.submittedAt = opts.auto
    ? new Date(examDeadline(attempt)).toISOString()
    : new Date().toISOString();

  await putAttempt(attempt);
  await addToAggregate(attempt, key);
  return attempt;
}

/* ================= สถิติ ================= */

async function readAggregate(): Promise<Aggregate> {
  const fromStorage = getSupabase() ? await storageGetJson<Aggregate>(S_AGG) : null;
  const local = getSupabase()
    ? null
    : readLocalJson<Record<string, ExamAttempt>>(ATTEMPTS_FILE, {});
  if (fromStorage) return fromStorage;

  // dev (ไม่มี Supabase): คิดสดจากไฟล์ attempts ในเครื่อง
  const agg: Aggregate = { scores: [], perQuestionCorrect: {} };
  if (local) {
    const key = await getAnswerKey();
    for (const a of Object.values(local)) {
      if (!a.submittedAt) continue;
      agg.scores.push(a.score ?? 0);
      for (let q = 1; q <= EXAM.totalQuestions; q++) {
        if (a.answers[q - 1] === key[String(q)].answer) {
          agg.perQuestionCorrect[String(q)] = (agg.perQuestionCorrect[String(q)] ?? 0) + 1;
        }
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
  attempt: ExamAttempt,
  key: Record<string, AnswerKeyEntry>
): Promise<void> {
  if (!getSupabase()) return; // dev คิดสดจากไฟล์อยู่แล้ว
  try {
    const agg = (await storageGetJson<Aggregate>(S_AGG)) ?? { scores: [], perQuestionCorrect: {} };
    agg.scores.push(attempt.score ?? 0);
    for (let q = 1; q <= EXAM.totalQuestions; q++) {
      if (attempt.answers[q - 1] === key[String(q)].answer) {
        agg.perQuestionCorrect[String(q)] = (agg.perQuestionCorrect[String(q)] ?? 0) + 1;
      }
    }
    await storagePutJson(S_AGG, agg);
  } catch (err) {
    console.error("อัปเดตสถิติรวมไม่สำเร็จ (ผลสอบรายคนบันทึกแล้ว):", err);
  }
}

/** ลบผลของอีเมลหนึ่งออกจากผลรวม — ใช้ตอนเจ้าของร้านรีเซ็ตรอบสอบของตัวเอง */
async function removeFromAggregate(attempt: ExamAttempt): Promise<void> {
  if (!getSupabase() || !attempt.submittedAt) return;
  try {
    const agg = await storageGetJson<Aggregate>(S_AGG);
    if (!agg) return;
    const i = agg.scores.indexOf(attempt.score ?? 0);
    if (i >= 0) agg.scores.splice(i, 1);
    const key = await getAnswerKey();
    for (let q = 1; q <= EXAM.totalQuestions; q++) {
      if (attempt.answers[q - 1] === key[String(q)].answer) {
        const cur = agg.perQuestionCorrect[String(q)] ?? 0;
        agg.perQuestionCorrect[String(q)] = Math.max(0, cur - 1);
      }
    }
    await storagePutJson(S_AGG, agg);
  } catch (err) {
    console.error("ถอนผลออกจากสถิติรวมไม่สำเร็จ:", err);
  }
}

/** ลบการสอบ + ถอนผลออกจากสถิติ (ใช้กับอีเมลที่ทำซ้ำได้) */
export async function resetAttempt(email: string): Promise<void> {
  const attempt = await getAttempt(email);
  if (attempt) await removeFromAggregate(attempt);
  await deleteAttempt(email);
}

export interface ExamStatistics {
  nTotal: number; // ผู้สอบทั้งหมด (ประชากรอ้างอิง + ผู้สอบจริง)
  mean: number; // ทุกค่าอยู่บนสเกลคะแนนถ่วงน้ำหนัก เต็ม 100
  sd: number;
  min: number;
  max: number;
  rank: number; // อันดับของคะแนนที่ส่งเข้ามา (1 = สูงสุด)
  histogram: { from: number; to: number; count: number; mine: boolean }[]; // ช่วงละ 10 คะแนน
  perQuestionPctCorrect: Record<string, number>; // % คนตอบถูกรายข้อ (0-100)
}

/**
 * สถิติเทียบกับผู้สอบทุกคน = ประชากรอ้างอิง + ผู้สอบจริงที่ส่งแล้ว
 * (ประชากรอ้างอิงจำเป็นช่วงแรกที่ผู้สอบจริงยังน้อย ไม่งั้นอันดับไม่มีความหมาย)
 */
export async function computeStatistics(myScore: number): Promise<ExamStatistics> {
  const [pop, agg] = await Promise.all([getPopulation(), readAggregate()]);
  const scores = [...pop.scoresWeighted, ...agg.scores];

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

  const nAll = pop.nStudents + agg.scores.length;
  const perQuestionPctCorrect: Record<string, number> = {};
  for (let q = 1; q <= EXAM.totalQuestions; q++) {
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
