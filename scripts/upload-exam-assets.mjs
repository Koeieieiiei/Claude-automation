/**
 * อัปโหลดข้อมูลระบบทำข้อสอบขึ้น Supabase Storage
 *
 *   node --env-file=.env.local scripts/upload-exam-assets.mjs
 *
 * อัปโหลด (ไปที่บักเก็ตเดียวกับไฟล์ ebook — ค่าเริ่มต้น "ebooks"):
 *   data/exam/answer-key.json   → exam/answer-key.json
 *   data/exam/population.json   → exam/population.json
 *   assets/exam-pages/*.png     → exam/pages/*.png
 *
 * ไฟล์ต้นทางสร้างด้วย `python scripts/build-exam-assets.py` (ต้องรันก่อน)
 * เรียกซ้ำได้ปลอดภัย — ทับไฟล์เดิม (upsert) และไม่แตะไฟล์ผลสอบของผู้ใช้
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const BUCKET = process.env.SUPABASE_BUCKET || "ebooks";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function put(storagePath, bytes, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
}

async function main() {
  const dataDir = path.join(ROOT, "data", "exam");
  const pagesDir = path.join(ROOT, "assets", "exam-pages");

  for (const f of ["answer-key.json", "population.json"]) {
    const local = path.join(dataDir, f);
    if (!existsSync(local)) {
      console.error(`❌ ไม่พบ ${local} — รัน "python scripts/build-exam-assets.py" ก่อน`);
      process.exit(1);
    }
    await put(`exam/${f}`, await readFile(local), "application/json");
    console.log(`✓ exam/${f}`);
  }

  if (!existsSync(pagesDir)) {
    console.error(`❌ ไม่พบ ${pagesDir} — รัน "python scripts/build-exam-assets.py" ก่อน`);
    process.exit(1);
  }
  const pages = (await readdir(pagesDir)).filter((f) => f.endsWith(".png")).sort();
  let done = 0;
  for (const f of pages) {
    await put(`exam/pages/${f}`, await readFile(path.join(pagesDir, f)), "image/png");
    done++;
    if (done % 10 === 0 || done === pages.length) {
      console.log(`✓ รูปหน้าโจทย์ ${done}/${pages.length}`);
    }
  }

  console.log(`\nเสร็จแล้ว — อัปขึ้นบักเก็ต "${BUCKET}" ทั้งหมด ${pages.length + 2} ไฟล์`);
}

main().catch((err) => {
  console.error("❌ อัปโหลดไม่สำเร็จ:", err.message);
  process.exit(1);
});
