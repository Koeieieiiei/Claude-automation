import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { findEntitlement, getAttemptState, startAttempt, examDeadline } from "@/lib/exam-store";

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
    return NextResponse.json({ error: "อีเมลนี้ทำข้อสอบครบ 1 รอบแล้ว" }, { status: 409 });
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
  const buyer = findEntitlement(payload.email);
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
