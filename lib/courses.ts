/**
 * เนื้อหาหน้า "รายละเอียดคอร์ส" (/courses/<slug>) — แก้ข้อความบนหน้าได้ที่ไฟล์นี้ที่เดียว
 * ราคา/ไฟล์ที่ได้รับยังอ่านจาก lib/catalog.ts เหมือนเดิม (ไฟล์นี้เก็บแค่คำบรรยาย) — เล่มเนื้อหาแจกฟรี, ครบเซ็ตเลิกขาย 2026-09-27
 *
 * import ได้ทั้ง client และ server
 * สารบัญเนื้อหาถอดจากไฟล์จริง: เล่มเนื้อหา (assets/master-tpat3-content.pdf, 174 หน้า)
 * และโครงข้อสอบจาก lib/exam-manifests/tpat3-1.json — เปลี่ยนไฟล์เมื่อไหร่ต้องแก้ตรงนี้ด้วย
 *
 * เพิ่ม 2026-11-16: Mock A-Level ฟิสิกส์ (lib/exam-manifests/phys-1.json) · หนังสือตะลุยโจทย์ TPAT3
 * (assets/master-tpat3-drill.pdf 506 หน้า 4 ชุด × 70 ข้อ — ฉบับ 2026-11-19) · หนังสือตะลุยโจทย์ A-Level ฟิสิกส์
 * (assets/master-phys-drill.pdf 331 หน้า 4 ชุด × 30 ข้อ — ฉบับ 2026-11-18) · หน้าของ Bundle 3 แบบ
 * (ช่วงหน้าในสารบัญถอดจากหน้าสารบัญของเล่มจริง)
 */
import { PRODUCTS, bundleSaving, type ProductId } from "./catalog";

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
  bannerTone: "blue" | "rose" | "maroon" | "orange" | "green" | "magenta";
  /** วิชา — ใช้จัดกลุ่มบนหน้าแรก ("all" = bundle รวมทุกวิชา) */
  group: "tpat3" | "physics" | "all";
  /** ประเภท — mock (มีห้องสอบ) / book (หนังสือ PDF) / content (เล่มเนื้อหาแจกฟรี) / bundle */
  kind: "mock" | "book" | "content" | "bundle";
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
const PHYS_MOCK_COVER = { src: "/covers/mock-physics.png", alt: "ปกข้อสอบ Mock A-Level ฟิสิกส์" };
// กระดาษคำตอบวางคู่ปก แบบเดียวกับ MOCK_COVERS ของ TPAT3 (เจ้าของสั่ง 2026-11-16)
const PHYS_MOCK_COVERS = [
  { src: "/covers/answersheet-physics.png", alt: "กระดาษคำตอบ Mock A-Level ฟิสิกส์" },
  PHYS_MOCK_COVER,
];
const TPAT3_DRILL_COVER = { src: "/covers/drill-tpat3.png", alt: "ปกหนังสือตะลุยโจทย์ TPAT3" };
const PHYS_DRILL_COVER = { src: "/covers/drill-physics.png", alt: "ปกหนังสือตะลุยโจทย์ A-Level ฟิสิกส์" };

const PHYS_MOCK_SECTIONS: CourseChapterGroup[] = [
  { title: "ตอนที่ 1 แบบปรนัย 5 ตัวเลือก", meta: "ข้อ 1–25 / 75 คะแนน", items: [] },
  { title: "ตอนที่ 2 แบบระบายคำตอบที่เป็นตัวเลข", meta: "ข้อ 26–30 / 25 คะแนน", items: [] },
];

/** สารบัญหนังสือตะลุยโจทย์ — ช่วงหน้าตามหน้าสารบัญของเล่มจริง */
function drillContents(perSet: number, setPages: [number, number][], lastPage: number): CourseChapterGroup[] {
  return [
    ...setPages.map(([from, to], i) => ({
      title: `ชุดที่ ${i + 1}`,
      meta: `${perSet} ข้อ / หน้า ${from}–${to}`,
      items: [`ข้อสอบ ${perSet} ข้อ`, "ตารางเฉลยรวม + ระดับความยากรายข้อ", "เฉลยละเอียดทุกข้อ"],
    })),
    { title: "ท้ายเล่ม", meta: `หน้า ${lastPage}`, items: ["แนะนำการเตรียมตัวในวันสอบ"] },
  ];
}

/** ข้อความส่วนลดของ bundle เช่น "ประหยัด ฿99 (17%)" */
function savingText(id: ProductId): string {
  const s = bundleSaving(PRODUCTS[id]);
  return s ? `ประหยัด ฿${s.amount.toLocaleString()} (${s.percent}%)` : "";
}

/** สินค้าย่อยที่อยู่ใน bundle ได้ + สิ่งที่ได้ (ใช้บนหน้า bundle) */
type PartId = "mock1" | "drill-tpat3" | "mock-phys1" | "drill-phys";
const PART_ITEMS: Record<PartId, string[]> = {
  mock1: ["ห้องสอบออนไลน์ 70 ข้อ 3 ชม. (1 ครั้ง) + ผลวิเคราะห์", "เฉลยละเอียดทุกข้อ (PDF)"],
  "drill-tpat3": ["ข้อสอบเสมือนจริง 4 ชุด ชุดละ 70 ข้อ", "เฉลยละเอียดทุกข้อ (PDF 506 หน้า)"],
  "mock-phys1": ["ห้องสอบออนไลน์ 30 ข้อ 90 นาที (1 ครั้ง) + ผลวิเคราะห์", "เฉลยละเอียดทุกข้อ (PDF)"],
  "drill-phys": ["ข้อสอบเสมือนจริง 4 ชุด ชุดละ 30 ข้อ", "เฉลยละเอียดทุกข้อ (PDF 331 หน้า)"],
};

/** สารบัญของ bundle = สินค้าย่อยแต่ละตัว พร้อมราคาซื้อแยก */
function bundleContents(parts: PartId[]): CourseChapterGroup[] {
  return parts.map((id) => ({
    title: PRODUCTS[id].shortName ?? PRODUCTS[id].name,
    meta: `ซื้อแยก ฿${PRODUCTS[id].price.toLocaleString()}`,
    items: PART_ITEMS[id],
  }));
}

export const COURSES: CourseInfo[] = [
  {
    slug: "mock-tpat3",
    productId: "mock1",
    title: "ข้อสอบ Mock TPAT3 ชุดที่ 1",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "ซ้อมเหมือนสนามจริง รู้ผลทันที",
    covers: MOCK_COVERS,
    bannerTone: "blue",
    group: "tpat3",
    kind: "mock",
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
    group: "tpat3",
    kind: "content",
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

  // ===== เพิ่ม 2026-11-16 (เจ้าของสั่ง) =====
  {
    slug: "mock-alevel-physics",
    productId: "mock-phys1",
    title: "ข้อสอบ Mock A-Level ฟิสิกส์ ชุดที่ 1",
    subject: "A-Level ฟิสิกส์ (Physics)",
    tagline: "ซ้อมเหมือนสนามจริง รู้ผลทันที",
    covers: PHYS_MOCK_COVERS,
    bannerTone: "orange",
    group: "physics",
    kind: "mock",
    stats: [
      { icon: "questions", label: "จำนวนข้อ", value: "30 ข้อ" },
      { icon: "clock", label: "จับเวลาสอบ", value: "90 นาที" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "คอร์ส", value: "Mock A-Level ฟิสิกส์ ชุดที่ 1" },
      { label: "วิชา", value: "A-Level ฟิสิกส์ (Physics)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่อยากวัดความพร้อมก่อนสอบจริง" },
      { label: "รูปแบบ", value: "สอบออนไลน์ + ไฟล์ PDF" },
    ],
    includes: PART_ITEMS["mock-phys1"],
    highlights: [
      "จับเวลา 90 นาทีเหมือนสนามจริง",
      "ปรนัย 25 ข้อ + ตอบเป็นตัวเลข 5 ข้อ แบบข้อสอบจริง",
      "รู้ผลทันที: คะแนน อันดับ ค่าเฉลี่ย และกราฟการแจกแจง",
      "คะแนนรายตอน + วิเคราะห์รายข้อพร้อมคำแนะนำ",
      "บันทึกคำตอบอัตโนมัติ เน็ตหลุดหรือรีเฟรชก็ทำต่อได้",
      "เฉลยละเอียดทีละขั้น เข้าใจวิธีคิด",
      "อยู่ที่ “คอร์สของฉัน” ตลอด ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "โครงข้อสอบ",
    contents: PHYS_MOCK_SECTIONS,
  },
  {
    slug: "tpat3-drill",
    productId: "drill-tpat3",
    title: "หนังสือตะลุยโจทย์ TPAT3",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: "ข้อสอบเสมือนจริง 4 ชุด พร้อมเฉลยละเอียด",
    covers: [TPAT3_DRILL_COVER],
    bannerTone: "magenta",
    group: "tpat3",
    kind: "book",
    stats: [
      { icon: "questions", label: "โจทย์", value: "4 ชุด / 280 ข้อ" },
      { icon: "pages", label: "ความยาว", value: "506 หน้า" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "หนังสือ", value: "ตะลุยโจทย์ TPAT3 ข้อสอบเสมือนจริง ชุดที่ 1–4" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้เขียน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่อยากฝึกทำข้อสอบเต็มชุดหลายรอบก่อนสอบจริง" },
      { label: "รูปแบบ", value: "หนังสือ PDF 1 เล่ม" },
    ],
    includes: ["หนังสือตะลุยโจทย์ TPAT3 (PDF 506 หน้า)"],
    highlights: [
      "ข้อสอบเสมือนจริง 4 ชุด ชุดละ 70 ข้อ 5 ตอนแบบข้อสอบจริง",
      "โจทย์คนละชุดกับ Mock TPAT3 ทำทั้งคู่ได้ไม่ซ้ำ",
      "ทุกชุดมีตารางเฉลยรวม + ระดับความยากรายข้อ",
      "เฉลยละเอียดทุกข้อ พร้อมกล่อง Key สรุปหลักคิด",
      "สารบัญกดไปหน้านั้นได้ทันที",
      "อยู่ที่ “คอร์สของฉัน” ตลอด ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "เนื้อหาในเล่ม",
    contents: drillContents(70, [[3, 124], [125, 256], [257, 381], [382, 505]], 506),
  },
  {
    slug: "physics-drill",
    productId: "drill-phys",
    title: "หนังสือตะลุยโจทย์ A-Level ฟิสิกส์",
    subject: "A-Level ฟิสิกส์ (Physics)",
    tagline: "ข้อสอบเสมือนจริง 4 ชุด พร้อมเฉลยละเอียด",
    covers: [PHYS_DRILL_COVER],
    bannerTone: "green",
    group: "physics",
    kind: "book",
    stats: [
      { icon: "questions", label: "โจทย์", value: "4 ชุด / 120 ข้อ" },
      { icon: "pages", label: "ความยาว", value: "331 หน้า" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "หนังสือ", value: "ตะลุยโจทย์ A-Level ฟิสิกส์ ข้อสอบเสมือนจริง ชุดที่ 1–4" },
      { label: "วิชา", value: "A-Level ฟิสิกส์ (Physics)" },
      { label: "ผู้เขียน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่อยากฝึกทำข้อสอบเต็มชุดหลายรอบก่อนสอบจริง" },
      { label: "รูปแบบ", value: "หนังสือ PDF 1 เล่ม" },
    ],
    includes: ["หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ (PDF 331 หน้า)"],
    highlights: [
      "ข้อสอบเสมือนจริง 4 ชุด ชุดละ 30 ข้อ (ปรนัย 25 + ตอบเป็นตัวเลข 5)",
      "โจทย์คนละชุดกับ Mock A-Level ฟิสิกส์ ทำทั้งคู่ได้ไม่ซ้ำ",
      "ทุกชุดมีตารางเฉลยรวม + ระดับความยากรายข้อ",
      "เฉลยละเอียดทุกข้อ พร้อมกล่อง Key สรุปหลักคิด",
      "สารบัญกดไปหน้านั้นได้ทันที",
      "อยู่ที่ “คอร์สของฉัน” ตลอด ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "เนื้อหาในเล่ม",
    contents: drillContents(30, [[3, 84], [85, 163], [164, 245], [246, 330]], 331),
  },
  {
    slug: "tpat3-bundle",
    productId: "bundle-tpat3",
    title: "TPAT3 Bundle",
    subject: "TPAT3 ความถนัดทางวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์",
    tagline: `Mock TPAT3 + หนังสือตะลุยโจทย์ TPAT3 ${savingText("bundle-tpat3")}`,
    covers: [MOCK_COVERS[1], TPAT3_DRILL_COVER],
    bannerTone: "blue",
    group: "tpat3",
    kind: "bundle",
    stats: [
      { icon: "exam", label: "ห้องสอบ", value: "TPAT3 70 ข้อ" },
      { icon: "questions", label: "โจทย์ทั้งหมด", value: "5 ชุด / 350 ข้อ" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "แพ็กเกจ", value: "Mock TPAT3 ชุดที่ 1 + หนังสือตะลุยโจทย์ TPAT3" },
      { label: "วิชา", value: "TPAT3 (ความถนัดวิศวกรรมศาสตร์)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่จะสอบ TPAT3 และอยากซ้อมให้ครบ" },
      { label: "รูปแบบ", value: "สอบออนไลน์ + ไฟล์ PDF" },
    ],
    includes: [...PART_ITEMS.mock1, "หนังสือตะลุยโจทย์ TPAT3 4 ชุด (PDF)"],
    highlights: [
      `ถูกกว่าซื้อแยก ${savingText("bundle-tpat3")}`,
      "ข้อสอบ TPAT3 ไม่ซ้ำกัน 5 ชุด (Mock 1 + ตะลุยโจทย์ 4)",
      "สอบออนไลน์จับเวลาจริง รู้ผล อันดับ และจุดที่ต้องซ่อม",
      "เฉลยละเอียดทุกข้อทั้ง Mock และหนังสือ",
      "ทุกอย่างอยู่ที่ “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "ใน Bundle นี้มี",
    contents: bundleContents(["mock1", "drill-tpat3"]),
  },
  {
    slug: "physics-bundle",
    productId: "bundle-phys",
    title: "A-Level Physics Bundle",
    subject: "A-Level ฟิสิกส์ (Physics)",
    tagline: `Mock A-Level ฟิสิกส์ + หนังสือตะลุยโจทย์ ${savingText("bundle-phys")}`,
    covers: [PHYS_MOCK_COVER, PHYS_DRILL_COVER],
    bannerTone: "orange",
    group: "physics",
    kind: "bundle",
    stats: [
      { icon: "exam", label: "ห้องสอบ", value: "ฟิสิกส์ 30 ข้อ" },
      { icon: "questions", label: "โจทย์ทั้งหมด", value: "5 ชุด / 150 ข้อ" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      { label: "แพ็กเกจ", value: "Mock A-Level ฟิสิกส์ ชุดที่ 1 + หนังสือตะลุยโจทย์ A-Level ฟิสิกส์" },
      { label: "วิชา", value: "A-Level ฟิสิกส์ (Physics)" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่จะสอบ A-Level ฟิสิกส์ และอยากซ้อมให้ครบ" },
      { label: "รูปแบบ", value: "สอบออนไลน์ + ไฟล์ PDF" },
    ],
    includes: [...PART_ITEMS["mock-phys1"], "หนังสือตะลุยโจทย์ A-Level ฟิสิกส์ 4 ชุด (PDF)"],
    highlights: [
      `ถูกกว่าซื้อแยก ${savingText("bundle-phys")}`,
      "ข้อสอบ A-Level ฟิสิกส์ไม่ซ้ำกัน 5 ชุด (Mock 1 + ตะลุยโจทย์ 4)",
      "สอบออนไลน์จับเวลาจริง รู้ผล อันดับ และจุดที่ต้องซ่อม",
      "เฉลยละเอียดทุกข้อทั้ง Mock และหนังสือ",
      "ทุกอย่างอยู่ที่ “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "ใน Bundle นี้มี",
    contents: bundleContents(["mock-phys1", "drill-phys"]),
  },
  {
    slug: "engineer-pack",
    productId: "bundle-engineer",
    title: "แพ็คสอบติดวิศวะ",
    subject: "TPAT3 + A-Level ฟิสิกส์",
    tagline: `ครบทุกอย่างทั้ง TPAT3 และ A-Level ฟิสิกส์ ${savingText("bundle-engineer")}`,
    covers: [MOCK_COVERS[1], TPAT3_DRILL_COVER, PHYS_MOCK_COVER, PHYS_DRILL_COVER],
    bannerTone: "maroon",
    group: "all",
    kind: "bundle",
    stats: [
      { icon: "exam", label: "ห้องสอบ", value: "2 วิชา" },
      { icon: "questions", label: "โจทย์ทั้งหมด", value: "10 ชุด / 500 ข้อ" },
      { icon: "infinity", label: "อายุคอร์ส", value: "ไม่มีวันหมดอายุ" },
    ],
    facts: [
      {
        label: "แพ็กเกจ",
        value: "Mock TPAT3 + หนังสือตะลุยโจทย์ TPAT3 + Mock A-Level ฟิสิกส์ + หนังสือตะลุยโจทย์ A-Level ฟิสิกส์",
      },
      { label: "วิชา", value: "TPAT3 และ A-Level ฟิสิกส์" },
      { label: "ผู้สอน", value: "Mr.tpat3" },
      { label: "เหมาะสำหรับ", value: "น้องที่จะยื่นวิศวะ ต้องใช้ทั้ง TPAT3 และ A-Level ฟิสิกส์" },
      { label: "รูปแบบ", value: "สอบออนไลน์ + ไฟล์ PDF" },
    ],
    includes: [
      "ห้องสอบออนไลน์ TPAT3 70 ข้อ + A-Level ฟิสิกส์ 30 ข้อ",
      "เฉลยละเอียด Mock ทั้ง 2 วิชา (PDF)",
      "หนังสือตะลุยโจทย์ TPAT3 + A-Level ฟิสิกส์ (PDF)",
    ],
    highlights: [
      `ถูกกว่าซื้อแยก ${savingText("bundle-engineer")} คุ้มที่สุด`,
      "ได้ทั้ง TPAT3 และ A-Level ฟิสิกส์ ในคำสั่งซื้อเดียว",
      "ข้อสอบไม่ซ้ำกัน 10 ชุด: TPAT3 5 ชุด + A-Level ฟิสิกส์ 5 ชุด",
      "สอบออนไลน์จับเวลาจริงทั้ง 2 วิชา รู้ผลทันที",
      "เฉลยละเอียดทุกข้อ",
      "ทุกอย่างอยู่ที่ “คอร์สของฉัน” ไม่มีวันหมดอายุ",
    ],
    contentsTitle: "ในแพ็คนี้มี",
    contents: bundleContents(["mock1", "drill-tpat3", "mock-phys1", "drill-phys"]),
  },
];

export function getCourse(slug: string): CourseInfo | null {
  return COURSES.find((c) => c.slug === slug) ?? null;
}

export function courseForProduct(productId: string): CourseInfo | null {
  return COURSES.find((c) => c.productId === productId) ?? null;
}
