import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";
import { isClaimableProduct } from "@/lib/catalog";
import { claimProduct } from "@/lib/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ปุ่ม "รับฟรี" ชี้มาที่นี่ — GET /api/claim?product=sum4
 *
 *   ยังไม่ล็อกอิน → พาไปหน้าเข้าสู่ระบบ/สมัคร (อีเมล+รหัสผ่าน) แล้วเด้งกลับมาที่ URL นี้ต่อให้เอง (next=)
 *   ล็อกอินแล้ว   → เปิดสิทธิ์ให้บัญชีนี้ทันที (ฟรี ไม่มีการชำระเงิน) → ไปหน้า "คอร์สของฉัน"
 *
 * ทำเป็น GET เพื่อให้ "กดปุ่ม → ล็อกอิน → ได้คอร์ส" จบในคลิกเดียวโดยไม่ต้องมีหน้ากลางหลังล็อกอิน
 * ผลข้างเคียงมีแค่ "ให้ของฟรีแก่บัญชีที่ล็อกอินอยู่เอง" จึงไม่มีอะไรให้คนอื่นแอบยิงแทนแล้วได้ประโยชน์
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const productId = req.nextUrl.searchParams.get("product") ?? "";
  if (!isClaimableProduct(productId)) {
    return NextResponse.redirect(new URL("/?claim_error=unknown", origin));
  }

  const user = verifyUserSession(req.cookies.get(USER_COOKIE)?.value);
  if (!user) {
    const next = `/api/claim?product=${encodeURIComponent(productId)}`;
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, origin));
  }

  try {
    const { status } = await claimProduct(user, productId);
    const u = new URL("/my-courses", origin);
    u.searchParams.set("claimed", productId);
    if (status === "already-owned") u.searchParams.set("already", "1");
    return NextResponse.redirect(u);
  } catch (err) {
    console.error(`รับคอร์สฟรีไม่สำเร็จ (${productId}, ${user.email}):`, err);
    return NextResponse.redirect(new URL(`/my-courses?claim_error=${encodeURIComponent(productId)}`, origin));
  }
}
