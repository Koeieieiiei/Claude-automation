import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";

/** ข้อมูล order หนึ่งรายการ */
export interface Order {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  amount: number; // บาท
  status: "pending" | "paid" | "delivered";
  stripe_session_id: string | null;
  created_at: string;
  /**
   * สินค้าที่สั่ง (ProductId จาก lib/catalog.ts) — เพิ่มทีหลังเพื่อให้หน้า /admin
   * แจกแจงยอดขายรายสินค้าได้ ออเดอร์เก่าเป็น null (หน้า admin เดาจากราคาให้)
   */
  product_id?: string | null;
}

/**
 * In-memory fallback store — ใช้เฉพาะตอนยังไม่ได้ตั้งค่า Supabase (โหมดทดสอบ local)
 * ข้อมูลจะหายเมื่อรีสตาร์ท server แต่เพียงพอสำหรับเดินดู flow ตอน dev
 */
const memoryStore = new Map<string, Order>();

/**
 * ตารางเก่ายังไม่มีคอลัมน์ product_id (ต้องรัน supabase/migration-product-id.sql ก่อน)
 * — ถ้าเจอกรณีนี้ให้บันทึกออเดอร์แบบไม่มีคอลัมน์นั้นแทน ห้ามให้การสั่งซื้อล้ม
 */
function isMissingProductColumn(error: { message?: string; code?: string }): boolean {
  return Boolean(error.message?.includes("product_id"));
}

export async function createOrder(input: {
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
  productId?: string;
}): Promise<Order> {
  const order: Order = {
    id: randomUUID(),
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    amount: input.amount,
    status: "pending",
    stripe_session_id: null,
    created_at: new Date().toISOString(),
    product_id: input.productId ?? null,
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("orders").insert(order);
    if (error) {
      if (!isMissingProductColumn(error)) {
        throw new Error(`สร้าง order ไม่สำเร็จ: ${error.message}`);
      }
      console.warn(
        "ตาราง orders ยังไม่มีคอลัมน์ product_id — บันทึกออเดอร์แบบไม่มีสินค้ากำกับไปก่อน " +
          "(รัน supabase/migration-product-id.sql เพื่อให้หน้า /admin แยกยอดรายสินค้าได้แม่นยำ)"
      );
      const { product_id: _omit, ...withoutProduct } = order;
      const retry = await supabase.from("orders").insert(withoutProduct);
      if (retry.error) throw new Error(`สร้าง order ไม่สำเร็จ: ${retry.error.message}`);
    }
  } else {
    memoryStore.set(order.id, order);
  }
  return order;
}

/**
 * ดึงออเดอร์ทั้งหมดสำหรับหน้าสรุปยอดขาย (/admin) — ใหม่สุดก่อน
 * ร้านมีออเดอร์หลักร้อย การดึงทีเดียวจึงเร็วกว่าการไล่ query ทีละช่วง
 */
export async function listOrders(limit = 5000): Promise<Order[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`อ่านรายการ order ไม่สำเร็จ: ${error.message}`);
    return (data as Order[]) ?? [];
  }
  return [...memoryStore.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function getOrder(id: string): Promise<Order | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from("orders").select("*").eq("id", id).single();
    return (data as Order) ?? null;
  }
  return memoryStore.get(id) ?? null;
}

export type ClaimResult = "claimed" | "already-delivered" | "not-found";

/**
 * จอง "สิทธิ์ส่งของ" แบบ atomic — เปลี่ยนสถานะเป็น delivered เฉพาะเมื่อยังไม่เคย delivered
 *
 * ใช้กันส่งของซ้ำเมื่อ Stripe ส่ง webhook ซ้ำ/พร้อมกันหลายตัว:
 * เดิมใช้วิธี "อ่านสถานะ → ค่อยส่งของ → ค่อยอัปเดต" ซึ่งมีช่องว่าง (TOCTOU)
 * ให้สองคำขอผ่านพร้อมกันได้ — เปลี่ยนเป็น UPDATE แบบมีเงื่อนไขในคำสั่งเดียว
 * ฝั่งฐานข้อมูลรับประกันว่ามีผู้ชนะเพียงรายเดียว
 */
export async function claimDelivery(id: string): Promise<ClaimResult> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", id)
      .neq("status", "delivered")
      .select("id");
    if (error) throw new Error(`จองสิทธิ์ส่งของไม่สำเร็จ: ${error.message}`);
    if (data && data.length > 0) return "claimed";
    // ไม่มีแถวถูกอัปเดต: อาจ delivered ไปแล้ว หรือไม่มี order นี้เลย — แยกให้ชัด
    const existing = await getOrder(id);
    return existing ? "already-delivered" : "not-found";
  }
  const existing = memoryStore.get(id);
  if (!existing) return "not-found";
  if (existing.status === "delivered") return "already-delivered";
  memoryStore.set(id, { ...existing, status: "delivered" });
  return "claimed";
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(`อัปเดต order ไม่สำเร็จ: ${error.message}`);
  } else {
    const existing = memoryStore.get(id);
    if (existing) memoryStore.set(id, { ...existing, ...patch });
  }
}
