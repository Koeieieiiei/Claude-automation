import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, ready } from "./config";

/**
 * Supabase admin client (ใช้ service role key — ฝั่ง server เท่านั้น ห้ามใช้ใน client)
 * ถ้ายังไม่ได้ตั้งค่า key จะคืน null และระบบจะ fallback ไปใช้ in-memory store แทน
 */
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!ready.supabase) return null;
  if (!cached) {
    cached = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return cached;
}
