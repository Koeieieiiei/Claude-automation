import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminReady,
  allowLoginAttempt,
  clearLoginAttempts,
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD สำหรับหน้าสรุปยอดขาย" },
      { status: 503 }
    );
  }

  const ip = clientIp(req);
  if (!allowLoginAttempt(ip)) {
    return NextResponse.json(
      { error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    /* body ไม่ใช่ JSON = ถือว่ารหัสว่าง */
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  clearLoginAttempts(ip);
  const session = createAdminSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
