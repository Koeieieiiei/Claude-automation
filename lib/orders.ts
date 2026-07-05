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
