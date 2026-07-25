import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getExam } from "@/lib/exams";
import { getAttempt, submitAttempt } from "@/lib/exam-store";

export const runtime = "nodejs";

/** ส่งกระดาษคำตอบ — ตรวจทันที แล้วให้หน้าเว็บพาไปดูผลที่ /exam/results */
export async function POST(req: NextRequest) {
  let body: { token?: string; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const payload = verifyExamToken(body.token ?? "");
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const exam = getExam(payload.examId);

  try {
    if (!(await getAttempt(exam, payload.email))) {
      return NextResponse.json({ error: "ยังไม่ได้เริ่มสอบ" }, { status: 409 });
    }
    const attempt = await submitAttempt(exam, payload.email, body.answers);
    return NextResponse.json({ ok: true, correctCount: attempt.correctCount });
  } catch (err) {
    console.error("ส่งข้อสอบไม่สำเร็จ:", err);
    return NextResponse.json(
      { error: "ส่งไม่สำเร็จ กรุณาลองกดส่งอีกครั้ง" },
      { status: 503 }
    );
  }
}
