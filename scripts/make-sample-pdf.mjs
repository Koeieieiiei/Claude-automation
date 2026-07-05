// สร้างไฟล์ PDF ตัวอย่าง 2 ไฟล์ไว้ทดสอบ flow:
//   assets/master-questions.pdf (โจทย์)  และ  assets/master-answers.pdf (เฉลย)
// รันด้วย: node scripts/make-sample-pdf.mjs
// เมื่อมีไฟล์จริงแล้ว ให้นำมาวางทับไฟล์เหล่านี้ได้เลย
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

async function makeSample(title, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([595, 842]); // A4
    page.drawText(title, { x: 60, y: 760, size: 26, font, color: rgb(0.2, 0.2, 0.5) });
    page.drawText(`Sample page ${i} of ${pages}`, { x: 60, y: 710, size: 14, font });
    page.drawText("Replace this file with your real PDF.", { x: 60, y: 680, size: 12, font });
  }
  return doc.save();
}

const dir = join(process.cwd(), "assets");
await mkdir(dir, { recursive: true });

const q = await makeSample("Mock TPAT3 - QUESTIONS (SAMPLE)", 3);
await writeFile(join(dir, "master-questions.pdf"), q);

const a = await makeSample("Mock TPAT3 - ANSWERS (SAMPLE)", 3);
await writeFile(join(dir, "master-answers.pdf"), a);

console.log("สร้างไฟล์ตัวอย่างเรียบร้อย:");
console.log("  assets/master-questions.pdf (" + q.length + " bytes)");
console.log("  assets/master-answers.pdf  (" + a.length + " bytes)");
