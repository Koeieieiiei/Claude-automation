import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/user-store";
import { createResetToken } from "@/lib/password-reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { config } from "@/lib/config";
import { allow, clientIp } from "@/lib/auth-rate-limit";
import { jsonError, readJson, str } from "@/lib/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ลืมรหัสผ่าน — POST { email } → ส่งลิงก์ตั้งรหัสผ่านไปที่อีเมล (ใช้ได้ 30 นาที)
 * ตอบ ok เสมอไม่ว่าอีเมลจะมีบัญชีหรือไม่ (ไม่ให้ใครใช้หน้านี้เช็คว่าอีเมลไหนเป็นสมาชิก)
 * ส่งให้ทุกอีเมลที่ขอ — คนที่กดลิงก์ได้คือเจ้าของอีเมล จะสร้าง/ตั้งรหัสให้บัญชีนั้นได้เลย
 * (เป็นทางเข้าของลูกค้ายุคล็อกอิน Google ที่ยังไม่มีรหัสผ่านด้วย)
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 254));
  if (!isValidEmail(email)) return jsonError("รูปแบบอีเมลไม่ถูกต้อง", 400);

  const ip = clientIp(req.headers);
  if (!allow(`forgot:ip:${ip}`, 10, 60 * 60 * 1000) || !allow(`forgot:email:${email}`, 3, 60 * 60 * 1000)) {
    return jsonError("ขอลิงก์ถี่เกินไป ตรวจอีเมล (รวมสแปม) หรือรอ 1 ชั่วโมง", 429);
  }

  try {
    const token = createResetToken(email);
    await sendPasswordResetEmail({
      to: email,
      link: `${config.baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
      reason: "forgot",
    });
  } catch (err) {
    console.error("ส่งลิงก์ตั้งรหัสผ่านไม่สำเร็จ:", err);
    return jsonError("ส่งอีเมลไม่สำเร็จ ลองใหม่ หรือติดต่อ mr.tpat3@gmail.com", 500);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
