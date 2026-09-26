// ลบบัญชีผู้ใช้ (อีเมล+รหัสผ่าน) ออกจากระบบ — ใช้เมื่อผู้ใช้ขอลบบัญชี หรือล้างบัญชีทดสอบ
// รัน: node --env-file=.env.local scripts/delete-user.mjs <อีเมล> [--orders]
//   ไม่ใส่ --orders = ลบเฉพาะบัญชี (อีเมล+แฮชรหัสผ่าน) ออเดอร์/สิทธิ์คอร์สยังอยู่ สมัครใหม่ด้วยอีเมลเดิมก็เห็นคอร์สเดิม
//   ใส่ --orders    = ลบออเดอร์ของอีเมลนี้ในตาราง orders ด้วย (⚠️ ลูกค้าจริงจะเสียสิทธิ์คอร์ส — ใช้กับบัญชีทดสอบเท่านั้น)
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const email = (process.argv[2] || "").trim().toLowerCase();
const withOrders = process.argv.includes("--orders");
if (!email.includes("@")) {
  console.error("ใช้: node --env-file=.env.local scripts/delete-user.mjs <อีเมล> [--orders]");
  process.exit(1);
}
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const bucket = process.env.SUPABASE_BUCKET || "ebooks";
// path เดียวกับ lib/user-store.ts
const key = `auth/users/${createHash("sha256").update(email).digest("hex")}.json`;

const rm = await s.storage.from(bucket).remove([key]);
console.log(`ลบบัญชี ${email}:`, rm.error ? `ERR ${rm.error.message}` : `ok (${rm.data?.length ?? 0} ไฟล์)`);
if (withOrders) {
  const del = await s.from("orders").delete().eq("email", email).select("id,amount,product_id");
  console.log("ลบออเดอร์:", del.error ? `ERR ${del.error.message}` : `ok ${del.data?.length ?? 0} รายการ`, del.data ?? "");
}
const left = await s.storage.from(bucket).list("auth/users", { limit: 1000 });
console.log("บัญชีที่เหลือในระบบ:", left.error ? "ERR" : left.data.length);
