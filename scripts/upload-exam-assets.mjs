/**
 * อัปโหลดข้อมูลระบบทำข้อสอบขึ้น Supabase Storage (แยกโฟลเดอร์ตามสนามสอบ)
 *
 *   node --env-file=.env.local scripts/upload-exam-assets.mjs [examId]   (ไม่ระบุ = tpat3-1)
 *   node --env-file=.env.local scripts/upload-exam-assets.mjs [examId] --population-only
 *       อัปเฉพาะประชากรอ้างอิง (หลังรัน build-exam-assets.py --population-only)
 *
 * อัปโหลด (ไปที่บักเก็ตเดียวกับไฟล์ ebook — ค่าเริ่มต้น "ebooks"):
 *   data/exam/<examId>/answer-key.json   → exam/<examId>/answer-key.json
 *   data/exam/<examId>/population.json   → exam/<examId>/population-2026-09-27.json
 *       (ชื่อปลายทางต้องตรงกับ sPop ใน lib/exam-store.ts — เปลี่ยนประชากรครั้งหน้าให้ตั้งชื่อใหม่ทั้งสองที่
 *        อย่าอัปทับ เพราะ CDN จ่ายไฟล์เก่าที่แคชไว้ได้อีกพัก)
 *   assets/exam-pages/<examId>/*.png     → exam/<examId>/pages/*.png
 *       (ต้นฉบับสะอาด — อัปแล้วต้องรัน `python scripts/watermark-exam-pages.py <examId>` ต่อ
 *        เพื่อสร้างชุดมีลายน้ำที่ pages-wm/ ซึ่งเป็นชุดที่ห้องสอบเสิร์ฟจริง)
 *
 * ไฟล์ต้นทางสร้างด้วย `python scripts/build-exam-assets.py <examId>` (ต้องรันก่อน)
 * เรียกซ้ำได้ปลอดภัย — ทับไฟล์เดิม (upsert) และไม่แตะไฟล์ผลสอบของผู้ใช้
 * อัปเสร็จต้อง deploy ใหม่ (vercel --prod) เพราะ server จำเฉลย/ประชากร/รูปไว้ต่อ instance
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const POPULATION_ONLY = process.argv.includes("--population-only");
const POPULATION_TARGET = "population-2026-09-27.json";
const EXAM_ID = process.argv.slice(2).find((a) => !a.startsWith("--")) || "tpat3-1";
if (!/^[a-z0-9-]+$/.test(EXAM_ID)) {
  console.error(`❌ examId ไม่ถูกต้อง: ${EXAM_ID}`);
  process.exit(1);
}
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
  const dataDir = path.join(ROOT, "data", "exam", EXAM_ID);
  const pagesDir = path.join(ROOT, "assets", "exam-pages", EXAM_ID);

  const jsonFiles = [
    ...(POPULATION_ONLY ? [] : [{ local: "answer-key.json", target: "answer-key.json" }]),
    { local: "population.json", target: POPULATION_TARGET },
  ];
  for (const f of jsonFiles) {
    const local = path.join(dataDir, f.local);
    if (!existsSync(local)) {
      console.error(`❌ ไม่พบ ${local} — รัน "python scripts/build-exam-assets.py ${EXAM_ID}" ก่อน`);
      process.exit(1);
    }
    await put(`exam/${EXAM_ID}/${f.target}`, await readFile(local), "application/json");
    console.log(`✓ exam/${EXAM_ID}/${f.target}`);
  }
  if (POPULATION_ONLY) {
    console.log("\nเสร็จแล้ว — อัปเฉพาะประชากรอ้างอิง (ต้อง deploy ใหม่ให้ server อ่านชุดนี้)");
    return;
  }

  if (!existsSync(pagesDir)) {
    console.error(`❌ ไม่พบ ${pagesDir} — รัน "python scripts/build-exam-assets.py ${EXAM_ID}" ก่อน`);
    process.exit(1);
  }
  const pages = (await readdir(pagesDir)).filter((f) => f.endsWith(".png")).sort();
  let done = 0;
  for (const f of pages) {
    await put(`exam/${EXAM_ID}/pages/${f}`, await readFile(path.join(pagesDir, f)), "image/png");
    done++;
    if (done % 10 === 0 || done === pages.length) {
      console.log(`✓ รูปหน้าโจทย์ ${done}/${pages.length}`);
    }
  }

  console.log(
    `\nเสร็จแล้ว — สนาม ${EXAM_ID} อัปขึ้นบักเก็ต "${BUCKET}" ทั้งหมด ${pages.length + 2} ไฟล์`
  );
}

main().catch((err) => {
  console.error("❌ อัปโหลดไม่สำเร็จ:", err.message);
  process.exit(1);
});
