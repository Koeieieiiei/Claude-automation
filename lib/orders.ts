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
}

/**
 * In-memory fallback store — ใช้เฉพาะตอนยังไม่ได้ตั้งค่า Supabase (โหมดทดสอบ local)
 * ข้อมูลจะหายเมื่อรีสตาร์ท server แต่เพียงพอสำหรับเดินดู flow ตอน dev
 */
const memoryStore = new Map<string, Order>();

export async function createOrder(input: {
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
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
  };

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("orders").insert(order);
    if (error) throw new Error(`สร้าง order ไม่สำเร็จ: ${error.message}`);
  } else {
    memoryStore.set(order.id, order);
  }
  return order;
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
