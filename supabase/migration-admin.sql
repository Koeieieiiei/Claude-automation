-- ============================================================
--  อัปเดตฐานข้อมูลสำหรับหน้าหลังร้าน /admin  (รันครั้งเดียวจบ)
--
--  วิธีใช้: เปิด Supabase → เมนูซ้าย "SQL Editor" → ปุ่ม "New query"
--           → วางทั้งหมดนี้ → กด "Run"
--
--  ปลอดภัย: มีแต่การ "เพิ่ม" คอลัมน์/ตารางใหม่ ไม่แตะข้อมูลเดิมเลย
--           และรันซ้ำกี่ครั้งก็ได้ (ทุกคำสั่งเป็น if not exists)
-- ============================================================


-- ── 1) บอกว่าออเดอร์แต่ละใบคือสินค้าตัวไหน ────────────────────
-- ใช้แจกแจงยอดขายรายสินค้าบนหน้า /admin ให้แม่นยำ 100%
-- (ออเดอร์เก่าจะเป็นค่าว่างก่อน แล้วค่อยเติมด้วย scripts/backfill-product-id.mjs)

alter table public.orders
  add column if not exists product_id text;

create index if not exists orders_product_id_idx on public.orders (product_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);


-- ── 2) สมุดบัญชีรายรับรายจ่าย ────────────────────────────────
-- รายรับจากการขายบนเว็บ ระบบดึงจากตาราง orders ให้อัตโนมัติ (ไม่ต้องกรอก)
-- ตารางนี้ไว้เก็บ "รายจ่าย" และ "รายรับนอกเว็บ" ที่กรอกเองบนหน้า /admin

create table if not exists public.ledger (
  id uuid primary key,
  occurred_on date not null,                                  -- วันที่ของรายการ
  kind text not null check (kind in ('income', 'expense')),   -- รายรับ | รายจ่าย
  category text not null,                                     -- หมวด เช่น ค่าโฆษณา
  note text not null default '',                              -- รายละเอียดเพิ่มเติม
  amount numeric not null check (amount >= 0),                -- จำนวนเงิน (บาท)
  created_at timestamptz not null default now()
);

create index if not exists ledger_occurred_on_idx on public.ledger (occurred_on desc);

-- เข้าถึงผ่าน service role key ฝั่ง server เท่านั้น (service role ข้าม RLS อยู่แล้ว)
alter table public.ledger enable row level security;
