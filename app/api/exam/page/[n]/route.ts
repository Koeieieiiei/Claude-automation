import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getExam } from "@/lib/exams";
import { getAttemptState, getExamPageImage } from "@/lib/exam-store";

export const runtime = "nodejs";

/**
 * เสิร์ฟรูปหน้าโจทย์ (PNG ที่ generate จากไฟล์ต้นฉบับ) — เป็นสินค้าที่ขาย จึงต้องเช็คสิทธิ์:
 *   หน้าคำชี้แจง → มีโทเค็นถูกต้องก็พอ (โชว์ก่อนกดเริ่มได้)
 *   หน้าโจทย์ → ต้อง "กำลังสอบอยู่" หรือ "ส่งแล้ว" เท่านั้น
 *     (กันคนเปิดดูโจทย์ก่อนกดเริ่มจับเวลา)
 * สนามสอบอ่านจากโทเค็น — รูปของแต่ละสนามแยกโฟลเดอร์กัน
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ n: string }> }
) {
  const { n } = await params;
  const pageNo = Number(n);

  const payload = verifyExamToken(req.nextUrl.searchParams.get("token") ?? "");
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const exam = getExam(payload.examId);

  const isInstruction = exam.instructionPages.includes(pageNo);
  const isQuestion = exam.questionPages.includes(pageNo);
  if (!isInstruction && !isQuestion) {
    return NextResponse.json({ error: "ไม่พบหน้านี้" }, { status: 404 });
  }

  try {
    if (isQuestion) {
      const { state } = await getAttemptState(exam, payload.email);
      if (state !== "in_progress" && state !== "submitted") {
        return NextResponse.json({ error: "ต้องกดเริ่มทำข้อสอบก่อน" }, { status: 403 });
      }
    }

    const bytes = await getExamPageImage(exam, pageNo);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        // cache ในเครื่องผู้สอบได้ (ลดโหลดระหว่าง scroll) แต่ห้าม cache ร่วมกับคนอื่น
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`เสิร์ฟรูปหน้าโจทย์หน้า ${pageNo} (${exam.id}) ไม่สำเร็จ:`, err);
    return NextResponse.json({ error: "โหลดโจทย์ไม่สำเร็จ" }, { status: 503 });
  }
}
