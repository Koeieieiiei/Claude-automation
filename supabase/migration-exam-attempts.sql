-- ============================================================
--  ย้าย "ผลสอบออนไลน์" มาเก็บในฐานข้อมูล  (รันครั้งเดียวจบ)
--
--  วิธีใช้: เปิด Supabase → เมนูซ้าย "SQL Editor" → ปุ่ม "New query"
--           → วางทั้งหมดนี้ → กด "Run"
--
--  ปลอดภัย: สร้างตารางใหม่อย่างเดียว ไม่แตะข้อมูลเดิมเลย รันซ้ำกี่ครั้งก็ได้
--
--  ทำไมต้องย้าย:
--  เดิมเก็บผลสอบเป็น "ไฟล์" ใน Supabase Storage ซึ่งมีแคช CDN คั่นอยู่
--  ทำให้อ่านย้อนกลับได้ข้อมูลเวอร์ชันเก่าค้างนานเป็นนาที (วัดได้จริง 2026-07-26)
--  อาการคือ ผู้สอบกดส่งสำเร็จแล้ว แต่หน้าผลบอกว่า "ยังไม่มีผลสอบของอีเมลนี้"
--  และถ้ามีสองคำขอเขียนพร้อมกัน ผลที่ตรวจแล้วอาจถูกเขียนทับหายไป
--  ฐานข้อมูลไม่มีปัญหาทั้งสองอย่าง — เขียนเสร็จแล้วอ่านได้ค่าล่าสุดเสมอ
-- ============================================================

create table if not exists public.exam_attempts (
  exam_id      text not null,                    -- รหัสสนามสอบ เช่น tpat3-1
  email        text not null,                    -- อีเมลผู้สอบ (ตัวพิมพ์เล็กเสมอ)
  first_name   text not null default '',
  last_name    text not null default '',
  order_id     text not null default '',
  started_at   timestamptz not null,             -- เวลาเริ่มจับเวลา (server กำหนด)
  submitted_at timestamptz,                      -- null = ยังทำอยู่
  answers      jsonb not null,                   -- [0,1,..] 0 = ยังไม่ตอบ
  correct_count integer,
  score        numeric,                          -- คะแนนถ่วงน้ำหนัก
  updated_at   timestamptz not null default now(),
  primary key (exam_id, email)
);

-- ใช้ตอนคิดสถิติ (ดึงเฉพาะคนที่ส่งแล้วของสนามนั้น)
create index if not exists exam_attempts_submitted_idx
  on public.exam_attempts (exam_id, submitted_at)
  where submitted_at is not null;

-- เข้าถึงผ่าน service role key ฝั่ง server เท่านั้น (service role ข้าม RLS อยู่แล้ว)
alter table public.exam_attempts enable row level security;
