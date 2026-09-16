import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** หน้าเว็บฝั่ง client ถามว่าตอนนี้ล็อกอินเป็นใคร (คุกกี้เป็น httpOnly JS อ่านเองไม่ได้) */
export async function GET(req: NextRequest) {
  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
