import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { saveAnswers } from "@/lib/exam-store";

export const runtime = "nodejs";

/** autosave คำตอบระหว่างสอบ — เผื่อหน้าเว็บถูกปิด/รีเฟรช และไว้ใช้ตรวจถ้าหมดเวลา */
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

  const result = saveAnswers(payload.email, body.answers);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  return NextResponse.json({ ok: true, savedAt: Date.now() });
}
