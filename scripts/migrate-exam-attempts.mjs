/**
 * ย้าย "ผลสอบ" ที่เก็บเป็นไฟล์บน Supabase Storage เข้าตาราง exam_attempts
 *
 *   node --env-file=.env.local scripts/migrate-exam-attempts.mjs [examId]   (ไม่ระบุ = tpat3-1)
 *
 * ต้องรัน supabase/migration-exam-attempts.sql ใน Supabase ก่อน (สร้างตาราง)
 * รันซ้ำได้ปลอดภัย — ทับแถวเดิมด้วยข้อมูลชุดเดียวกัน และไม่ลบไฟล์ต้นทางทิ้ง
 */
import { createClient } from "@supabase/supabase-js";

const EXAM_ID = process.argv[2] || "tpat3-1";
const BUCKET = process.env.SUPABASE_BUCKET || "ebooks";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// ตารางถูกสร้างแล้วหรือยัง
const probe = await sb.from("exam_attempts").select("exam_id").limit(1);
if (probe.error) {
  console.error(
    `❌ ยังไม่มีตาราง exam_attempts (${probe.error.message})\n` +
      "   เปิด Supabase → SQL Editor → วางไฟล์ supabase/migration-exam-attempts.sql → Run ก่อน"
  );
  process.exit(1);
}

const prefix = `exam/${EXAM_ID}/attempts`;
const { data: files, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
if (error) {
  console.error("❌ อ่านรายการไฟล์ผลสอบไม่สำเร็จ:", error.message);
  process.exit(1);
}

const jsonFiles = (files ?? []).filter((f) => f.name.endsWith(".json"));
console.log(`พบไฟล์ผลสอบบน Storage ${jsonFiles.length} ไฟล์ (สนาม ${EXAM_ID})`);

let moved = 0;
let skipped = 0;
for (const f of jsonFiles) {
  const { data } = await sb.storage.from(BUCKET).download(`${prefix}/${f.name}`);
  if (!data) {
    skipped++;
    continue;
  }
  let a;
  try {
    a = JSON.parse(await data.text());
  } catch {
    skipped++;
    continue;
  }
  if (a?.deleted || !a?.email || !a?.startedAt) {
    skipped++; // ไฟล์ที่ถูกลบไปแล้ว (tombstone) หรือข้อมูลไม่ครบ
    continue;
  }

  const { error: upErr } = await sb.from("exam_attempts").upsert(
    {
      exam_id: a.examId || EXAM_ID,
      email: String(a.email).trim().toLowerCase(),
      first_name: a.firstName ?? "",
      last_name: a.lastName ?? "",
      order_id: a.orderId ?? "",
      started_at: a.startedAt,
      submitted_at: a.submittedAt ?? null,
      answers: a.answers ?? [],
      correct_count: a.correctCount ?? null,
      score: a.score ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "exam_id,email" }
  );
  if (upErr) {
    console.error(`  ⚠️ ${a.email}: ${upErr.message}`);
    skipped++;
    continue;
  }
  moved++;
  console.log(
    `  ✓ ${a.email} · ${a.submittedAt ? `ส่งแล้ว ${a.score} คะแนน` : "ยังทำอยู่"}`
  );
}

const { count } = await sb
  .from("exam_attempts")
  .select("*", { count: "exact", head: true })
  .eq("exam_id", EXAM_ID);

console.log(`\nย้ายเข้าฐานข้อมูล ${moved} รายการ · ข้าม ${skipped} · ตอนนี้ในตารางมี ${count} รายการ`);
console.log("ไฟล์บน Storage ยังอยู่ครบ (ไม่ได้ลบ) — เก็บไว้เป็นสำเนาสำรอง");
