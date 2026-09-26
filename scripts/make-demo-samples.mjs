// สร้างไฟล์ PDF "ตัวอย่างฟรี" สำหรับปุ่มโหลดตัวอย่างบนหน้าเว็บ:
//   public/samples/tpat3-sample-questions.pdf (กลางหน้าเขียน "โจทย์")
//   public/samples/tpat3-sample-answers.pdf   (กลางหน้าเขียน "เฉลย")
// รันด้วย: node scripts/make-demo-samples.mjs
// ตอนนี้เป็น placeholder — เมื่อพร้อมใส่โจทย์ตัวอย่างจริง แก้สคริปต์นี้หรือวางไฟล์ทับได้เลย
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// ⚠️ ล็อกกันอุบัติเหตุ: ตอนนี้ไฟล์ตัวอย่างจริงใน public/samples/ เป็น PDF ที่ฝังลายน้ำแบรนด์
// (Mr.tpat3 / Tiktok: Mrtpat3) และใช้งานบนเว็บจริงแล้ว — สคริปต์นี้จะ "เขียนทับ" ด้วยหน้าเปล่า
// placeholder ถ้าเผลอรัน ตัวอย่างจริงจะหายทันที จึงล็อกไว้ ต้องยืนยันเจตนาก่อนถึงจะรันได้
if (process.env.ALLOW_OVERWRITE_SAMPLES !== "1") {
  console.error(
    "❌ ปฏิเสธการรัน — สคริปต์นี้จะเขียนทับไฟล์ตัวอย่างแบรนด์จริงใน public/samples/ ด้วย placeholder เปล่า\n" +
      "   ถ้าตั้งใจจริง ให้รันด้วย: ALLOW_OVERWRITE_SAMPLES=1 node scripts/make-demo-samples.mjs"
  );
  process.exit(1);
}

const MAROON = rgb(0.431, 0.078, 0.137); // #6E1423
const INK = rgb(0.141, 0.063, 0.086); // #241016

const fontBytes = await readFile(join(process.cwd(), "assets", "fonts", "Sarabun-Regular.ttf"));

async function makeSample(word) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // กรอบโทนเลือดหมูบาง ๆ ให้ดูเป็นเอกสารของร้าน
  page.drawRectangle({
    x: 28, y: 28, width: width - 56, height: height - 56,
    color: rgb(1, 1, 1),
    borderColor: MAROON, borderWidth: 1.5, borderOpacity: 0.4,
  });

  const center = (text, size) => (width - font.widthOfTextAtSize(text, size)) / 2;

  const head = "ตัวอย่างไฟล์ · TPAT3 ฉบับซ้อมสอบ";
  page.drawText(head, { x: center(head, 16), y: height - 92, size: 16, font, color: MAROON });

  page.drawText(word, { x: center(word, 96), y: height / 2 - 34, size: 96, font, color: INK });

  const foot = "ไฟล์ตัวอย่างชั่วคราว — เนื้อหาตัวอย่างจริงกำลังจะตามมา";
  page.drawText(foot, { x: center(foot, 13), y: 78, size: 13, font, color: INK, opacity: 0.5 });

  return doc.save();
}

const dir = join(process.cwd(), "public", "samples");
await mkdir(dir, { recursive: true });

const q = await makeSample("โจทย์");
await writeFile(join(dir, "tpat3-sample-questions.pdf"), q);

const a = await makeSample("เฉลย");
await writeFile(join(dir, "tpat3-sample-answers.pdf"), a);

console.log("สร้างไฟล์ตัวอย่างสำหรับหน้าเว็บเรียบร้อย:");
console.log("  public/samples/tpat3-sample-questions.pdf (" + q.length + " bytes)");
console.log("  public/samples/tpat3-sample-answers.pdf   (" + a.length + " bytes)");
