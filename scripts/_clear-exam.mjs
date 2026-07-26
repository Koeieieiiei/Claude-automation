// ชั่วคราว: ล้างข้อมูลผลสอบทดสอบของสนาม tpat3-1 (ลบทิ้งหลังใช้)
// ลบ: attempts ทุกไฟล์ + aggregate.json — ไม่แตะ answer-key/population/pages/orders
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const bucket = process.env.SUPABASE_BUCKET;

// ดูก่อนว่ามีอะไร
const { data: files } = await sb.storage.from(bucket).list("exam/tpat3-1/attempts");
console.log("ไฟล์ผลสอบรายคน:", files?.length ?? 0, "ไฟล์");

const targets = (files ?? []).map((f) => `exam/tpat3-1/attempts/${f.name}`);
targets.push("exam/tpat3-1/aggregate.json");

const { data: removed, error } = await sb.storage.from(bucket).remove(targets);
if (error) {
  console.error("ลบไม่สำเร็จ:", error.message);
  process.exit(1);
}
console.log("ลบแล้ว:", removed.map((r) => r.name).join(", "));

// ตรวจซ้ำ
const { data: after } = await sb.storage.from(bucket).list("exam/tpat3-1/attempts");
const { data: agg } = await sb.storage.from(bucket).download("exam/tpat3-1/aggregate.json");
console.log("เหลือ attempts:", after?.length ?? 0, "· aggregate ยังอยู่:", Boolean(agg));

// เช็คว่าไฟล์ระบบยังครบ (ห้ามหาย)
for (const key of ["exam/tpat3-1/answer-key.json", "exam/tpat3-1/population.json"]) {
  const { data } = await sb.storage.from(bucket).download(key);
  console.log(key, data ? "✅ ยังอยู่" : "❌ หาย!");
}
