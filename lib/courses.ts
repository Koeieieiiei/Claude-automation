/**
 * เนื้อหาหน้า "รายละเอียดคอร์ส" (/courses/<slug>) — แก้ข้อความบนหน้าได้ที่ไฟล์นี้ที่เดียว
 * ราคา/ไฟล์ที่ได้รับยังอ่านจาก lib/catalog.ts เหมือนเดิม (ไฟล์นี้เก็บแค่คำบรรยาย)
 *
 * import ได้ทั้ง client และ server
 * สารบัญเนื้อหาถอดจากไฟล์จริง: เล่มเนื้อหา (assets/master-tpat3-content.pdf, 160 หน้า)
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
  meta?: string; // เช่น "15 ข้อ · 20 คะแนน" หรือ "4 บท"
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
    meta: "ข้อ 1–15 · 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 2 ความถนัดด้านมิติสัมพันธ์",
    meta: "ข้อ 16–30 · 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 3 ความถนัดด้านเชิงกลและความถนัดด้านฟิสิกส์",
    meta: "ข้อ 31–45 · 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 4 ความคิดเชิงวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "ข้อ 46–60 · 20 คะแนน",
    items: [],
  },
  {
    title: "ตอนที่ 5 ความสนใจข่าวสารความรู้ทางด้านวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    meta: "ข้อ 61–70 · 20 คะแนน",
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
      { label: "คอร์ส", value: "ข้อสอบเสมือนจริง Mock TPAT3 ชุดที่ 1" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      {
        label: "เหมาะสำหรับ",
        value: "น้องที่อยากเช็คความพร้อมก่อนสอบจริง รู้คะแนน อันดับ และบทที่ต้องซ่อม",
      },
      { label: "รูปแบบ", value: "สอบออนไลน์บนเว็บ + ไฟล์ PDF โหลดเก็บไว้ได้" },
    ],
    includes: [
      "ห้องสอบออนไลน์ 70 ข้อ จับเวลา 3 ชม. (สอบได้ 1 ครั้ง) พร้อมผลวิเคราะห์",
      "ไฟล์เฉลยละเอียดทีละขั้นทุกข้อ (PDF)",
    ],
    highlights: [
      "ทำข้อสอบบนเว็บ จับเวลา 3 ชั่วโมงเหมือนสนามจริง",
      "ส่งแล้วรู้ผลทันที — คะแนนเต็ม 100 อันดับเทียบผู้สอบคนอื่น ค่าเฉลี่ย และกราฟการแจกแจงคะแนน",
      "คะแนนรายตอน + วิเคราะห์รายข้อครบ 70 ข้อ พร้อมคำแนะนำว่าควรซ่อมตรงไหน",
      "บันทึกคำตอบอัตโนมัติ เน็ตหลุดหรือรีเฟรชก็ทำต่อได้",
      "เฉลยละเอียดทีละขั้น อ่านแล้วเข้าใจวิธีคิด ไม่ใช่แค่รู้ช้อยส์",
      "กลับมาเข้าเรียน/โหลดไฟล์ได้ตลอดที่หน้า “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "โครงข้อสอบ (ตรงตามสนามจริง)",
    contents: MOCK_SECTIONS,
    sample: {
      href: "/samples/tpat3-mock-sample.pdf",
      downloadName: "TPat3 Mock Sample.pdf",
      label: "โหลดตัวอย่างโจทย์ + เฉลยฟรี",
    },
  },
  {
    slug: "tpat3-content",
    productId: "sum4",
    title: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "ครบ 5 พาร์ต รวมในไฟล์เดียว",
    covers: [CONTENT_COVER],
    bannerTone: "rose",
    stats: [
      { icon: "pages", label: "ความยาว", value: "160 หน้า" },
      { icon: "chapters", label: "เนื้อหา", value: "5 Part · 38 บท" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "คอร์ส", value: "เนื้อหาทั้งหมดสำหรับสอบ TPAT3 (Part 1–5)" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      {
        label: "เหมาะสำหรับ",
        value: "น้องที่มีพื้นฐานแล้ว อยากเก็บเนื้อหาให้ครบทุกพาร์ตพร้อม tricks ก่อนสอบ",
      },
      { label: "รูปแบบ", value: "ไฟล์ PDF 1 เล่ม โหลดเก็บไว้อ่านได้ทุกอุปกรณ์" },
    ],
    includes: ["ไฟล์เนื้อหาทั้งหมดสำหรับสอบ TPAT3 Part 1–5 (PDF 160 หน้า)"],
    highlights: [
      "ครบทั้ง 5 พาร์ตของข้อสอบจริง รวมในไฟล์เดียว",
      "ทุกบทเปิดด้วยกล่อง Key สรุปหัวใจของบท + ศัพท์ที่ข้อสอบใช้",
      "Part 3 เชิงกลและฟิสิกส์ 17 บท ใช้ต่อใน Physics A-Level ได้",
      "สารบัญกดกระโดดไปหน้านั้นได้ทันที",
      "มีลำดับการอ่านที่แนะนำ อ่านจบแล้วไปวัดผลต่อกับ Mock TPAT3",
      "กลับมาโหลดไฟล์ได้ตลอดที่หน้า “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "เนื้อหาในคอร์ส",
    contents: CONTENT_PARTS,
    sample: {
      href: "/samples/tpat3-summary1-sample.pdf",
      downloadName: "ตัวอย่างเนื้อหา TPAT3.pdf",
      label: "โหลดตัวอย่างเนื้อหาฟรี",
    },
  },
  {
    slug: "complete-set",
    productId: "bundle-all",
    title: "ครบเซ็ตพร้อมสอบ TPAT3",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "เนื้อหาครบ + ข้อสอบเสมือนจริง",
    covers: [MOCK_COVERS[1], CONTENT_COVER],
    bannerTone: "maroon",
    stats: [
      { icon: "exam", label: "ข้อสอบ Mock", value: "70 ข้อ · 3 ชม." },
      { icon: "pages", label: "เล่มเนื้อหา", value: "160 หน้า" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "คอร์ส", value: "ครบเซ็ตพร้อมสอบ (Mock TPAT3 + เนื้อหาทั้งหมดสำหรับสอบ TPAT3)" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่อยากเก็บเนื้อหาให้ครบ แล้ววัดผลด้วยข้อสอบเสมือนจริง" },
      { label: "รูปแบบ", value: "สอบออนไลน์บนเว็บ + ไฟล์ PDF โหลดเก็บไว้ได้" },
    ],
    includes: [
      "ห้องสอบ Mock TPAT3 ออนไลน์ 70 ข้อ (สอบได้ 1 ครั้ง) พร้อมผลวิเคราะห์",
      "ไฟล์เฉลยละเอียด Mock TPAT3 (PDF)",
      "ไฟล์เนื้อหาทั้งหมดสำหรับสอบ TPAT3 Part 1–5 (PDF 160 หน้า)",
    ],
    highlights: [
      "อ่านเนื้อหาครบ 5 พาร์ตก่อน แล้วจับเวลาทำ Mock รวดเดียวเหมือนสนามจริง",
      "ส่งข้อสอบแล้วรู้คะแนน อันดับ และบทที่ต้องซ่อม — กลับไปอ่านบทนั้นในเล่มเนื้อหาได้ทันที",
      "ถูกกว่าซื้อแยก",
      "กลับมาเข้าเรียน/โหลดไฟล์ได้ตลอดที่หน้า “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "เนื้อหาในคอร์ส",
    contents: [
      {
        title: "ข้อสอบ Mock TPAT3 ชุดที่ 1",
        meta: "70 ข้อ · 100 คะแนน",
        items: MOCK_SECTIONS.map((s) => `${s.title} (${s.meta})`),
      },
      ...CONTENT_PARTS,
    ],
  },
];

export function getCourse(slug: string): CourseInfo | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function courseForProduct(productId: string): CourseInfo | null {
  return COURSES.find((c) => c.productId === productId) ?? null;
}
