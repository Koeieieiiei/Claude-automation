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
const footerText = `เอกสารลิขสิทธิ์เฉพาะ ${fullName} (${buyer.email}) • ห้ามเผยแพร่ต่อ`;

// ต้องตรงกับ lib/watermark.ts (สคริปต์นี้เป็นตัวพรีวิวหน้าตาเท่านั้น)
const DIAG_ANGLE = 35;
const DIAG_RAD = (DIAG_ANGLE * Math.PI) / 180;
const ALONG = { x: Math.cos(DIAG_RAD), y: Math.sin(DIAG_RAD) };
const BELOW = { x: Math.sin(DIAG_RAD), y: -Math.cos(DIAG_RAD) };

function fitSize(text, preferred, min, maxWidth) {
  let size = preferred;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

pdfDoc.getPages().forEach((page, index) => {
  if (index === 0) return; // หน้าปก — production เว้นลายน้ำ (ดู lib/watermark.ts)

  const { width, height } = page.getSize();

  const maxSpan = width * 0.62;
  const nameSize = fitSize(fullName, Math.max(18, Math.min(34, width / 18)), 10, maxSpan);
  const emailSize = fitSize(buyer.email, nameSize * 0.8, 8, maxSpan);
  const lines = [
    ...(fullName ? [{ text: fullName, size: nameSize }] : []),
    { text: buyer.email, size: emailSize },
  ];
  const gap = nameSize * 1.5;

  const anchorX = width * (index % 2 === 0 ? 0.36 : 0.64);
  const anchorY = height * 0.46;

  lines.forEach((line, i) => {
    const half = font.widthOfTextAtSize(line.text, line.size) / 2;
    const drop = (i - (lines.length - 1) / 2) * gap;
    page.drawText(line.text, {
      x: anchorX - ALONG.x * half + BELOW.x * drop,
      y: anchorY - ALONG.y * half + BELOW.y * drop,
      size: line.size, font,
      color: rgb(0.5, 0.5, 0.5), opacity: 0.28, rotate: degrees(DIAG_ANGLE),
    });
  });

  page.drawText(footerText, {
    x: 24, y: 16, size: 9, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.6,
  });
});

await writeFile("watermark-preview.pdf", await pdfDoc.save());
console.log(`✅ สร้าง watermark-preview.pdf เรียบร้อย (ลายน้ำ: ${fullName} / ${buyer.email})`);
