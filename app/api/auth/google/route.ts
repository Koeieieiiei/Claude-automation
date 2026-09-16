import { NextRequest, NextResponse } from "next/server";
import { createPkcePair, googleAuthorizeUrl, googleLoginReady } from "@/lib/supabase-auth";
import { OAUTH_COOKIE, safeNextPath } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ปุ่ม "เข้าสู่ระบบด้วย Google" ทุกปุ่มชี้มาที่นี่ — /api/auth/google?next=/exam
 * next = หน้าที่จะพากลับไปหลังล็อกอินเสร็จ (รับเฉพาะ path ภายในเว็บ)
 */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));

  if (!googleLoginReady()) {
    return NextResponse.redirect(new URL("/my-courses?login_error=setup", req.nextUrl.origin));
  }

  const { verifier, challenge } = createPkcePair();
  // กลับมาที่โดเมนเดียวกับที่ลูกค้ากดปุ่ม (tpat3mock.com บนเว็บจริง / localhost ตอนทดสอบ)
  const redirectTo = `${req.nextUrl.origin}/api/auth/callback`;

  const res = NextResponse.redirect(googleAuthorizeUrl({ redirectTo, challenge }));
  res.cookies.set(OAUTH_COOKIE, `${verifier}~${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax", // ต้องเป็น lax: ขากลับเป็นการ redirect ข้ามเว็บจาก Supabase/Google
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60, // มีเวลากดเลือกบัญชี 15 นาที
  });
  return res;
}
