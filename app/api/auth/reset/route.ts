import { NextRequest } from "next/server";
import { getUser, setPassword } from "@/lib/user-store";
import { passwordProblem } from "@/lib/password";
import { verifyResetToken } from "@/lib/password-reset-token";
import { allow, clientIp } from "@/lib/auth-rate-limit";
import { jsonError, loginResponse, readJson, str } from "@/lib/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล — POST { token, password }
 * โทเค็นถูกต้อง + ยังไม่หมดอายุ + ยังไม่เคยใช้ (ออกหลังการตั้งรหัสครั้งล่าสุด) → ตั้งรหัส + ล็อกอินให้เลย
 * ไม่มีบัญชี (ลูกค้ายุค Google / คนใหม่ที่มาจากหน้าสมัคร) → สร้างบัญชีให้ เพราะพิสูจน์แล้วว่าเป็นเจ้าของอีเมล
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const payload = verifyResetToken(str(body.token, 2000));
  if (!payload) return jsonError("ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว (ใช้ได้ 30 นาที) — ขอลิงก์ใหม่ได้ที่ “ลืมรหัสผ่าน”", 400, { code: "invalid_token" });
  const password = str(body.password, 200);
  const problem = passwordProblem(password);
  if (problem) return jsonError(problem, 400);

  if (!allow(`reset:ip:${clientIp(req.headers)}`, 10, 15 * 60 * 1000)) {
    return jsonError("ลองถี่เกินไป — รอสักครู่แล้วลองใหม่", 429);
  }

  try {
    const existing = await getUser(payload.email);
    if (existing && Date.parse(existing.passwordUpdatedAt) > payload.iat) {
      return jsonError("ลิงก์นี้ถูกใช้ไปแล้ว — ถ้ายังเข้าไม่ได้ ขอลิงก์ใหม่ที่ “ลืมรหัสผ่าน”", 400, { code: "used_token" });
    }
    await setPassword(payload.email, password);
    return loginResponse(payload.email, "/my-courses", { reset: true });
  } catch (err) {
    console.error("ตั้งรหัสผ่านใหม่ไม่สำเร็จ (ระบบ):", err);
    return jsonError("ระบบขัดข้องชั่วคราว — ลองใหม่อีกครั้ง", 500);
  }
}
