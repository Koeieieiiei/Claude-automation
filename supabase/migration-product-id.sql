-- ============================================================
--  เพิ่มคอลัมน์ product_id ในตาราง orders (สำหรับหน้าสรุปยอดขาย /admin)
--
--  วิธีใช้: เปิด Supabase > SQL Editor > New query > วางทั้งหมดนี้ > Run
--  ปลอดภัย: เป็นการ "เพิ่ม" คอลัมน์อย่างเดียว ข้อมูลเดิมไม่ถูกแตะต้อง
--  รันซ้ำได้ (if not exists) — ออเดอร์เก่าจะเป็น null แล้วค่อยเติมด้วย
--  scripts/backfill-product-id.mjs (ดึงจาก metadata ของ Stripe)
-- ============================================================

alter table public.orders
  add column if not exists product_id text;

create index if not exists orders_product_id_idx on public.orders (product_id);

-- ใช้เรียงตามเวลาบนหน้า /admin
create index if not exists orders_created_at_idx on public.orders (created_at desc);
