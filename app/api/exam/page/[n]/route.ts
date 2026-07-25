import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getAttemptState } from "@/lib/exam-store";
import { EXAM } from "@/lib/exam-config";

export const runtime = "nodejs";

/**
 * เสิร์ฟรูปหน้าโจทย์ (PNG ที่ generate จากไฟล์ต้นฉบับ) — เป็นสินค้าที่ขาย จึงต้องเช็คสิทธิ์:
 *   หน้าคำชี้แจง (2-3) → มีโทเค็นถูกต้องก็พอ (โชว์ก่อนกดเริ่มได้)
 *   หน้าโจทย์ (4 เป็นต้นไป) → ต้อง "กำลังสอบอยู่" หรือ "ส่งแล้ว" เท่านั้น
 *     (กันคนเปิดดูโจทย์ก่อนกดเริ่มจับเวลา)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ n: string }> }
) {
  const { n } = await params;
  const pageNo = Number(n);
  const isInstruction = EXAM.instructionPages.includes(pageNo);
  const isQuestion = EXAM.questionPages.includes(pageNo);
  if (!isInstruction && !isQuestion) {
    return NextResponse.json({ error: "ไม่พบหน้านี้" }, { status: 404 });
  }

  const payload = verifyExamToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  if (isQuestion) {
    const { state } = getAttemptState(payload.email);
    if (state !== "in_progress" && state !== "submitted") {
      return NextResponse.json({ error: "ต้องกดเริ่มทำข้อสอบก่อน" }, { status: 403 });
    }
  }

  const file = path.join(
    process.cwd(),
    "assets",
    "exam-pages",
    `page-${String(pageNo).padStart(2, "0")}.png`
  );
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(file);
  } catch {
    return NextResponse.json(
      { error: "ไม่พบรูปหน้าโจทย์ — รัน `python scripts/build-exam-assets.py` ก่อน" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // cache ในเครื่องผู้สอบได้ (ลดโหลดระหว่าง scroll) แต่ห้าม cache ร่วมกับคนอื่น
      "Cache-Control": "private, max-age=3600",
    },
  });
}
