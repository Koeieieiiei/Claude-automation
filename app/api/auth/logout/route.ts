import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, safeNextPath } from "@/lib/user-session";

export const dynamic = "force-dynamic";

/**
 * ออกจากระบบ — /api/auth/logout?next=/
 * ถ้าใส่ ?switch=1 จะพาไปหน้าเลือกบัญชี Google ต่อทันที (ปุ่ม "เปลี่ยนบัญชี")
 */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get("next"), "/");
  const target =
    req.nextUrl.searchParams.get("switch") === "1"
      ? `/api/auth/google?next=${encodeURIComponent(next)}`
      : next;
  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin));
  res.cookies.delete(USER_COOKIE);
  return res;
}
