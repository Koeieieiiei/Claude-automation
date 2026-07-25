import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getExam } from "@/lib/exams";
import {
  findEntitlementByEmail,
  getAttemptState,
  startAttempt,
  examDeadline,
  isUnlimitedEmail,
  resetAttempt,
  Entitlement,
} from "@/lib/exam-store";

export const runtime = "nodejs";

/**
 * เริ่มจับเวลาสอบ — server เป็นคนประทับเวลาเริ่ม (ไม่เชื่อนาฬิกาเครื่องผู้สอบ)
 * สนามสอบอ่านจากโทเค็น · เรียกซ้ำระหว่างสอบ = ทำต่อจากเดิม
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
  const exam = getExam(payload.examId);

  try {
    const { state, attempt } = await getAttemptState(exam, payload.email);

    if (state === "submitted") {
      // อีเมลยกเว้น (เจ้าของร้าน): เริ่มรอบใหม่ได้ — ถอนผลรอบเก่าออกจากสถิติแล้วเริ่มใหม่
      if (isUnlimitedEmail(payload.email)) {
        await resetAttempt(exam, payload.email);
      } else {
        return NextResponse.json({ error: "อีเมลนี้ทำข้อสอบครบ 1 รอบแล้ว" }, { status: 409 });
      }
    }

    if (state === "in_progress" && attempt) {
      return NextResponse.json({
        resumed: true,
        startedAt: new Date(attempt.startedAt).getTime(),
        deadline: examDeadline(exam, attempt),
        serverNow: Date.now(),
        answers: attempt.answers,
      });
    }

    // ยังไม่เคยเริ่ม — ต้องมีสิทธิ์ซื้ออยู่จริง ณ ตอนเริ่ม
    // (อีเมลยกเว้นไม่ต้องมีคำสั่งซื้อ — ใช้ชื่อจากโทเค็นที่กรอกไว้ตอนผ่านหน้ายืนยันตัวตน)
    const buyers = await findEntitlementByEmail(exam, payload.email);
    const buyer: Entitlement | null =
      buyers.find(
        (b) => b.firstName === payload.firstName && b.lastName === payload.lastName
      ) ??
      buyers[0] ??
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

    const created = await startAttempt(exam, buyer);
    return NextResponse.json({
      resumed: false,
      startedAt: new Date(created.startedAt).getTime(),
      deadline: examDeadline(exam, created),
      serverNow: Date.now(),
      answers: created.answers,
    });
  } catch (err) {
    console.error("เริ่มสอบไม่สำเร็จ:", err);
    return NextResponse.json(
      { error: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" },
      { status: 503 }
    );
  }
}
