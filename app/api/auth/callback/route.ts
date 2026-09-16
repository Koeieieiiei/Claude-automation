import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForUser } from "@/lib/supabase-auth";
import { OAUTH_COOKIE, USER_COOKIE, createUserSession, safeNextPath } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase ส่งลูกค้ากลับมาที่นี่หลังเลือกบัญชี Google เสร็จ (?code=…)
 * แลก code เป็นอีเมลที่ยืนยันแล้ว → ออกคุกกี้ล็อกอิน → พากลับหน้าที่กดมา
 *
 * code ใช้ได้คู่กับ verifier ในคุกกี้ของ browser เครื่องนี้เท่านั้น (PKCE)
 * → คนอื่นส่งลิงก์ callback ที่มี code ของตัวเองมาหลอกให้เรากด ก็ล็อกอินเป็นเขาไม่ได้
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const raw = req.cookies.get(OAUTH_COOKIE)?.value ?? "";
  const sep = raw.indexOf("~");
  const verifier = sep > 0 ? raw.slice(0, sep) : "";
  let next = "/my-courses";
  try {
    next = safeNextPath(sep > 0 ? decodeURIComponent(raw.slice(sep + 1)) : null);
  } catch {
    /* คุกกี้เพี้ยน — กลับหน้าคอร์สของฉัน */
  }

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/my-courses?login_error=${reason}`, origin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  };

  // ลูกค้ากดยกเลิกที่หน้า Google / Supabase แจ้งข้อผิดพลาดกลับมา
  if (req.nextUrl.searchParams.get("error")) {
    console.warn(
      "ล็อกอิน Google ไม่สำเร็จ:",
      req.nextUrl.searchParams.get("error"),
      req.nextUrl.searchParams.get("error_description")
    );
    return fail("cancelled");
  }

  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code || !verifier) return fail("expired");

  let user;
  try {
    user = await exchangeCodeForUser(code, verifier);
  } catch (err) {
    console.error("เชื่อมต่อ Supabase ตอนล็อกอินไม่สำเร็จ:", err);
    return fail("server");
  }
  if (!user) return fail("expired");

  let session;
  try {
    session = createUserSession(user);
  } catch (err) {
    console.error("ออกคุกกี้ล็อกอินไม่สำเร็จ:", err);
    return fail("server");
  }

  const res = NextResponse.redirect(new URL(next, origin));
  res.cookies.delete(OAUTH_COOKIE);
  res.cookies.set(USER_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
