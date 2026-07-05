// ตั้งค่า Supabase อัตโนมัติ: สร้าง storage bucket + เช็คตาราง orders
// รัน: node --env-file=.env.local scripts/setup-supabase.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "ebooks";

if (!url || !key) {
  console.error("❌ ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 1) สร้าง storage bucket (private)
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("❌ เชื่อมต่อ Supabase ไม่สำเร็จ:", listErr.message);
  process.exit(1);
}
console.log("✅ เชื่อมต่อ Supabase สำเร็จ");

if (buckets.find((b) => b.name === bucket)) {
  console.log(`ℹ️  มี bucket "${bucket}" อยู่แล้ว`);
} else {
  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  if (error) console.error(`❌ สร้าง bucket "${bucket}" ไม่สำเร็จ:`, error.message);
  else console.log(`✅ สร้าง bucket "${bucket}" (private) เรียบร้อย`);
}

// 2) เช็คตาราง orders ว่ามีหรือยัง
const { error: tblErr } = await supabase.from("orders").select("id").limit(1);
if (tblErr) {
  console.log("");
  console.log('⚠️  ยังไม่มีตาราง "orders" — ต้องสร้างก่อน (ทำครั้งเดียว):');
  console.log("   1) เปิด Supabase > SQL Editor > New query");
  console.log("   2) วางเนื้อหาไฟล์ supabase/schema.sql แล้วกด Run");
} else {
  console.log('✅ ตาราง "orders" พร้อมใช้งาน');
}
