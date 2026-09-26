// อัปโหลดไฟล์ต้นฉบับจาก assets/ ขึ้น Supabase Storage
// รัน: node --env-file=.env.local scripts/upload-pdfs.mjs [ชื่อไฟล์ใน FILES ...]
//   ไม่ใส่อาร์กิวเมนต์ = อัปทุกไฟล์ในลิสต์ · ใส่ชื่อ เช่น `tpat3content` = อัปเฉพาะตัวนั้น
//
// path ปลายทางต้องตรงกับ MASTER_SOURCES ใน lib/watermark.ts
// ⚠️ เปลี่ยนไฟล์ตัวจริงเมื่อไหร่ ให้อัปขึ้น "path ใหม่ที่มีวันที่" แล้วแก้ MASTER_SOURCES ตาม
//    (CDN ของ Supabase คืนไฟล์เก่าที่แคชไว้ได้สักพักถ้าอัปทับ path เดิม + เก็บฉบับเก่าไว้เป็นสำรอง)
// ⚠️ ไฟล์โจทย์ไม่อยู่ในลิสต์นี้ — ต้องแปะหน้าปกก่อน ใช้ scripts/prepend-cover.mjs (อัปให้เอง)
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ebooks";
const supabase = createClient(url, key, { auth: { persistSession: false } });

const FILES = {
  answers: { local: "assets/master-answers.pdf", storage: "master/answers-2026-09-16.pdf" },
  // เล่ม "เนื้อหา TPAT3" ฉบับ 174 หน้า (2026-09-26) — ฉบับก่อน 160 หน้าอยู่ที่ master/tpat3-content.pdf
  tpat3content: { local: "assets/master-tpat3-content.pdf", storage: "master/tpat3-content-2026-09-26.pdf" },
};

const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !(w in FILES));
if (unknown.length) {
  console.error(`❌ ไม่รู้จัก: ${unknown.join(", ")} — เลือกได้จาก: ${Object.keys(FILES).join(", ")}`);
  process.exit(1);
}
const targets = wanted.length ? wanted : Object.keys(FILES);

for (const name of targets) {
  const f = FILES[name];
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
// เช็คด้วย list() (metadata อัปเดตทันที) — อย่าเช็คด้วย download() เพราะ CDN อาจคืนไฟล์เก่า
const { data } = await supabase.storage.from(bucket).list("master", { limit: 100 });
for (const name of targets) {
  const base = FILES[name].storage.replace(/^master\//, "");
  const row = data?.find((r) => r.name === base);
  console.log(`   บน Storage: ${base} = ${row ? `${row.metadata?.size} bytes` : "ไม่พบ!"}`);
}
console.log("เสร็จสิ้น — ไฟล์ต้นฉบับอยู่บน Supabase Storage แล้ว");
