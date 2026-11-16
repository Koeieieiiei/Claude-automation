/**
 * แคตตาล็อกสินค้า — "แหล่งความจริงเดียว" ของชื่อ ราคา และไฟล์ที่ลูกค้าได้รับ
 *
 * ไฟล์นี้ต้อง import ได้ทั้งฝั่ง client (หน้าเว็บโชว์ราคา) และ server (คิดเงิน/ส่งไฟล์)
 * จึงห้ามมี dependency ของ Node (fs, path ฯลฯ) — path ไฟล์ต้นฉบับอยู่ใน lib/watermark.ts
 *
 * ราคาที่ Stripe เรียกเก็บอ่านจากที่นี่เสมอ ฝั่ง client ส่งมาแค่ productId
 * (กันการปลอมราคาจากหน้าเว็บ และกันโชว์ราคาหนึ่งแต่เก็บอีกราคา)
 *
 * โมเดลปัจจุบัน (เจ้าของสั่ง 2026-09-27): Mock TPAT3 ขาย ฿199 · เล่มเนื้อหา TPAT3 (174 หน้า) **แจกฟรี**
 * (price 0 = กด "รับฟรี" ผ่าน lib/claim.ts ไม่ผ่าน Stripe) · ครบเซ็ต bundle-all เลิกขาย (คงไว้ให้ออเดอร์เก่า)
 *
 * เพิ่ม 2026-11-16 (เจ้าของสั่ง): Mock A-Level ฟิสิกส์ ฿149 (ห้องสอบออนไลน์แบบเดียวกับ TPAT3) ·
 * หนังสือตะลุยโจทย์ TPAT3 ฿399 · หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ ฿299 (ขายเป็นหนังสือ PDF) ·
 * Bundle 3 แบบ: TPAT3 Bundle ฿499 (598) / A-Level Physics Bundle ฿379 (448) / แพ็คสอบติดวิศวะ ฿799 (1,046)
 * bundle = รวมไฟล์ของสินค้าย่อย (bundleOf) — ราคาเต็ม compareAt ต้องเท่ากับผลรวมราคาสินค้าย่อย (มี test คุม)
 */

/** ไฟล์ PDF แต่ละตัวที่ระบบส่งมอบได้ */
export type FileId =
  | "questions" // Mock: ไฟล์โจทย์ 1–70
  | "answers" // Mock: ไฟล์เฉลย 1–70
  | "answersheet" // Mock: กระดาษคำตอบ
  | "tpat3content" // เนื้อหาทั้งหมดสำหรับสอบ TPAT3 (Part 1–5 ไฟล์เดียว)
  | "physQuestions" // Mock A-Level ฟิสิกส์: ไฟล์โจทย์ 1–30 (= สิทธิ์ห้องสอบ phys-1)
  | "physAnswers" // Mock A-Level ฟิสิกส์: ไฟล์เฉลยละเอียด
  | "physAnswersheet" // Mock A-Level ฟิสิกส์: กระดาษคำตอบ (scripts/make-phys-answersheet.py)
  | "tpat3Drill" // หนังสือตะลุยโจทย์ TPAT3 (ข้อสอบเสมือนจริง 4 ชุด + เฉลย)
  | "physDrill" // หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ (ข้อสอบเสมือนจริง 4 ชุด + เฉลย)
  // ↓ ไฟล์ของสินค้า "สรุป TPAT3" รุ่นเก่า (เลิกขาย 2026-09-16) — ห้ามลบ
  //   ลิงก์ในอีเมลของคนที่ซื้อไปแล้วยังฝังชื่อไฟล์เหล่านี้อยู่ ต้องโหลดได้ต่อ
  | "sum4content" // สรุป TPAT3 รุ่นเก่า (ไฟล์เนื้อหา / Mind Map)
  | "sum4formula"; // สรุป TPAT3 รุ่นเก่า (ไฟล์สูตรล้วน)

export const FILE_INFO: Record<FileId, { label: string; downloadName: string }> = {
  questions: { label: "โจทย์ Mock TPAT3 (PDF)", downloadName: "mock-tpat3-questions.pdf" },
  answers: { label: "เฉลยละเอียด Mock TPAT3 (PDF)", downloadName: "mock-tpat3-answers.pdf" },
  answersheet: { label: "กระดาษคำตอบ Mock TPAT3", downloadName: "mock-tpat3-answer-sheet.pdf" },
  tpat3content: {
    label: "เนื้อหา TPAT3 Part 1–5 (PDF)",
    downloadName: "mrtpat3-tpat3-content.pdf",
  },
  physQuestions: {
    label: "โจทย์ Mock A-Level ฟิสิกส์ (PDF)",
    downloadName: "mock-alevel-physics-questions.pdf",
  },
  physAnswers: {
    label: "เฉลยละเอียด Mock A-Level ฟิสิกส์ (PDF)",
    downloadName: "mock-alevel-physics-answers.pdf",
  },
  physAnswersheet: {
    label: "กระดาษคำตอบ Mock A-Level ฟิสิกส์",
    downloadName: "mock-alevel-physics-answer-sheet.pdf",
  },
  tpat3Drill: {
    label: "หนังสือตะลุยโจทย์ TPAT3 (PDF)",
    downloadName: "mrtpat3-tpat3-drill-book.pdf",
  },
  physDrill: {
    label: "หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ (PDF)",
    downloadName: "mrtpat3-alevel-physics-drill-book.pdf",
  },
  sum4content: {
    label: "สรุปเนื้อหา TPAT3 (ไฟล์เนื้อหา)",
    downloadName: "mrtpat3-summary-content.pdf",
  },
  sum4formula: {
    label: "สรุปเนื้อหา TPAT3 (ไฟล์สูตรล้วน)",
    downloadName: "mrtpat3-summary-formula.pdf",
  },
};

export function isFileId(v: string): v is FileId {
  return v in FILE_INFO;
}

export type ProductId =
  | "mock1"
  | "sum4"
  | "bundle-all"
  | "mock-phys1"
  | "drill-tpat3"
  | "drill-phys"
  | "bundle-tpat3"
  | "bundle-phys"
  | "bundle-engineer";

export interface Product {
  id: ProductId;
  name: string;
  /** บาท — 0 = แจกฟรี (กด "รับฟรี" ไม่ผ่าน Stripe) */
  price: number;
  /** ราคารวมถ้าซื้อแยก (ไว้โชว์ส่วนลดของ bundle) — ไม่ใส่ = ไม่ใช่ bundle */
  compareAt?: number;
  files: FileId[];
  /** เลิกขาย/เลิกแจกแล้ว — คงไว้ให้ออเดอร์เก่าและหลังร้านอ้างถึง ห้ามซื้อ/รับใหม่ */
  retired?: boolean;
  /** bundle: สินค้าย่อยที่รวมอยู่ (ไว้โชว์บนการ์ด/หน้ารายละเอียด) — files ต้องเท่ากับไฟล์ของสินค้าย่อยรวมกัน */
  bundleOf?: ProductId[];
  /** ชื่อสั้นบนการ์ด/ปุ่ม (ไม่ใส่ = ใช้ name) */
  shortName?: string;
}

export const PRODUCTS: Record<ProductId, Product> = {
  mock1: {
    id: "mock1",
    name: "Mock TPAT3 ชุดที่ 1",
    shortName: "Mock TPAT3",
    price: 199, // 2026-09-27 เจ้าของสั่ง (เดิม 159; เคยลดเป็น 129 แล้วขอกลับ 199 วันเดียวกัน)
    files: ["questions", "answers", "answersheet"],
  },
  // id "sum4" คงไว้ตามเดิม (ออเดอร์เก่า/สถิติหลังร้านอ้างถึง) — ตัวสินค้าเป็นเล่มเนื้อหาทั้งหมด และแจกฟรีตั้งแต่ 2026-09-27
  sum4: {
    id: "sum4",
    name: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3",
    price: 0,
    files: ["tpat3content"],
  },
  // ครบเซ็ตยุคขาย (159 + 219) — เลิกขาย 2026-09-27 เพราะเล่มเนื้อหาแจกฟรีแล้ว
  "bundle-all": {
    id: "bundle-all",
    name: "ครบเซ็ตพร้อมสอบ (Mock + เนื้อหาทั้งหมดสำหรับสอบ TPAT3)",
    price: 329,
    compareAt: 378,
    files: ["questions", "answers", "answersheet", "tpat3content"],
    retired: true,
  },

  // ===== เพิ่ม 2026-11-16 (เจ้าของสั่ง) =====
  "mock-phys1": {
    id: "mock-phys1",
    name: "Mock A-Level ฟิสิกส์ ชุดที่ 1",
    shortName: "Mock A-Level ฟิสิกส์",
    price: 149,
    files: ["physQuestions", "physAnswers", "physAnswersheet"],
  },
  "drill-tpat3": {
    id: "drill-tpat3",
    name: "หนังสือตะลุยโจทย์ TPAT3 (ข้อสอบเสมือนจริง 4 ชุด)",
    shortName: "หนังสือตะลุยโจทย์ TPAT3",
    price: 399,
    files: ["tpat3Drill"],
  },
  "drill-phys": {
    id: "drill-phys",
    name: "หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ (ข้อสอบเสมือนจริง 4 ชุด)",
    shortName: "หนังสือตะลุยโจทย์ A-Level ฟิสิกส์",
    price: 299,
    files: ["physDrill"],
  },
  "bundle-tpat3": {
    id: "bundle-tpat3",
    name: "TPAT3 Bundle (Mock TPAT3 + หนังสือตะลุยโจทย์ TPAT3)",
    shortName: "TPAT3 Bundle",
    price: 499,
    compareAt: 598,
    bundleOf: ["mock1", "drill-tpat3"],
    files: ["questions", "answers", "answersheet", "tpat3Drill"],
  },
  "bundle-phys": {
    id: "bundle-phys",
    name: "A-Level Physics Bundle (Mock A-Level ฟิสิกส์ + หนังสือตะลุยโจทย์ A-Level ฟิสิกส์)",
    shortName: "A-Level Physics Bundle",
    price: 379,
    compareAt: 448,
    bundleOf: ["mock-phys1", "drill-phys"],
    files: ["physQuestions", "physAnswers", "physAnswersheet", "physDrill"],
  },
  // ชื่อตามที่เจ้าของตั้ง "แพ็คสอบติดวิศวะ" (สะกด "แพ็ค") = ครบทุกอย่างที่ขาย
  "bundle-engineer": {
    id: "bundle-engineer",
    name: "แพ็คสอบติดวิศวะ (ครบทุกอย่าง TPAT3 + A-Level ฟิสิกส์)",
    shortName: "แพ็คสอบติดวิศวะ",
    price: 799,
    compareAt: 1046,
    bundleOf: ["mock1", "drill-tpat3", "mock-phys1", "drill-phys"],
    files: [
      "questions",
      "answers",
      "answersheet",
      "tpat3Drill",
      "physQuestions",
      "physAnswers",
      "physAnswersheet",
      "physDrill",
    ],
  },
};

/** ชื่อสั้นของสินค้า (บนการ์ด/ปุ่ม) */
export function displayName(p: Product): string {
  return p.shortName ?? p.name;
}

/** ส่วนลดของ bundle เทียบราคาซื้อแยก — ไม่ใช่ bundle = null */
export function bundleSaving(p: Product): { amount: number; percent: number } | null {
  if (!p.compareAt || p.compareAt <= p.price) return null;
  const amount = p.compareAt - p.price;
  return { amount, percent: Math.round((amount / p.compareAt) * 100) };
}

/** สินค้าที่กด "รับฟรี" ได้ (แจกฟรีและยังไม่เลิกแจก) */
export function isClaimableProduct(id: string): boolean {
  const p = getProduct(id);
  return Boolean(p && !p.retired && p.price === 0);
}

/** สินค้าที่ซื้อผ่าน Stripe ได้ (มีราคาและยังขายอยู่) */
export function isPurchasableProduct(id: string): boolean {
  const p = getProduct(id);
  return Boolean(p && !p.retired && p.price > 0);
}

export function getProduct(id: string): Product | null {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id as ProductId]
    : null;
}
