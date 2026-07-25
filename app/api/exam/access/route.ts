import { NextRequest, NextResponse } from "next/server";
import { createExamToken, verifyExamToken } from "@/lib/exam-token";
import { findEntitlement, getAttemptState, examDeadline } from "@/lib/exam-store";

export const runtime = "nodejs";

/**
 * เช็คสิทธิ์เข้าห้องสอบ — รับ { email } (พิมพ์เอง) หรือ { token } (จากลิงก์/localStorage)
 *
 * ตอบ state อย่างใดอย่างหนึ่ง:
 *   none        ไม่พบสิทธิ์ (ยังไม่ซื้อ / อีเมลไม่ตรงกับที่ซื้อ)
 *   eligible    มีสิทธิ์ ยังไม่เริ่มทำ
 *   in_progress เริ่มทำแล้ว ยังไม่หมดเวลา (ทำต่อได้)
 *   submitted   ส่งข้อสอบแล้ว (ดูผลได้ ทำซ้ำไม่ได้ — 1 อีเมลทำได้ 1 รอบ)
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let email = "";
  let name: { firstName: string; lastName: string } | null = null;
  let orderId = "";

  if (typeof body.token === "string" && body.token) {
    const payload = verifyExamToken(body.token);
    if (!payload) {
      return NextResponse.json({ error: "ลิงก์หมดอายุหรือไม่ถูกต้อง — กรอกอีเมลที่ใช้ซื้อเพื่อเข้าใหม่" }, { status: 403 });
    }
    email = payload.email;
    name = { firstName: payload.firstName, lastName: payload.lastName };
    orderId = payload.orderId;
  } else if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim().toLowerCase();
  } else {
    return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
  }

  const buyer = findEntitlement(email);
  const { state, attempt } = getAttemptState(email);

  // ไม่มีสิทธิ์และไม่เคยมีการสอบค้างอยู่ → none (ไม่บอกรายละเอียดมากกว่านี้)
  if (!buyer && state === "none") {
    return NextResponse.json({ state: "none" });
  }

  const firstName = attempt?.firstName ?? buyer?.firstName ?? name?.firstName ?? "";
  const lastName = attempt?.lastName ?? buyer?.lastName ?? name?.lastName ?? "";
  const token = createExamToken({
    email,
    firstName,
    lastName,
    orderId: attempt?.orderId ?? buyer?.orderId ?? orderId,
  });

  return NextResponse.json({
    state: state === "none" ? "eligible" : state,
    token,
    email,
    firstName,
    ...(state === "in_progress" && attempt
      ? { deadline: examDeadline(attempt), serverNow: Date.now() }
      : {}),
  });
}
