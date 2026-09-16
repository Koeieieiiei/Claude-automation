import { NextRequest, NextResponse } from "next/server";

/**
 * บังคับใช้โดเมนหลักเดียว: www.tpat3mock.com → tpat3mock.com (308 ถาวร)
 *
 * เหตุผล (เจอจริง 2026-09-16): คุกกี้ล็อกอินผูกกับโดเมนที่ตั้ง — เข้า www แล้วล็อกอิน
 * คุกกี้จะอยู่ที่ www อย่างเดียว และ Supabase ส่งกลับได้เฉพาะโดเมนที่อยู่ใน Redirect URLs
 * (ตั้งไว้ tpat3mock.com) → คนที่เข้าทาง www ล็อกอินไม่สำเร็จ/เหมือนไม่ได้ล็อกอิน
 *
 * ไม่แตะ /api/stripe (webhook ของ Stripe ไม่ตาม redirect) และไฟล์ static ของ Next
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  if (!host.startsWith("www.")) return NextResponse.next();
  const url = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, `https://${host.slice(4)}`);
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!api/stripe|_next/static|_next/image|favicon.ico).*)"],
};
