/**
 * เติมคอลัมน์ product_id ให้ออเดอร์เก่าที่บันทึกไว้ก่อนมีคอลัมน์นี้
 *
 * ที่มาของข้อมูล (เรียงตามความน่าเชื่อถือ):
 *   1) metadata.productId ของ Stripe Checkout Session (ความจริงแท้ — ตอนกดสั่งซื้อบันทึกไว้)
 *   2) เดาจากยอดเงิน สำหรับออเดอร์ยุคเก่าที่ Stripe ยังไม่มี metadata นี้
 *
 * วิธีใช้ (รันจากโฟลเดอร์โปรเจกต์ หลังรัน supabase/migration-product-id.sql แล้ว):
 *   node --env-file=.env.local scripts/backfill-product-id.mjs          ← ดูผลก่อน (ไม่เขียนจริง)
 *   node --env-file=.env.local scripts/backfill-product-id.mjs --write  ← เขียนจริง
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const WRITE = process.argv.includes("--write");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** ราคาที่เคยขาย → สินค้า (299 = ยุคขายชุด Mock อย่างเดียว) */
const PRICE_TO_PRODUCT = { 99: "sum4", 159: "mock1", 199: "bundle-all", 299: "mock1" };

const { data: orders, error } = await supabase
  .from("orders")
  .select("id, amount, status, stripe_session_id, product_id")
  .is("product_id", null)
  .order("created_at", { ascending: true });

if (error) {
  console.error("อ่านตาราง orders ไม่สำเร็จ:", error.message);
  console.error("ถ้าข้อความบอกว่าไม่รู้จัก product_id → ยังไม่ได้รัน supabase/migration-product-id.sql");
  process.exit(1);
}

console.log(`ออเดอร์ที่ยังไม่มี product_id: ${orders.length} รายการ`);
if (!orders.length) process.exit(0);

const summary = {};
let fromStripe = 0;
let fromPrice = 0;
let unknown = 0;
let written = 0;

for (const o of orders) {
  let productId = null;

  if (o.stripe_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
      if (session?.metadata?.productId) {
        productId = session.metadata.productId;
        fromStripe++;
      }
    } catch (err) {
      // session เก่าเกินจนหาไม่เจอ/คนละ mode (test vs live) — ตกไปใช้การเดาจากราคา
      console.warn(`  อ่าน session ของ order ${o.id} ไม่ได้: ${err.message}`);
    }
  }

  if (!productId) {
    productId = PRICE_TO_PRODUCT[Number(o.amount)] ?? null;
    if (productId) fromPrice++;
  }

  if (!productId) {
    unknown++;
    continue;
  }

  summary[productId] = (summary[productId] ?? 0) + 1;

  if (WRITE) {
    const { error: upErr } = await supabase
      .from("orders")
      .update({ product_id: productId })
      .eq("id", o.id);
    if (upErr) console.error(`  เขียน order ${o.id} ไม่สำเร็จ:`, upErr.message);
    else written++;
  }
}

console.log("\nสรุป:");
console.log(`  รู้สินค้าจาก Stripe metadata : ${fromStripe}`);
console.log(`  เดาจากราคา                  : ${fromPrice}`);
console.log(`  ไม่รู้ (ปล่อยว่างไว้)         : ${unknown}`);
console.log("  แยกตามสินค้า:", summary);
console.log(WRITE ? `\n✅ เขียนลงฐานข้อมูลแล้ว ${written} รายการ` : "\n(ยังไม่เขียนจริง — เติม --write เมื่อพร้อม)");
