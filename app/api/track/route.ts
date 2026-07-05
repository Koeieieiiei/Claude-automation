import { NextRequest, NextResponse } from "next/server";
import { logVisit } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  let body: { path?: string; referrer?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ไม่มี body ก็ไม่เป็นไร */
  }

  // ตัดความยาวกันการยัดข้อมูลยาวๆ ลง Google Sheets (กัน abuse)
  // บังคับเป็น string ก่อนเสมอ — body มาจาก req.json() ที่ไม่ผ่าน validation อาจเป็นชนิดอื่น
  const cap = (v: unknown, n: number) => String(v ?? "").slice(0, n);

  await logVisit({
    path: cap(body.path, 300) || "/",
    referrer: cap(body.referrer, 500),
    userAgent: cap(req.headers.get("user-agent"), 500),
  });

  return NextResponse.json({ ok: true });
}
