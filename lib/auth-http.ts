import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, createUserSession, safeNextPath } from "./user-session";

/**
 * ของใช้ร่วมของ API ล็อกอิน/สมัคร/ตั้งรหัสผ่าน (app/api/auth/*)
 * ล็อกอินสำเร็จ = ออกคุกกี้ HMAC ใบเดียวกับที่ระบบเดิม (Google) ใช้ — ส่วนอื่นของเว็บไม่ต้องรู้ว่าล็อกอินแบบไหน
 */

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** ตอบสำเร็จพร้อมตั้งคุกกี้ล็อกอินให้อีเมลนี้ · ชื่อที่โชว์ = ส่วนหน้า @ (ไม่ได้ให้กรอกชื่อ — เจ้าของขอให้กรอกแค่อีเมล+รหัส) */
export function loginResponse(email: string, next: string | null | undefined, extra: Record<string, unknown> = {}) {
  const clean = email.trim().toLowerCase();
  const session = createUserSession({ email: clean, name: clean.split("@")[0], picture: "" });
  const res = NextResponse.json(
    { ok: true, next: safeNextPath(next), ...extra },
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.set(USER_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
