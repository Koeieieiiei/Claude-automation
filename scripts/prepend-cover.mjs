// เพิ่ม "หน้าปก Mock TPAT3" เป็นหน้าแรกของไฟล์โจทย์ แล้วอัปโหลดขึ้น Supabase Storage
//
// รัน: node --env-file=.env.local scripts/prepend-cover.mjs
//
// - ใช้รูปปกจาก public/covers/mock.png (หรือ .jpg/.jpeg)
// - เก็บสำเนาต้นฉบับ "ไม่มีปก" ไว้ที่ assets/master-questions.nocover.pdf ครั้งเดียว
//   เพื่อให้รันซ้ำได้โดยไม่ซ้อนปกหลายชั้น (สร้างปกจากต้นฉบับไม่มีปกเสมอ)
// - เขียนทับ assets/master-questions.pdf แล้วอัปโหลดขึ้น master/questions.pdf (upsert)
import { PDFDocument } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, copyFile, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const MASTER = join(ROOT, "assets", "master-questions.pdf");
const PRISTINE = join(ROOT, "assets", "master-questions.nocover.pdf");

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCover() {
  for (const ext of ["png", "jpg", "jpeg"]) {
    const p = join(ROOT, "public", "covers", `mock.${ext}`);
    if (await exists(p)) return p;
  }
  throw new Error(
    "ไม่พบไฟล์ปก Mock — กรุณาบันทึกรูปปกไว้ที่ public/covers/mock.png (หรือ mock.jpg) ก่อน"
  );
}

// 1) สำรองต้นฉบับ "ไม่มีปก" ไว้ครั้งเดียว
if (!(await exists(PRISTINE))) {
  await copyFile(MASTER, PRISTINE);
  console.log("สำรองต้นฉบับไม่มีปก → assets/master-questions.nocover.pdf");
}

// 2) สร้างปกจากต้นฉบับ "ไม่มีปก" เสมอ (idempotent — รันซ้ำได้)
const coverPath = await resolveCover();
const baseBytes = await readFile(PRISTINE);
const coverBytes = await readFile(coverPath);

const pdf = await PDFDocument.load(baseBytes);
const isPng = coverBytes[0] === 0x89 && coverBytes[1] === 0x50; // ‰PNG
const img = isPng ? await pdf.embedPng(coverBytes) : await pdf.embedJpg(coverBytes);

// หน้าปกใหม่ = ขนาดเท่าหน้าแรกเดิม, วางรูปแบบ "cover" (เต็มหน้า ไม่มีขอบขาว)
const first = pdf.getPage(0);
const { width, height } = first.getSize();
const page = pdf.insertPage(0, [width, height]);
const scale = Math.max(width / img.width, height / img.height);
const w = img.width * scale;
const h = img.height * scale;
page.drawImage(img, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });

const outBytes = await pdf.save();
await writeFile(MASTER, outBytes);
console.log(
  `ใส่หน้าปกแล้ว → assets/master-questions.pdf (${(outBytes.length / 1024).toFixed(0)} KB, ${pdf.getPageCount()} หน้า)`
);

// 3) อัปโหลดขึ้น Supabase Storage
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ebooks";
if (!url || !key) {
  console.error(
    "ไม่พบค่า Supabase ใน env (รันด้วย --env-file=.env.local) — ไฟล์ในเครื่องอัปเดตแล้วแต่ยังไม่ได้อัปโหลด"
  );
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const { error } = await supabase.storage
  .from(bucket)
  .upload("master/questions.pdf", outBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
if (error) {
  console.error("อัปโหลดขึ้น Supabase ไม่สำเร็จ:", error.message);
  process.exit(1);
}
console.log(`อัปโหลดขึ้น Supabase เรียบร้อย → ${bucket}/master/questions.pdf`);
