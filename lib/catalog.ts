/**
 * แคตตาล็อกสินค้า — "แหล่งความจริงเดียว" ของชื่อ ราคา และไฟล์ที่ลูกค้าได้รับ
 *
 * ไฟล์นี้ต้อง import ได้ทั้งฝั่ง client (หน้าเว็บโชว์ราคา) และ server (คิดเงิน/ส่งไฟล์)
 * จึงห้ามมี dependency ของ Node (fs, path ฯลฯ) — path ไฟล์ต้นฉบับอยู่ใน lib/watermark.ts
 *
 * ราคาที่ Stripe เรียกเก็บอ่านจากที่นี่เสมอ ฝั่ง client ส่งมาแค่ productId
 * (กันการปลอมราคาจากหน้าเว็บ และกันโชว์ราคาหนึ่งแต่เก็บอีกราคา)
 */

/** ไฟล์ PDF แต่ละตัวที่ระบบส่งมอบได้ */
export type FileId =
  | "questions" // Mock: ไฟล์โจทย์ 1–70
  | "answers" // Mock: ไฟล์เฉลย 1–70
  | "answersheet" // Mock: กระดาษคำตอบ
  | "sum4content" // สรุปเนื้อหา TPAT3 (ไฟล์เนื้อหา)
  | "sum4formula"; // สรุปเนื้อหา TPAT3 (ไฟล์สูตรล้วน)

export const FILE_INFO: Record<FileId, { label: string; downloadName: string }> = {
  questions: { label: "ไฟล์โจทย์ Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-questions.pdf" },
  answers: { label: "ไฟล์เฉลย Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-answers.pdf" },
  answersheet: { label: "กระดาษคำตอบ Mock TPAT3", downloadName: "mock-tpat3-answer-sheet.pdf" },
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
  price: number; // บาท
  /** ราคารวมถ้าซื้อแยก (ไว้โชว์ส่วนลดของ bundle) — ไม่ใส่ = ไม่ใช่ bundle */
  compareAt?: number;
  files: FileId[];
}

export const PRODUCTS: Record<ProductId, Product> = {
  mock1: {
    id: "mock1",
    name: "Mock TPAT3 ชุดที่ 1 (โจทย์ + เฉลย + กระดาษคำตอบ)",
    price: 159,
    files: ["questions", "answers", "answersheet"],
  },
  sum4: {
    id: "sum4",
    name: "สรุปเนื้อหาสำหรับสอบ TPAT3 (เนื้อหา + สูตรล้วน)",
    price: 99,
    files: ["sum4content", "sum4formula"],
  },
  "bundle-all": {
    id: "bundle-all",
    name: "ครบเซ็ตพร้อมสอบ (Mock + สรุปเนื้อหา TPAT3)",
    price: 219,
    compareAt: 258, // 159 + 99
    files: ["questions", "answers", "answersheet", "sum4content", "sum4formula"],
  },
};

export function getProduct(id: string): Product | null {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id as ProductId]
    : null;
}
