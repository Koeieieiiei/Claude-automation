/**
 * เปลี่ยนข้อความลายน้ำแบรนด์ในไฟล์ตัวอย่างฟรี (public/samples/*.pdf) โดยไม่แตะเนื้อหาอื่น
 *
 *   node scripts/rewatermark-samples.mjs [ไฟล์.pdf ...]     (ไม่ระบุ = ไฟล์ตัวอย่างทั้ง 3 ไฟล์)
 *
 * ไฟล์ตัวอย่างฝังลายน้ำ 2 บรรทัด ("Mr.tpat3" / "IG: ...") ไว้เป็น content stream สุดท้ายของแต่ละหน้า
 * (วาดด้วย pdf-lib — ข้อความเอียง 35° สีเทา 0.5 โปร่ง 0.25) สคริปต์นี้:
 *   1) หา stream ลายน้ำของแต่ละหน้า (มีเมทริกซ์หมุน 35° + ฟอนต์ Sarabun) แล้วอ่านตำแหน่ง/ขนาดของทั้ง 2 บรรทัด
 *   2) ถอด stream นั้นออก แล้ววาดใหม่ที่ตำแหน่ง/ขนาดเดิมด้วยข้อความใน BRAND_LINES ด้านล่าง
 * หน้าที่ไม่มีลายน้ำ (เช่น หน้าปก) ไม่ถูกแตะ · เขียนทับไฟล์เดิม (git เก็บของเก่าไว้แล้ว)
 *
 * ข้อความต้องตรงกับ BRAND_LINES ใน lib/watermark.ts และ scripts/watermark-exam-pages.py
 * (2026-11-16 เจ้าของสั่งเปลี่ยนบรรทัดล่างเป็น "IG: mr_tpat3")
 */
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import zlib from "zlib";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const BRAND_LINES = ["Mr.tpat3", "IG: mr_tpat3"];
const OPACITY = 0.25;
const ROOT = process.cwd();
const DEFAULT_FILES = [
  "public/samples/tpat3-mock-sample.pdf",
  "public/samples/tpat3-sample-questions.pdf",
  "public/samples/tpat3-sample-answers.pdf",
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
const fontBytes = await readFile(path.join(ROOT, "assets", "fonts", "Sarabun-Regular.ttf"));

/** อ่านไบต์ของ content stream (คลาย Flate ถ้าบีบอัด) */
function streamText(ctx, ref) {
  const obj = ctx.lookup(ref);
  if (!(obj instanceof PDFRawStream)) return null;
  let bytes = obj.contents;
  const filter = obj.dict.get(PDFName.of("Filter"));
  if (filter && filter.toString() === "/FlateDecode") bytes = zlib.inflateSync(Buffer.from(bytes));
  else if (filter) return null;
  return Buffer.from(bytes).toString("latin1");
}

// บรรทัดลายน้ำ: "<size> Tf ... 0.819... 0.573... -0.573... 0.819... <x> <y> Tm"
const LINE_RE = /([\d.]+) Tf[\s\S]*?0\.819152\d* 0\.573576\d* -0\.573576\d* 0\.819152\d* ([\d.]+) ([\d.]+) Tm/g;

for (const rel of files) {
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) {
    console.error(`❌ ไม่พบ ${rel}`);
    process.exit(1);
  }
  const doc = await PDFDocument.load(await readFile(file), { updateMetadata: false });
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const ctx = doc.context;
  let changed = 0;

  doc.getPages().forEach((page, i) => {
    const contents = page.node.get(PDFName.of("Contents"));
    const arr = ctx.lookup(contents);
    if (!(arr instanceof PDFArray) || arr.size() === 0) return;
    const lastRef = arr.get(arr.size() - 1);
    const text = streamText(ctx, lastRef);
    if (!text || !text.includes("Sarabun-Regular")) return; // หน้านี้ไม่มีลายน้ำ (เช่น ปก)
    const lines = [...text.matchAll(LINE_RE)].map((m) => ({ size: +m[1], x: +m[2], y: +m[3] }));
    if (lines.length !== BRAND_LINES.length) {
      throw new Error(`${rel} หน้า ${i + 1}: เจอลายน้ำ ${lines.length} บรรทัด (คาด ${BRAND_LINES.length}) — ไม่แตะไฟล์นี้`);
    }
    arr.remove(arr.size() - 1); // ถอดลายน้ำเดิม
    lines.forEach((l, j) => {
      page.drawText(BRAND_LINES[j], {
        x: l.x,
        y: l.y,
        size: l.size,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: OPACITY,
        rotate: degrees(35),
      });
    });
    changed++;
  });

  await writeFile(file, await doc.save({ useObjectStreams: false }));
  console.log(`✓ ${rel}: เปลี่ยนลายน้ำ ${changed}/${doc.getPageCount()} หน้า`);
}
