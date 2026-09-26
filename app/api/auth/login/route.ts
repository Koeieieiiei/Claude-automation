import { NextRequest } from "next/server";
import { authenticate, getUser, isValidEmail, normalizeEmail } from "@/lib/user-store";
import { getLibrary } from "@/lib/library";
import { allow, clientIp, reset } from "@/lib/auth-rate-limit";
import { jsonError, loginResponse, readJson, str } from "@/lib/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน — POST { email, password, next? }
 * สำเร็จ → { ok, next } + คุกกี้ล็อกอิน · ผิด → 401 ข้อความเดียวกันไม่ว่าอีเมลจะมีหรือไม่
 * (ยกเว้นเคสอีเมลที่ "เคยซื้อคอร์ส" แต่ยังไม่มีรหัสผ่าน — บอกให้ไปตั้งรหัสผ่านทางอีเมล
 * เพื่อช่วยลูกค้ายุคล็อกอิน Google ที่ยังไม่มีรหัสผ่านให้เข้ามาได้)
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 254));
  const password = str(body.password, 200);
  if (!isValidEmail(email) || !password) return jsonError("กรอกอีเมลและรหัสผ่านให้ครบ", 400);

  const ip = clientIp(req.headers);
  if (!allow(`login:ip:${ip}`, 30, 15 * 60 * 1000) || !allow(`login:email:${email}`, 10, 15 * 60 * 1000)) {
    return jsonError("ผิดหลายครั้งเกินไป รอ 15 นาที หรือกด “ลืมรหัสผ่าน”", 429);
  }

  try {
    const user = await authenticate(email, password);
    if (user) {
      reset(`login:email:${email}`);
      return loginResponse(email, str(body.next));
    }
    // ยังไม่มีบัญชีแต่มีคอร์สอยู่ (ลูกค้าเก่า) → ชี้ทางตั้งรหัสผ่านทางอีเมล
    if (!(await getUser(email))) {
      const items = await getLibrary(email).catch(() => []);
      if (items.length > 0) {
        return jsonError(
          "อีเมลนี้มีคอร์สแต่ยังไม่มีรหัสผ่าน กด “ลืมรหัสผ่าน” เพื่อตั้งรหัสผ่าน",
          401,
          { code: "needs_password" }
        );
      }
    }
    return jsonError("อีเมลหรือรหัสผ่านไม่ถูกต้อง", 401);
  } catch (err) {
    console.error("ล็อกอินไม่สำเร็จ (ระบบ):", err);
    return jsonError("ระบบขัดข้องชั่วคราว — ลองใหม่อีกครั้ง", 500);
  }
}
