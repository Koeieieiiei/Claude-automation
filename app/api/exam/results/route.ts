import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getExam, sectionOf } from "@/lib/exams";
import { getAttemptState, getAnswerKey, computeStatistics } from "@/lib/exam-store";
import { adviceFor, DIFFICULTY_LABEL } from "@/lib/exam-config";
import { PRODUCTS } from "@/lib/catalog";
import { buildDownloadLinks } from "@/lib/downloads";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/**
 * ผลสอบ + บทวิเคราะห์ทั้งหมด — ให้เฉพาะคนที่ "ส่งข้อสอบแล้ว" เท่านั้น
 * (เฉลยรายข้อจึงเพิ่งหลุดจาก server ที่จุดนี้จุดเดียว) · สนามสอบอ่านจากโทเค็น
 *
 * ท้ายผลวิเคราะห์แนบลิงก์ดาวน์โหลดไฟล์ตามที่สนามนั้นกำหนด (ใส่ลายน้ำผู้ซื้อตามระบบเดิม)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const payload = verifyExamToken(token);
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูผลสอบ" }, { status: 403 });
  }
  const exam = getExam(payload.examId);

  try {
    const { state, attempt } = await getAttemptState(exam, payload.email);
    if (
      state !== "submitted" ||
      !attempt ||
      attempt.correctCount === null ||
      attempt.score === null
    ) {
      // บอกอีเมลที่กำลังตรวจไปด้วย — เดิมข้อความนี้เป็นทางตัน ผู้สอบไม่รู้ว่า
      // ระบบกำลังดูผลของใครอยู่ (เช่น เครื่องยังจำสิทธิ์ของอีเมลอื่นค้างไว้)
      return NextResponse.json(
        {
          error: `ยังไม่มีผลสอบของอีเมล ${payload.email} — ต้องทำข้อสอบและกดส่งก่อน`,
          email: payload.email,
          state,
        },
        { status: 409 }
      );
    }

    const [key, stats] = await Promise.all([
      getAnswerKey(exam),
      computeStatistics(exam, attempt.score),
    ]);

    // วิเคราะห์รายข้อ: บท (ตอน) / คำตอบ / ถูก-ผิด / ความยาก / % คนตอบถูก / คำแนะนำ (6 แบบ)
    const questions = Array.from({ length: exam.totalQuestions }, (_, i) => {
      const no = i + 1;
      const k = key[String(no)];
      const my = attempt.answers[i];
      const correct = my === k.answer;
      return {
        no,
        section: sectionOf(exam, no).no,
        myAnswer: my, // 0 = ไม่ได้ตอบ
        correctAnswer: k.answer,
        correct,
        difficulty: k.difficulty,
        difficultyLabel: DIFFICULTY_LABEL[k.difficulty],
        pctCorrect: stats.perQuestionPctCorrect[String(no)],
        advice: adviceFor(k.difficulty, correct),
      };
    });

    const sections = exam.sections.map((s) => {
      const qs = questions.filter((q) => q.section === s.no);
      return {
        no: s.no,
        title: s.title,
        from: s.from,
        to: s.to,
        total: qs.length,
        correct: qs.filter((q) => q.correct).length,
      };
    });

    // ไฟล์แนบท้ายผล — ใช้ระบบลิงก์ดาวน์โหลด (ลายน้ำ) ตัวเดิมของร้าน
    //
    // ⚠️ ห้ามให้ส่วนนี้ล้มทั้งหน้าผลสอบเด็ดขาด: การสร้างลิงก์ต้องใช้ DOWNLOAD_SECRET
    // ที่ปลอดภัย ถ้าตั้งค่าพลาดเมื่อไหร่ createDownloadToken จะ throw แล้วผู้สอบจะเห็น
    // หน้า error ทั้งที่ทำข้อสอบเสร็จและมีคะแนนอยู่แล้ว (เคยเกิดจริง 2026-07-26)
    // — คะแนนกับบทวิเคราะห์คือหัวใจของหน้านี้ ลิงก์แนบเป็นของเสริม ขาดได้
    let downloads: ReturnType<typeof buildDownloadLinks> = [];
    try {
      downloads = buildDownloadLinks({
        id: attempt.orderId,
        firstName: attempt.firstName,
        lastName: attempt.lastName,
        email: attempt.email,
        product: { ...PRODUCTS.mock1, files: exam.resultFiles },
      });
    } catch (err) {
      console.error(
        "สร้างลิงก์ดาวน์โหลดแนบท้ายผลสอบไม่สำเร็จ — แสดงผลสอบตามปกติแต่ไม่มีปุ่มโหลดไฟล์:",
        err
      );
    }

    return NextResponse.json({
      examId: exam.id,
      examTitle: exam.title,
      student: {
        firstName: attempt.firstName,
        lastName: attempt.lastName,
        email: attempt.email,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      },
      score: {
        correctCount: attempt.correctCount,
        totalQuestions: exam.totalQuestions,
        scaled: attempt.score, // คะแนนถ่วงน้ำหนักตามสเกลของสนาม
        maxScore: exam.maxScore,
        answered: attempt.answers.filter((a) => a > 0).length,
      },
      overall: {
        nTotal: stats.nTotal,
        rank: stats.rank,
        mean: stats.mean,
        sd: stats.sd,
        min: stats.min,
        max: stats.max,
        histogram: stats.histogram,
      },
      sections,
      questions,
      downloads,
      downloadExpiryHours: config.download.expiryHours, // 0 = ไม่มีวันหมดอายุ
    });
  } catch (err) {
    console.error("สร้างผลสอบไม่สำเร็จ:", err);
    return NextResponse.json(
      { error: "ระบบขัดข้องชั่วคราว กรุณารีเฟรชอีกครั้ง" },
      { status: 503 }
    );
  }
}
