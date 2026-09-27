/**
 * เนื้อหาหน้า "รายละเอียดคอร์ส" (/courses/<slug>) — แก้ข้อความบนหน้าได้ที่ไฟล์นี้ที่เดียว
 * ราคา/ไฟล์ที่ได้รับยังอ่านจาก lib/catalog.ts เหมือนเดิม (ไฟล์นี้เก็บแค่คำบรรยาย) — เล่มเนื้อหาแจกฟรี, ครบเซ็ตเลิกขาย 2026-09-27
 *
 * import ได้ทั้ง client และ server
 * สารบัญเนื้อหาถอดจากไฟล์จริง: เล่มเนื้อหา (assets/master-tpat3-content.pdf, 174 หน้า)
 * และโครงข้อสอบจาก lib/exam-manifests/tpat3-1.json — เปลี่ยนไฟล์เมื่อไหร่ต้องแก้ตรงนี้ด้วย
 */
import type { ProductId } from "./catalog";

export interface CourseStat {
  icon: "questions" | "clock" | "pages" | "chapters" | "infinity" | "exam";
  label: string;
  value: string;
}

export interface CourseChapterGroup {
  title: string;
  meta?: string; // เช่น "15 ข้อ / 20 คะแนน" หรือ "4 บท"
  items: string[];
}

export interface CourseInfo {
  slug: string;
  productId: ProductId;
  title: string;
  subject: string;
  /** คำโปรยสั้นบนแบนเนอร์ */
  tagline: string;
  /** ปกที่วางบนแบนเนอร์ (public/covers) */
  covers: { src: string; alt: string }[];
  /** สีพื้นแบนเนอร์ (โทนเดียวกับปก) */
  bannerTone: "blue" | "rose" | "maroon";
  stats: CourseStat[];
  /** บรรทัด "หัวข้อ: ค่า" ต้นรายละเอียด */
  facts: { label: string; value: string }[];
  /** สิ่งที่ได้รับในคอร์ส */
  includes: string[];
  highlights: string[];
  contentsTitle: string;
  contents: CourseChapterGroup[];
  sample?: { href: string; downloadName: string; label: string };
}

const MOCK_SECTIONS: CourseChapterGroup[] = [
  {
    title: "ตอนที่ 1 ความถนัดด้านตัวเลข",
    meta: "ข้อ 1–15 / 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 2 ความถนัดด้านมิติสัมพันธ์",
    meta: "ข้อ 16–30 / 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 3 ความถนัดด้านเชิงกลและความถนัดด้านฟิสิกส์",
    meta: "ข้อ 31–45 / 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 4 ความคิดเชิงวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "ข้อ 46–60 / 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 5 ความสนใจข่าวสารความรู้ทางด้านวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "ข้อ 61–70 / 20 คะแนน",
    items: [],
  },
];

const CONTENT_PARTS: CourseChapterGroup[] = [
  {
    title: "Part 1 ความถนัดด้านตัวเลข",
    meta: "4 บท",
    items: ["อนุกรมตัวเลข", "ความสัมพันธ์", "ปฏิบัติการ", "คณิตศาสตร์ ม.ปลาย"],
  },
  {
    title: "Part 2 ความถนัดด้านมิติสัมพันธ์",
    meta: "5 บท",
    items: [
      "พื้นฐานรูปทรง",
      "เมทริกซ์และอุปมาอุปไมยภาพ",
      "รูปคลี่และการพับกล่อง",
      "ภาพฉายและการนับลูกบาศก์",
      "การพับ เจาะ และแสงเงา",
    ],
  },
  {
    title: "Part 3 ความถนัดด้านเชิงกลและฟิสิกส์",
    meta: "17 บท",
    items: [
      "การเคลื่อนที่แนวตรง",
      "แรงและกฎการเคลื่อนที่ของนิวตัน",
      "สมดุลกลและโมเมนต์",
      "งาน กำลัง และพลังงาน",
      "เครื่องกลผ่อนแรง",
      "เฟือง สายพาน และกลไก",
      "โมเมนตัมและการชน",
      "การเคลื่อนที่แบบโพรเจกไทล์",
      "การเคลื่อนที่แบบวงกลมและสนามโน้มถ่วง",
      "การเคลื่อนที่แบบซิมเปิลฮาร์มอนิก",
      "สมบัติของแข็งและวัสดุ",
      "ความดันและของไหล",
      "ความร้อนและแก๊ส",
      "คลื่น เสียง และแสง",
      "ไฟฟ้าและวงจร",
      "แม่เหล็กไฟฟ้าและฟิสิกส์แผนใหม่",
      "สนามไฟฟ้า",
    ],
  },
  {
    title: "Part 4 ความคิดเชิงวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "3 บท",
    items: [
      "ตัวแปรและการออกแบบการทดลอง",
      "การวิเคราะห์กราฟและตาราง",
      "ความปลอดภัยไฟฟ้าและการแก้ปัญหาหน้างาน",
    ],
  },
  {
    title: "Part 5 ความสนใจข่าวสารความรู้ด้านวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "9 บท",
    items: [
      "สัญลักษณ์ความปลอดภัยและป้ายเตือน",
      "การติดไฟ เพลิงไหม้ และการดับเพลิง",
      "พลังงานและเชื้อเพลิง",
      "สิ่งแวดล้อมและวิกฤตการณ์โลก",
      "อวกาศและดาราศาสตร์",
      "นิวเคลียร์ รังสี และการแพทย์",
      "วัสดุศาสตร์และพื้นฐานวิศวกรรม",
      "เทคโนโลยี ดิจิทัล และปัญญาประดิษฐ์",
      "นักวิทยาศาสตร์และประวัติศาสตร์วิทยาศาสตร์",
    ],
  },
];

const MOCK_COVERS = [
  { src: "/covers/answersheet.png", alt: "กระดาษคำตอบ Mock TPAT3" },
  { src: "/covers/mock.png", alt: "ปกข้อสอบ Mock TPAT3" },
];
const CONTENT_COVER = { src: "/covers/tpat3-content.png", alt: "ปกเนื้อหา TPAT3" };

export const COURSES: CourseInfo[] = [
  {
    slug: "mock-tpat3",
    productId: "mock1",
    title: "ข้อสอบ Mock TPAT3 ชุดที่ 1",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "ซ้อมเหมือนสนามจริง รู้ผลทันที",
    covers: MOCK_COVERS,
    bannerTone: "blue",
    stats: [
      { icon: "questions", label: "จำนวนข้อ", value: "70 ข้อ" },
      { icon: "clock", label: "จับเวลาสอบ", value: "3 ชั่วโมง" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "คอร์ส", value: "Mock TPAT3 ชุดที่ 1" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      {
        label: "เหมาะสำหรับ",
        value: "น้องที่อยากวัดความพร้อมก่อนสอบจริง",
      },
      { label: "รูปแบบ", value: "สอบออนไลน์ + ไฟล์ PDF" },
    ],
    includes: [
      "ห้องสอบออนไลน์ 70 ข้อ 3 ชม. (1 ครั้ง) + ผลวิเคราะห์",
      "เฉลยละเอียดทุกข้อ (PDF)",
    ],
    highlights: [
      "จับเวลา 3 ชั่วโมงเหมือนสนามจริง",
      "รู้ผลทันที: คะแนน อันดับ ค่าเฉลี่ย และกราฟการแจกแจง",
      "คะแนนรายตอน + วิเคราะห์รายข้อพร้อมคำแนะนำ",
      "บันทึกคำตอบอัตโนมัติ เน็ตหลุดหรือรีเฟรชก็ทำต่อได้",
      "เฉลยละเอียดทีละขั้น เข้าใจวิธีคิด",
      "อยู่ที่ “คอร์สของฉัน” ตลอด ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "โครงข้อสอบ",
    contents: MOCK_SECTIONS,
    sample: {
      href: "/samples/tpat3-mock-sample.pdf",
      downloadName: "TPat3 Mock Sample.pdf",
      label: "ตัวอย่างข้อสอบฟรี",
    },
  },
  {
    slug: "tpat3-content",
    productId: "sum4",
    title: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "ครบ 5 พาร์ตในเล่มเดียว แจกฟรี",
    covers: [CONTENT_COVER],
    bannerTone: "rose",
    stats: [
      { icon: "pages", label: "ความยาว", value: "174 หน้า" },
      { icon: "chapters", label: "เนื้อหา", value: "5 Part / 38 บท" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "คอร์ส", value: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3 (Part 1–5)" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      {
        label: "เหมาะสำหรับ",
        value: "น้องที่อยากเก็บเนื้อหาให้ครบทุกพาร์ตก่อนสอบ",
      },
      { label: "รูปแบบ", value: "ไฟล์ PDF 1 เล่ม" },
    ],
    includes: ["เนื้อหา TPAT3 Part 1–5 (PDF 174 หน้า)"],
    highlights: [
      "ครบ 5 พาร์ตของข้อสอบจริง",
      "ทุกบทมีกล่อง Key สรุปหัวใจของบท",
      "Part 3 ฟิสิกส์ 17 บท ใช้ต่อ A-Level ได้",
      "สารบัญกดไปหน้านั้นได้ทันที",
      "มีลำดับการอ่านแนะนำ",
      "อยู่ที่ “คอร์สของฉัน” ตลอด ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "เนื้อหาในคอร์ส",
    contents: CONTENT_PARTS,
  },
];

export function getCourse(slug: string): CourseInfo | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function courseForProduct(productId: string): CourseInfo | null {
  return COURSES.find((c) => c.productId === productId) ?? null;
}
