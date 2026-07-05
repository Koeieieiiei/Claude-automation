// สร้างไฟล์ตัวอย่างที่ใส่ลายน้ำ เพื่อดูหน้าตา (ใช้ไฟล์จริงใน assets/)
// รัน: node scripts/preview-watermark.mjs
// ผลลัพธ์: watermark-preview.pdf
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const ASSETS = join(process.cwd(), "assets");
const THAI_FONT = join(ASSETS, "fonts", "Sarabun-Regular.ttf");
const SRC = join(ASSETS, "master-questions.pdf");

// ตัวอย่างผู้ซื้อ
const buyer = { firstName: "สมหญิง", lastName: "รักเรียน", email: "somying@gmail.com" };

const pdfDoc = await PDFDocument.load(await readFile(SRC));
pdfDoc.registerFontkit(fontkit);
const font = existsSync(THAI_FONT)
  ? await pdfDoc.embedFont(await readFile(THAI_FONT), { subset: true })
  : await pdfDoc.embedFont(StandardFonts.Helvetica);

const fullName = `${buyer.firstName} ${buyer.lastName}`.trim();
const diagonalText = `${fullName} • ${buyer.email}`;
const footerText = `เอกสารลิขสิทธิ์เฉพาะ ${fullName} (${buyer.email}) • ห้ามเผยแพร่ต่อ`;

for (const page of pdfDoc.getPages()) {
  const { width, height } = page.getSize();
  const diagSize = Math.max(18, Math.min(34, width / 18));
  page.drawText(diagonalText, {
    x: width * 0.08, y: height * 0.45, size: diagSize, font,
    color: rgb(0.5, 0.5, 0.5), opacity: 0.28, rotate: degrees(35),
  });
  page.drawText(footerText, {
    x: 24, y: 16, size: 9, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.6,
  });
}

await writeFile("watermark-preview.pdf", await pdfDoc.save());
console.log("✅ สร้าง watermark-preview.pdf เรียบร้อย (ลายน้ำ: " + diagonalText + ")");
