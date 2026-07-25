-- โครงตารางระบบทำข้อสอบออนไลน์ — "ยังไม่ได้ใช้" ในแบบจำลอง (ตอนนี้เก็บเป็นไฟล์ใน data/exam/)
-- เตรียมไว้สำหรับตอนขึ้น production จริง: รันใน Supabase SQL Editor แล้วย้าย lib/exam-store.ts
-- จากไฟล์ JSON มาอ่าน/เขียนตารางเหล่านี้แทน

-- 1) orders เดิมไม่รู้ว่าซื้อสินค้าตัวไหน — สิทธิ์ทำข้อสอบมีเฉพาะสินค้าที่มีชุด Mock
--    (mock1, bundle-all) จึงต้องบันทึก product_id ตอนสร้าง order ด้วย
alter table orders add column if not exists product_id text;

-- 2) การสอบ: 1 อีเมล = 1 แถว = 1 รอบ (primary key บังคับกติกาให้เอง)
create table if not exists exam_attempts (
  email text primary key,
  first_name text not null,
  last_name text not null,
  order_id text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  answers jsonb not null default '[]'::jsonb, -- array ยาว 70 — 0 = ไม่ตอบ, 1-5 = ช้อยส์
  correct_count int,
  created_at timestamptz not null default now()
);

-- ปิดการเข้าถึงจาก client ทั้งหมด — server ใช้ service role key เท่านั้น (แบบเดียวกับ orders)
alter table exam_attempts enable row level security;
