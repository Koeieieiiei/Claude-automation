import { FileId, PRODUCTS, Product, ProductId, getProduct } from "./catalog";
import { getSupabase } from "./supabase";
import { getStripe } from "./stripe";

/**
 * "คอร์สของฉัน" — รวมทุกอย่างที่อีเมลหนึ่งซื้อไว้ (อ่านจากตาราง orders ที่ส่งของแล้ว)
 * ใช้กับหน้า /my-courses และหน้ารายละเอียดคอร์ส (โชว์ปุ่ม "เข้าเรียน" แทน "สั่งซื้อ" ถ้าซื้อแล้ว)
 */

export interface LibraryItem {
  orderId: string;
  productId: ProductId;
  productName: string;
  purchasedAt: string; // ISO
  /** ชื่อ-อีเมลตอนสั่งซื้อ — ใช้ใส่ลายน้ำให้ตรงกับไฟล์ที่ส่งทางอีเมล */
  firstName: string;
  lastName: string;
  email: string;
  files: FileId[];
}

/**
 * วันที่เปลี่ยนสินค้า "สรุป TPAT3" (99฿: ไฟล์เนื้อหา + สูตรล้วน) เป็นเล่ม "เนื้อหาทั้งหมด" 160 หน้า
 * ออเดอร์ sum4 / bundle-all ก่อนหน้านี้ได้ไฟล์รุ่นเก่า — โชว์ตามที่ซื้อจริง (commit 4628e3b)
 */
const CONTENT_SWITCH_AT = "2026-09-16T09:43:09Z";
const OLD_SUMMARY_FILES: FileId[] = ["sum4content", "sum4formula"];

function filesForOrder(product: Product, createdAt: string): FileId[] {
  if (createdAt < CONTENT_SWITCH_AT && product.files.includes("tpat3content")) {
    return [...product.files.filter((f) => f !== "tpat3content"), ...OLD_SUMMARY_FILES];
  }
  return product.files;
}

interface OrderRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
  stripe_session_id: string | null;
  product_id?: string | null;
}

/** สินค้าของออเดอร์ — คอลัมน์ product_id ก่อน, ไม่มีค่อยถาม Stripe, ออเดอร์ยุคแรก (ไม่มี session) = Mock */
async function productOf(o: OrderRow): Promise<Product | null> {
  if (o.product_id) return getProduct(o.product_id); // SKU ที่เลิกขายไปแล้ว = null (ข้าม)
  if (!o.stripe_session_id) return PRODUCTS.mock1;
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(o.stripe_session_id);
    const pid = session.metadata?.productId;
    return pid ? getProduct(pid) : PRODUCTS.mock1;
  } catch (err) {
    console.error(`อ่านสินค้าของ order ${o.id} จาก Stripe ไม่สำเร็จ:`, err);
    return null;
  }
}

export async function getLibrary(email: string): Promise<LibraryItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const clean = email.trim().toLowerCase();
  // escape wildcard ของ LIKE ก่อนเสมอ (เหตุผลเดียวกับ findEntitlementByEmail ใน lib/exam-store.ts)
  const pattern = clean.replace(/([\\%_])/g, "\\$1");
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .ilike("email", pattern)
    .eq("status", "delivered")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`อ่านคำสั่งซื้อไม่สำเร็จ: ${error.message}`);

  // ซื้อสินค้าเดิมซ้ำหลายรอบ → โชว์ครั้งเดียว (ใช้ออเดอร์ล่าสุด)
  const byProduct = new Map<ProductId, LibraryItem>();
  for (const o of (data ?? []) as OrderRow[]) {
    const product = await productOf(o);
    if (!product || byProduct.has(product.id)) continue;
    byProduct.set(product.id, {
      orderId: o.id,
      productId: product.id,
      productName: product.name,
      purchasedAt: o.created_at,
      firstName: o.first_name ?? "",
      lastName: o.last_name ?? "",
      email: clean,
      files: filesForOrder(product, o.created_at),
    });
  }
  return [...byProduct.values()];
}

/** ไฟล์ทั้งหมดที่อีเมลนี้มีสิทธิ์ (รวมทุกออเดอร์) */
export function ownedFiles(items: LibraryItem[]): Set<FileId> {
  return new Set(items.flatMap((i) => i.files));
}

/** ซื้อสินค้านี้ครบแล้วหรือยัง (มีทุกไฟล์ของสินค้า — จะมาจากออเดอร์ไหนก็ได้) */
export function ownsProduct(items: LibraryItem[], product: Product): boolean {
  const owned = ownedFiles(items);
  return product.files.every((f) => owned.has(f));
}
