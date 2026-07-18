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
export type FileId = "questions" | "answers" | "summary1" | "summary2" | "summary3";

export const FILE_INFO: Record<FileId, { label: string; downloadName: string }> = {
  questions: { label: "ไฟล์โจทย์ Mock TPAT3", downloadName: "mock-tpat3-questions.pdf" },
  answers: { label: "ไฟล์เฉลย Mock TPAT3", downloadName: "mock-tpat3-answers.pdf" },
  summary1: { label: "สรุปเล่ม 1: บทนำ + กลศาสตร์", downloadName: "mrtpat3-summary1-intro-mechanics.pdf" },
  summary2: {
    label: "สรุปเล่ม 2: สสาร + ความร้อน + คลื่น + แสง",
    downloadName: "mrtpat3-summary2-matter-heat-waves-light.pdf",
  },
  summary3: {
    label: "สรุปเล่ม 3: ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์",
    downloadName: "mrtpat3-summary3-electric-atom-nuclear.pdf",
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
    name: "Mock TPAT3 ชุดที่ 1 (โจทย์ + เฉลยละเอียด)",
    price: 299,
    files: ["questions", "answers"],
  },
  sum1: {
    id: "sum1",
    name: "สรุปเล่ม 1: บทนำ + กลศาสตร์",
    price: 199,
    files: ["summary1"],
  },
  sum2: {
    id: "sum2",
    name: "สรุปเล่ม 2: สสาร + ความร้อน + คลื่น + แสง",
    price: 169,
    files: ["summary2"],
  },
  sum3: {
    id: "sum3",
    name: "สรุปเล่ม 3: ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์",
    price: 189,
    files: ["summary3"],
  },
  "bundle-sum": {
    id: "bundle-sum",
    name: "ชุดสรุปครบ 3 เล่ม",
    price: 449,
    compareAt: 557, // 199 + 169 + 189
    files: ["summary1", "summary2", "summary3"],
  },
  "bundle-all": {
    id: "bundle-all",
    name: "ครบเซ็ตพร้อมสอบ (Mock + สรุปครบ 3 เล่ม)",
    price: 649,
    compareAt: 856, // 299 + 199 + 169 + 189
    files: ["questions", "answers", "summary1", "summary2", "summary3"],
  },
};

export function getProduct(id: string): Product | null {
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id)
    ? PRODUCTS[id as ProductId]
    : null;
}
