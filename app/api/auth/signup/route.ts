import { NextRequest, NextResponse } from "next/server";
import { createUser, getUser, isValidEmail, normalizeEmail } from "@/lib/user-store";
import { passwordProblem } from "@/lib/password";
import { getLibrary } from "@/lib/library";
import { createResetToken } from "@/lib/password-reset-token";
import { sendPasswordResetEmail } from "@/lib/email";
import { config } from "@/lib/config";
import { allow, clientIp } from "@/lib/auth-rate-limit";
import { jsonError, loginResponse, readJson, str } from "@/lib/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * สมัครสมาชิกด้วยอีเมล + รหัสผ่าน — POST { email, password, next? }
 * สมัครเสร็จ = ล็อกอินให้ทันที (ไม่มีขั้นยืนยันอีเมล — เจ้าของขอให้กรอกแค่อีเมล+รหัส)
 *
 * ข้อยกเว้นเดียว: อีเมลที่ "มีคอร์สอยู่แล้ว" (เคยซื้อ) — ถ้าให้ใครก็ได้สมัครด้วยอีเมลนั้นทันที
 * คนแปลกหน้าที่รู้อีเมลลูกค้าจะเข้ามาโหลดไฟล์/ใช้สิทธิ์สอบของเขาได้ จึงส่ง "ลิงก์ตั้งรหัสผ่าน"
 * ไปที่อีเมลนั้นแทน (พิสูจน์ว่าเป็นเจ้าของอีเมลจริง) — ลูกค้าใหม่ทั่วไปไม่เจอขั้นนี้
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 254));
  const password = str(body.password, 200);
  if (!isValidEmail(email)) return jsonError("รูปแบบอีเมลไม่ถูกต้อง", 400);
  const problem = passwordProblem(password);
  if (problem) return jsonError(problem, 400);

  const ip = clientIp(req.headers);
  if (!allow(`signup:ip:${ip}`, 20, 60 * 60 * 1000)) {
    return jsonError("สมัครถี่เกินไป — รอสักครู่แล้วลองใหม่", 429);
  }

  try {
    if (await getUser(email)) {
      return jsonError("อีเมลนี้สมัครไว้แล้ว — กด “เข้าสู่ระบบ” หรือ “ลืมรหัสผ่าน”", 409, { code: "exists" });
    }

    const items = await getLibrary(email);
    if (items.length > 0) {
      const token = createResetToken(email);
      await sendPasswordResetEmail({
        to: email,
        link: `${config.baseUrl}/reset-password?token=${encodeURIComponent(token)}`,
        reason: "existing-customer",
      });
      return NextResponse.json(
        {
          ok: true,
          verifySent: true,
          message:
            "อีเมลนี้มีคอร์สอยู่แล้ว เราส่งลิงก์ตั้งรหัสผ่านไปที่อีเมลนี้เพื่อยืนยันว่าเป็นของน้องจริง — เปิดอีเมลแล้วกดลิงก์ (ใช้ได้ 30 นาที ดูในกล่องสแปมด้วย)",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const r = await createUser(email, password);
    if (r.status === "exists") {
      return jsonError("อีเมลนี้สมัครไว้แล้ว — กด “เข้าสู่ระบบ” หรือ “ลืมรหัสผ่าน”", 409, { code: "exists" });
    }
    return loginResponse(email, str(body.next), { created: true });
  } catch (err) {
    console.error("สมัครสมาชิกไม่สำเร็จ (ระบบ):", err);
    return jsonError("ระบบขัดข้องชั่วคราว — ลองใหม่อีกครั้ง", 500);
  }
}
