import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import {
  findEntitlement,
  getAttemptState,
  startAttempt,
  examDeadline,
  isUnlimitedEmail,
  deleteAttempt,
} from "@/lib/exam-store";

export const runtime = "nodejs";

/**
 * เริ่มจับเวลาสอบ — server เป็นคนประทับเวลาเริ่ม (ไม่เชื่อนาฬิกาเครื่องผู้สอบ)
 * เรียกซ้ำระหว่างสอบ = ทำต่อจากเดิม (คืนเวลาเริ่มเดิม + คำตอบที่บันทึกไว้)
 */
export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const payload = verifyExamToken(body.token ?? "");
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าห้องสอบ" }, { status: 403 });
  }

  const { state, attempt } = getAttemptState(payload.email);
  if (state === "submitted") {
    // อีเมลยกเว้น (เจ้าของร้าน): เริ่มรอบใหม่ได้ — ลบรอบเก่าทิ้งแล้วเริ่มนับหนึ่งใหม่
    if (isUnlimitedEmail(payload.email)) {
      deleteAttempt(payload.email);
    } else {
      return NextResponse.json({ error: "อีเมลนี้ทำข้อสอบครบ 1 รอบแล้ว" }, { status: 409 });
    }
  }

  if (state === "in_progress" && attempt) {
    return NextResponse.json({
      resumed: true,
      startedAt: new Date(attempt.startedAt).getTime(),
      deadline: examDeadline(attempt),
      serverNow: Date.now(),
      answers: attempt.answers,
    });
  }

  // ยังไม่เคยเริ่ม — ต้องมีสิทธิ์ซื้ออยู่จริง ณ ตอนเริ่ม
  // (อีเมลยกเว้นไม่ต้องมีคำสั่งซื้อ — ใช้ชื่อจากโทเค็นที่กรอกไว้ตอนผ่าน gate)
  const buyer =
    findEntitlement(payload.email) ??
    (isUnlimitedEmail(payload.email)
      ? {
          email: payload.email,
          firstName: payload.firstName || "เจ้าของร้าน",
          lastName: payload.lastName || "",
          orderId: "owner-test",
        }
      : null);
  if (!buyer) {
    return NextResponse.json({ error: "ไม่พบสิทธิ์ของอีเมลนี้" }, { status: 403 });
  }

  const created = startAttempt(buyer);
  return NextResponse.json({
    resumed: false,
    startedAt: new Date(created.startedAt).getTime(),
    deadline: examDeadline(created),
    serverNow: Date.now(),
    answers: created.answers,
  });
}
