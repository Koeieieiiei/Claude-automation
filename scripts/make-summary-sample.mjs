// สร้างไฟล์ "ตัวอย่างเนื้อหาฟรี" public/samples/tpat3-summary1-sample.pdf
// = ตัดหน้าจากไฟล์เนื้อหาตัวจริง (assets/master-tpat3-content.pdf) มาใส่ลายน้ำแบรนด์
// (ชื่อไฟล์ปลายทางยังเป็น summary1 ตามเดิม — ลิงก์บนหน้าเว็บ/สถิติโหลดเดโมอ้างชื่อนี้อยู่)
//
// รัน: node scripts/make-summary-sample.mjs
//
// ⚠️ ต้องรันใหม่ทุกครั้งที่เปลี่ยนไฟล์เนื้อหาตัวจริง ไม่งั้นตัวอย่างฟรีจะเป็นเนื้อหาฉบับเก่า
// (เคยพลาดมาแล้ว 2026-07-28: อัปไฟล์ใหม่ 47 หน้า แต่ตัวอย่างยังตัดมาจากฉบับ 39 หน้า)
//
// เล่ม "เนื้อหา TPAT3" (160 หน้า, 2026-09-16) เลขมุมที่พิมพ์บนหน้า = เลขหน้าแบบนับ 1 → index = เลขมุม − 1
// หน้าที่เลือก (2026-09-16 เจ้าของสั่ง: ปก + สารบัญ + หน้าที่ "ถ่ายทอดรู้เรื่องที่สุด ต่างจากเจ้าอื่น" 6–7 หน้า)
//   เลขมุม 6   Part 1 อนุกรมตัวเลข — บันไดห้าขั้น ไล่ทีละขั้นแทนการท่องทุกแบบ
//   เลขมุม 12  Part 1 ความสัมพันธ์ (กล่อง) — โชว์วิธีคิด ลองบวก ✗ ลองคูณ ✗ จนเจอกฎ
//   เลขมุม 33  Part 2 การประกอบชิ้นงาน — ทุกช้อยส์ผิดบอกเหตุผล ✗ ไม่สลับซ้าย–ขวา
//   เลขมุม 42  Part 2 ซ้อนแผ่นกั้นแสง — "และ" ไม่ใช่ "หรือ" + ทางลัดตัดช้อยส์
//   เลขมุม 56  Part 3 วาด FBD 4 ขั้น — ขั้นตอนชัด + กับดัก N ไม่ได้เท่ากับ mg เสมอ
//   เลขมุม 72  Part 3 คาน 3 อันดับ — จำแค่ตัวที่อยู่ตรงกลาง "1 จุดหมุน / 2 น้ำหนัก / 3 แรง"
//   เลขมุม 145 Part 5 ป้าย ISO 7010 — อ่านจากรูปทรงกับสี ไม่ต้องท่องทีละป้าย
import { PDFDocument, PDFName, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const SOURCE = join(process.cwd(), "assets", "master-tpat3-content.pdf");
const OUT = join(process.cwd(), "public", "samples", "tpat3-summary1-sample.pdf");
const FONT = join(process.cwd(), "assets", "fonts", "Sarabun-Regular.ttf");

const PAGES = [0, 1, 5, 11, 32, 41, 55, 71, 144]; // ปก + สารบัญ + เลขมุม 6, 12, 33, 42, 56, 72, 145
const COVER_INDEX = 0; // หน้าปก — ไม่ใส่ลายน้ำ (เจ้าของขอปกสะอาด)

// ลายน้ำแบรนด์ — ค่าเดียวกับไฟล์ตัวอย่างเดิม (วัดจาก PDF เก่า)
const ANGLE = 35;
const OPACITY = 0.25;
const GRAY = rgb(0.5, 0.5, 0.5);
const LINES = [
  { text: "Mr.tpat3", size: 34, dy: 403.92 },
  { text: "Tiktok: Mrtpat3", size: 28, dy: 347.92 },
];
const X_RIGHT = 339; // หน้าคู่ของชุด — เยื้องขวา
const X_LEFT = 124; //  หน้าคี่ของชุด — เยื้องซ้าย

const src = await PDFDocument.load(await readFile(SOURCE));
if (Math.max(...PAGES) >= src.getPageCount()) {
  throw new Error(`ไฟล์ต้นฉบับมี ${src.getPageCount()} หน้า แต่ขอหน้า index ${Math.max(...PAGES)}`);
}

const out = await PDFDocument.create();
out.registerFontkit(fontkit);
const font = await out.embedFont(await readFile(FONT), { subset: true });

const copied = await out.copyPages(src, PAGES);
copied.forEach((page, i) => {
  // เอาลิงก์ในหน้าออก (สารบัญ/ปุ่มกลับสารบัญ) — ในไฟล์ตัวอย่างหน้าปลายทางส่วนใหญ่ไม่มีอยู่ กดแล้วไม่ไปไหน
  page.node.delete(PDFName.of("Annots"));
  out.addPage(page);
  if (i === COVER_INDEX) return; // ปกสะอาด ไม่มีลายน้ำ

  const baseX = i % 2 === 1 ? X_RIGHT : X_LEFT; // สลับซ้าย-ขวาทีละหน้า
  for (const [j, line] of LINES.entries()) {
    page.drawText(line.text, {
      x: baseX + j * 3, // บรรทัดล่างเยื้องขวาอีก 3pt ตามต้นฉบับ
      y: line.dy,
      size: line.size,
      font,
      color: GRAY,
      opacity: OPACITY,
      rotate: degrees(ANGLE),
    });
  }
});

const bytes = await out.save();
await writeFile(OUT, bytes);

console.log(`สร้างตัวอย่างเนื้อหาฟรีเรียบร้อย → public/samples/tpat3-summary1-sample.pdf`);
console.log(`  ต้นฉบับ ${src.getPageCount()} หน้า → ตัดมา ${PAGES.length} หน้า (index ${PAGES.join(", ")})`);
console.log(`  ขนาด ${(bytes.length / 1024).toFixed(0)} KB · ลายน้ำ ${PAGES.length - 1} หน้า (เว้นปก)`);
