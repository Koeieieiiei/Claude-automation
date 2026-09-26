// อัปโหลดไฟล์ต้นฉบับจาก assets/ ขึ้น Supabase Storage
// รัน: node --env-file=.env.local scripts/upload-pdfs.mjs
//
// path ปลายทางต้องตรงกับ MASTER_SOURCES ใน lib/watermark.ts
// ⚠️ ไฟล์โจทย์ไม่อยู่ในลิสต์นี้ — ต้องแปะหน้าปกก่อน ใช้ scripts/prepend-cover.mjs (อัปให้เอง)
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ebooks";
const supabase = createClient(url, key, { auth: { persistSession: false } });

const files = [
  { local: "assets/master-answers.pdf", storage: "master/answers-2026-09-16.pdf" },
  { local: "assets/master-tpat3-content.pdf", storage: "master/tpat3-content.pdf" },
];

for (const f of files) {
  const bytes = await readFile(join(process.cwd(), f.local));
  const { error } = await supabase.storage
    .from(bucket)
    .upload(f.storage, bytes, { contentType: "application/pdf", upsert: true });
  if (error) {
    console.error(`❌ อัปโหลด ${f.storage} ไม่สำเร็จ:`, error.message);
    process.exit(1);
  }
  console.log(`✅ อัปโหลด ${f.storage} (${(bytes.length / 1024).toFixed(0)} KB) เรียบร้อย`);
}
console.log("เสร็จสิ้น — ไฟล์ต้นฉบับอยู่บน Supabase Storage แล้ว");
