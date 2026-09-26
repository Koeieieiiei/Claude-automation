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
 */

/** ไฟล์ PDF แต่ละตัวที่ระบบส่งมอบได้ */
export type FileId =
  | "questions" // Mock: ไฟล์โจทย์ 1–70
  | "answers" // Mock: ไฟล์เฉลย 1–70
  | "answersheet" // Mock: กระดาษคำตอบ
  | "tpat3content" // เนื้อหาทั้งหมดสำหรับสอบ TPAT3 (Part 1–5 ไฟล์เดียว)
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

export type ProductId = "mock1" | "sum4" | "bundle-all";

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
}

export const PRODUCTS: Record<ProductId, Product> = {
  mock1: {
    id: "mock1",
    name: "Mock TPAT3 ชุดที่ 1",
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
};

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
