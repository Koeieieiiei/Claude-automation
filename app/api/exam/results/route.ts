import { NextRequest, NextResponse } from "next/server";
import { verifyExamToken } from "@/lib/exam-token";
import { getAttemptState, getAnswerKey, computeStatistics } from "@/lib/exam-store";
import {
  EXAM,
  adviceFor,
  scaledScore,
  sectionOf,
  DIFFICULTY_LABEL,
} from "@/lib/exam-config";
import { PRODUCTS } from "@/lib/catalog";
import { buildDownloadLinks } from "@/lib/downloads";

export const runtime = "nodejs";

/**
 * ผลสอบ + บทวิเคราะห์ทั้งหมด — ให้เฉพาะคนที่ "ส่งข้อสอบแล้ว" เท่านั้น
 * (เฉลยรายข้อจึงเพิ่งหลุดจาก server ที่จุดนี้จุดเดียว)
 *
 * ท้ายผลวิเคราะห์แนบลิงก์ดาวน์โหลดไฟล์โจทย์ + ไฟล์เฉลย (ใส่ลายน้ำผู้ซื้อตามระบบเดิม)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const payload = verifyExamToken(token);
  if (!payload) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ดูผลสอบ" }, { status: 403 });
  }

  const { state, attempt } = getAttemptState(payload.email);
  if (state !== "submitted" || !attempt || attempt.correctCount === null) {
    return NextResponse.json(
      { error: "ยังไม่มีผลสอบของอีเมลนี้ — ต้องทำข้อสอบและกดส่งก่อน" },
      { status: 409 }
    );
  }

  const key = getAnswerKey();
  const stats = computeStatistics(attempt.correctCount);
  const toScaled = (raw: number) =>
    Math.round((raw * EXAM.maxScore * 10) / EXAM.totalQuestions) / 10;

  // วิเคราะห์รายข้อ: บท (ตอน) / คำตอบ / ถูก-ผิด / ความยาก / % คนตอบถูก / คำแนะนำ (6 แบบ)
  const questions = Array.from({ length: EXAM.totalQuestions }, (_, i) => {
    const no = i + 1;
    const k = key[String(no)];
    const my = attempt.answers[i];
    const correct = my === k.answer;
    return {
      no,
      section: sectionOf(no).no,
      myAnswer: my, // 0 = ไม่ได้ตอบ
      correctAnswer: k.answer,
      correct,
      difficulty: k.difficulty,
      difficultyLabel: DIFFICULTY_LABEL[k.difficulty],
      pctCorrect: stats.perQuestionPctCorrect[String(no)],
      advice: adviceFor(k.difficulty, correct),
    };
  });

  const sections = EXAM.sections.map((s) => {
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

  // ไฟล์โจทย์ + เฉลยแนบท้ายผล — ใช้ระบบลิงก์ดาวน์โหลด (ลายน้ำ) ตัวเดิมของร้าน
  const downloads = buildDownloadLinks({
    id: attempt.orderId,
    firstName: attempt.firstName,
    lastName: attempt.lastName,
    email: attempt.email,
    product: { ...PRODUCTS.mock1, files: ["questions", "answers"] },
  });

  return NextResponse.json({
    student: {
      firstName: attempt.firstName,
      lastName: attempt.lastName,
      email: attempt.email,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
    },
    score: {
      correctCount: attempt.correctCount,
      totalQuestions: EXAM.totalQuestions,
      scaled: scaledScore(attempt.correctCount),
      maxScore: EXAM.maxScore,
      answered: attempt.answers.filter((a) => a > 0).length,
    },
    overall: {
      nTotal: stats.nTotal,
      rank: stats.rank,
      mean: toScaled(stats.meanRaw),
      sd: toScaled(stats.sdRaw),
      min: toScaled(stats.minRaw),
      max: toScaled(stats.maxRaw),
      histogram: stats.histogram,
    },
    sections,
    questions,
    downloads,
  });
}
