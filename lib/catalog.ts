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
  | "sum1content" // สรุปเล่ม 1 บทนำ+กลศาสตร์ (เนื้อหา/mind map)
  | "sum1formula" // สรุปเล่ม 1 (สูตรล้วน)
  | "sum2content" // สรุปเล่ม 2 (เนื้อหา)
  | "sum2formula" // สรุปเล่ม 2 (สูตรล้วน)
  | "sum3content" // สรุปเล่ม 3 (เนื้อหา)
  | "sum3formula"; // สรุปเล่ม 3 (สูตรล้วน)

export const FILE_INFO: Record<FileId, { label: string; downloadName: string }> = {
  questions: { label: "ไฟล์โจทย์ Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-questions.pdf" },
  answers: { label: "ไฟล์เฉลย Mock TPAT3 (ข้อ 1–70)", downloadName: "mock-tpat3-answers.pdf" },
  answersheet: { label: "กระดาษคำตอบ Mock TPAT3", downloadName: "mock-tpat3-answer-sheet.pdf" },
  sum1content: {
    label: "สรุปเล่ม 1 บทนำ + กลศาสตร์ (เนื้อหา)",
    downloadName: "mrtpat3-summary1-mechanics-content.pdf",
  },
  sum1formula: {
    label: "สรุปเล่ม 1 บทนำ + กลศาสตร์ (สูตรล้วน)",
    downloadName: "mrtpat3-summary1-mechanics-formula.pdf",
  },
  sum2content: {
    label: "สรุปเล่ม 2 สสาร + ความร้อน + คลื่น + แสง (เนื้อหา)",
    downloadName: "mrtpat3-summary2-content.pdf",
  },
  sum2formula: {
    label: "สรุปเล่ม 2 สสาร + ความร้อน + คลื่น + แสง (สูตรล้วน)",
    downloadName: "mrtpat3-summary2-formula.pdf",
  },
  sum3content: {
    label: "สรุปเล่ม 3 ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์ (เนื้อหา)",
    downloadName: "mrtpat3-summary3-content.pdf",
  },
  sum3formula: {
    label: "สรุปเล่ม 3 ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์ (สูตรล้วน)",
    downloadName: "mrtpat3-summary3-formula.pdf",
  },
};

export function isFileId(v: string): v is FileId {
  return v in FILE_INFO;
}

export type ProductId = "mock1" | "sum1" | "sum2" | "sum3" | "bundle-sum" | "bundle-all";

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
    price: 299,
    files: ["questions", "answers", "answersheet"],
  },
  sum1: {
    id: "sum1",
    name: "สรุปเล่ม 1: บทนำ + กลศาสตร์",
    price: 199,
    files: ["sum1content", "sum1formula"],
  },
  sum2: {
    id: "sum2",
    name: "สรุปเล่ม 2: สสาร + ความร้อน + คลื่น + แสง",
    price: 169,
    files: ["sum2content", "sum2formula"],
  },
  sum3: {
    id: "sum3",
    name: "สรุปเล่ม 3: ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์",
    price: 189,
    files: ["sum3content", "sum3formula"],
  },
  "bundle-sum": {
    id: "bundle-sum",
    name: "ชุดสรุปครบ 3 เล่ม",
    price: 399,
    compareAt: 557, // 199 + 169 + 189
    files: ["sum1content", "sum1formula", "sum2content", "sum2formula", "sum3content", "sum3formula"],
  },
  "bundle-all": {
    id: "bundle-all",
    name: "ครบเซ็ตพร้อมสอบ (Mock + สรุปครบ 3 เล่ม)",
    price: 599,
    compareAt: 856, // 299 + 199 + 169 + 189
    files: [
      "questions",
      "answers",
      "answersheet",
      "sum1content",
      "sum1formula",
      "sum2content",
      "sum2formula",
      "sum3content",
      "sum3formula",
    ],
  },
};

export function getProduct(id: string): Product | null {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id as ProductId]
    : null;
}
