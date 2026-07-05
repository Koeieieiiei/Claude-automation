-- ============================================================
--  Schema สำหรับ Supabase
--  วิธีใช้: เปิด Supabase > SQL Editor > วางทั้งหมดนี้ > Run
-- ============================================================

-- ตาราง orders: เก็บคำสั่งซื้อ
create table if not exists public.orders (
  id uuid primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  amount numeric not null,
  status text not null default 'pending',          -- pending | paid | delivered
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create index if not exists orders_email_idx on public.orders (email);
create index if not exists orders_status_idx on public.orders (status);

-- เปิด Row Level Security (RLS) — เราเข้าถึงผ่าน service role key ฝั่ง server เท่านั้น
-- จึงไม่ต้องสร้าง policy สำหรับ anon (service role ข้าม RLS อยู่แล้ว)
alter table public.orders enable row level security;

-- ============================================================
--  Storage: สร้าง bucket ชื่อ "ebooks" (ตั้งเป็น Private)
--  ทำผ่านหน้า UI: Supabase > Storage > New bucket > ชื่อ ebooks > ปิด Public
--  แล้วอัปโหลดไฟล์ต้นฉบับ 2 ไฟล์ไปที่ path:
--    master/questions.pdf  (ไฟล์โจทย์)
--    master/answers.pdf    (ไฟล์เฉลย)
-- ============================================================
