/**
 * แคตตาล็อกคอร์ส — "แหล่งความจริงเดียว" ของชื่อและไฟล์ที่ผู้เรียนได้รับ
 *
 * ⚠️ ตั้งแต่ 2026-09-26 (เจ้าของสั่ง): ทุกคอร์ส **แจกฟรี** — ไม่มีราคา ไม่มีการชำระเงิน ไม่มี Stripe
 * ผู้เรียนล็อกอิน Google แล้วกด "รับฟรี" → ระบบสร้าง order ยอด 0 สถานะ delivered ให้ (lib/claim.ts)
 * ระบบสิทธิ์/ดาวน์โหลด/ห้องสอบยังอ่านจากตาราง orders เหมือนเดิมทุกอย่าง
 *
 * ไฟล์นี้ต้อง import ได้ทั้งฝั่ง client (หน้าเว็บ) และ server (ส่งไฟล์)
 * จึงห้ามมี dependency ของ Node (fs, path ฯลฯ) — path ไฟล์ต้นฉบับอยู่ใน lib/watermark.ts
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
  questions: { label: "ไฟล์โจทย์ Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-questions.pdf" },
  answers: { label: "ไฟล์เฉลย Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-answers.pdf" },
  answersheet: { label: "กระดาษคำตอบ Mock TPAT3", downloadName: "mock-tpat3-answer-sheet.pdf" },
  tpat3content: {
    label: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3 (Part 1–5)",
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

/**
 * id คงไว้ตามเดิมทั้งหมด (ตาราง orders / สถิติหลังร้าน / Stripe metadata เก่าอ้างถึง):
 *   mock1      = ชุด Mock TPAT3
 *   sum4       = เล่มเนื้อหา TPAT3 (ชื่อ id มาจากยุค "สรุปชุดที่ 4" — ตัวสินค้าเปลี่ยนไปแล้ว)
 *   bundle-all = ครบเซ็ตยุคขาย (เลิกแจกแบบเซ็ตแล้ว — คงไว้ให้ออเดอร์เก่าโชว์ถูก)
 */
export type ProductId = "mock1" | "sum4" | "bundle-all";

export interface Product {
  id: ProductId;
  name: string;
  files: FileId[];
  /** ไม่เปิดให้กดรับแล้ว (คงไว้ให้ออเดอร์เก่า/หลังร้านอ้างถึง) */
  retired?: boolean;
}

export const PRODUCTS: Record<ProductId, Product> = {
  mock1: {
    id: "mock1",
    name: "Mock TPAT3 ชุดที่ 1 (โจทย์ + เฉลย + กระดาษคำตอบ)",
    files: ["questions", "answers", "answersheet"],
  },
  sum4: {
    id: "sum4",
    name: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3",
    files: ["tpat3content"],
  },
  "bundle-all": {
    id: "bundle-all",
    name: "ครบเซ็ตพร้อมสอบ (Mock + เนื้อหาทั้งหมดสำหรับสอบ TPAT3)",
    files: ["questions", "answers", "answersheet", "tpat3content"],
    retired: true,
  },
};

/** คอร์สที่กด "รับฟรี" ได้ (ทีละคอร์ส — รับครบสองคอร์สก็ได้ทุกไฟล์เท่าครบเซ็ตเดิม) */
export const CLAIMABLE_PRODUCTS: readonly ProductId[] = ["mock1", "sum4"];

export function isClaimableProduct(id: string): id is ProductId {
  return (CLAIMABLE_PRODUCTS as readonly string[]).includes(id);
}

export function getProduct(id: string): Product | null {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id as ProductId]
    : null;
}
