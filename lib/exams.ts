/**
 * ทะเบียนสนามสอบออนไลน์ทั้งหมดของร้าน — "แหล่งความจริงเดียว" ว่ามีข้อสอบชุดไหนบ้าง
 *
 * import ได้ทั้ง client และ server (ห้ามมีเฉลย/ของลับในนี้)
 *
 * ## วิธีเพิ่มสนามสอบใหม่ (เช่น A-Level)
 * 1. วางไฟล์ต้นฉบับ master-*.pdf แล้วรัน `python scripts/build-exam-assets.py <examId>`
 *    → ได้ manifest ที่ lib/exam-manifests/<examId>.json + เฉลย/รูปโจทย์ใน data,assets
 * 2. รัน `node --env-file=.env.local scripts/upload-exam-assets.mjs <examId>`
 *    แล้ว `python scripts/watermark-exam-pages.py <examId>` (ประทับลายน้ำรูปหน้าโจทย์ที่ห้องสอบเสิร์ฟ)
 * 3. เพิ่ม entry ใหม่ใน EXAMS ด้านล่าง (id, ชื่อ, น้ำหนักคะแนน, ไฟล์ที่ให้สิทธิ์)
 * 4. เข้าห้องสอบชุดใหม่ที่ /exam?exam=<examId>
 * ข้อมูลทุกอย่าง (สิทธิ์ 1 อีเมล 1 รอบ, ผลสอบ, สถิติ) แยกกันต่อสนามโดยอัตโนมัติ —
 * คนที่สอบ TPAT3 ไปแล้วยังสอบ A-Level ได้
 */
import type { FileId, ProductId } from "./catalog";
import tpat3Manifest from "./exam-manifests/tpat3-1.json";
import phys1Manifest from "./exam-manifests/phys-1.json";

export interface ExamSection {
  no: number;
  title: string;
  from: number;
  to: number;
}

export interface ExamQuestionPos {
  no: number;
  page: number; // เลขหน้า PDF (1-based) ที่ข้อนี้เริ่ม
  yFrac: number; // ตำแหน่งแนวตั้งในหน้า (0-1) ไว้เลื่อน scroll ไปหาข้อ
}

/** ช่วงน้ำหนักคะแนนรายข้อ เช่น ข้อ 1-60 ข้อละ 4/3 */
export interface WeightBand {
  from: number;
  to: number;
  weight: number;
}

export interface ExamDef {
  id: string;
  /** ชื่อเต็มไว้โชว์บนหัวห้องสอบ/หน้าผล เช่น "Mock TPAT3" */
  title: string;
  /** ชื่อสั้นของสนาม เช่น "TPAT3" (ใช้ประกอบข้อความ) */
  shortName: string;
  totalQuestions: number;
  choices: number;
  durationMinutes: number;
  maxScore: number;
  instructionPages: number[];
  questionPages: number[];
  pageWidth: number;
  pageHeight: number;
  sections: ExamSection[];
  questions: ExamQuestionPos[];
  /** น้ำหนักคะแนนรายข้อ — ต้องตรงกับ config ใน scripts/build-exam-assets.py */
  weights: WeightBand[];
  /** ซื้อสินค้าที่มีไฟล์นี้ = ได้สิทธิ์เข้าสอบสนามนี้ (เทียบกับ Product.files ใน catalog) */
  entitlementFile: FileId;
  /** ไฟล์แนบท้ายผลสอบ (ลิงก์ดาวน์โหลดลายน้ำ) */
  resultFiles: FileId[];
  /** ช่วงข้อที่ "ตอบเป็นตัวเลข" (พิมพ์ค่าแทนการเลือกช้อยส์) — ไม่มี = ปรนัยทุกข้อ (ดู lib/exam-answers.ts) */
  numeric?: { from: number; to: number };
  /** หน่วยท้ายช่องตอบของข้อตัวเลข เช่น { 26: "m/s" } (ตามที่โจทย์กำหนด) */
  numericUnits?: Record<number, string>;
  /** สินค้าที่ขายชุดนี้เดี่ยว ๆ (ลิงก์ "สั่งซื้อ" ในห้องสอบ) + หน้ารายละเอียดคอร์ส */
  productId: ProductId;
  courseSlug: string;
  /** ข้อความปุ่มเข้าสอบสั้น ๆ เช่น "70 ข้อ / 3 ชม." */
  summary: string;
}

export const DEFAULT_EXAM_ID = "tpat3-1";

export const EXAMS: Record<string, ExamDef> = {
  "tpat3-1": {
    id: "tpat3-1",
    title: "Mock TPAT3",
    shortName: "TPAT3",
    totalQuestions: tpat3Manifest.totalQuestions,
    choices: tpat3Manifest.choices,
    durationMinutes: tpat3Manifest.durationMinutes,
    maxScore: tpat3Manifest.maxScore,
    instructionPages: tpat3Manifest.instructionPages,
    questionPages: tpat3Manifest.questionPages,
    pageWidth: tpat3Manifest.pageWidth,
    pageHeight: tpat3Manifest.pageHeight,
    sections: tpat3Manifest.sections,
    questions: tpat3Manifest.questions,
    // ข้อ 1-60 ข้อละ 4/3 (รวม 80) · ข้อ 61-70 ข้อละ 2 (รวม 20) = เต็ม 100
    weights: [
      { from: 1, to: 60, weight: 4 / 3 },
      { from: 61, to: 70, weight: 2 },
    ],
    entitlementFile: "questions",
    resultFiles: ["answers"],
    productId: "mock1",
    courseSlug: "mock-tpat3",
    summary: "70 ข้อ / 3 ชม.",
  },
  // Mock A-Level ฟิสิกส์ ชุดที่ 1 (เจ้าของสั่ง 2026-11-16 "เหมือน Mock TPAT3 ทุกอย่าง")
  // 30 ข้อ 90 นาที · ข้อ 1-25 ปรนัย 5 ตัวเลือก ข้อละ 3 · ข้อ 26-30 ตอบเป็นตัวเลข ข้อละ 5 = เต็ม 100
  "phys-1": {
    id: "phys-1",
    title: "Mock A-Level ฟิสิกส์",
    shortName: "A-Level ฟิสิกส์",
    totalQuestions: phys1Manifest.totalQuestions,
    choices: phys1Manifest.choices,
    durationMinutes: phys1Manifest.durationMinutes,
    maxScore: phys1Manifest.maxScore,
    instructionPages: phys1Manifest.instructionPages,
    questionPages: phys1Manifest.questionPages,
    pageWidth: phys1Manifest.pageWidth,
    pageHeight: phys1Manifest.pageHeight,
    sections: phys1Manifest.sections,
    questions: phys1Manifest.questions,
    weights: [
      { from: 1, to: 25, weight: 3 },
      { from: 26, to: 30, weight: 5 },
    ],
    numeric: { from: 26, to: 30 },
    // หน่วยตามท้ายโจทย์แต่ละข้อ (ช่อง "ตอบ ___ หน่วย" ในไฟล์โจทย์)
    numericUnits: { 26: "m/s", 27: "องศา", 28: "mm/s", 29: "kg", 30: "g" },
    entitlementFile: "physQuestions",
    resultFiles: ["physAnswers"],
    productId: "mock-phys1",
    courseSlug: "mock-alevel-physics",
    summary: "30 ข้อ / 90 นาที",
  },
};

/** path ห้องสอบของสนามนี้ (สนามหลักใช้ /exam เฉย ๆ ให้ลิงก์เก่าใช้ได้) */
export function examPath(exam: ExamDef): string {
  return exam.id === DEFAULT_EXAM_ID ? "/exam" : `/exam?exam=${exam.id}`;
}

/** path หน้าผลสอบของสนามนี้ */
export function examResultsPath(exam: ExamDef): string {
  return exam.id === DEFAULT_EXAM_ID ? "/exam/results" : `/exam/results?exam=${exam.id}`;
}

/** สนามสอบทั้งหมดที่สินค้า (รายการไฟล์) นี้ให้สิทธิ์ — เช่น bundle แพ็คสอบติดวิศวะ = 2 สนาม */
export function examsForFiles(files: readonly FileId[]): ExamDef[] {
  return Object.values(EXAMS).filter((e) => files.includes(e.entitlementFile));
}

/** คืนนิยามสนามสอบ — id ว่าง/ไม่รู้จัก = สนามหลัก (TPAT3) เพื่อให้ลิงก์เก่าใช้ได้เสมอ */
export function getExam(id?: string | null): ExamDef {
  return (id && EXAMS[id]) || EXAMS[DEFAULT_EXAM_ID];
}

export function isExamId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXAMS, id);
}

/** หา "ตอน" (บท) ของข้อที่กำหนด */
export function sectionOf(exam: ExamDef, no: number): ExamSection {
  return exam.sections.find((s) => no >= s.from && no <= s.to) ?? exam.sections[0];
}

/** น้ำหนักคะแนนของข้อที่กำหนด ตามช่วงที่นิยามไว้ใน exam.weights */
export function questionWeight(exam: ExamDef, no: number): number {
  return exam.weights.find((w) => no >= w.from && no <= w.to)?.weight ?? 1;
}
