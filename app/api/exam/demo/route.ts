import { NextRequest, NextResponse } from "next/server";
import {
  grantDemoBuyer,
  removeDemoBuyer,
  listDemoBuyers,
  getAttempt,
  resetAttempt,
  startAttempt,
  submitAttempt,
  getAnswerKey,
  demoEnabled,
} from "@/lib/exam-store";
import { createExamToken } from "@/lib/exam-token";
import { EXAM, Difficulty } from "@/lib/exam-config";

export const runtime = "nodejs";

/**
 * เครื่องมือ "แบบจำลอง" สำหรับทดสอบระบบสอบโดยไม่ต้องจ่ายเงินจริง
 * ใช้ได้เฉพาะตอน dev ในเครื่อง (หรือ EXAM_DEMO=1) — บน production ตอบ 404 เสมอ
 */

/** จำลองฝีมือผู้สอบ 3 ระดับ — โอกาสตอบถูกแยกตามความยากข้อ */
const ABILITY: Record<string, Record<Difficulty, number>> = {
  weak: { easy: 0.45, medium: 0.28, hard: 0.18 },
  avg: { easy: 0.72, medium: 0.5, hard: 0.26 },
  strong: { easy: 0.93, medium: 0.78, hard: 0.55 },
};

export async function POST(req: NextRequest) {
  if (!demoEnabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: {
    action?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    ability?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();

  switch (body.action) {
    // สร้าง "ผู้ซื้อจำลอง" — เทียบเท่าลูกค้าที่จ่ายเงินสำเร็จแล้ว
    case "grant": {
      if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
      const buyer = grantDemoBuyer({
        email,
        firstName: body.firstName?.trim() || "นักเรียน",
        lastName: body.lastName?.trim() || "ทดสอบ",
      });
      return NextResponse.json({ ok: true, buyer, token: createExamToken(buyer) });
    }

    // ลบการสอบของอีเมล (คงสิทธิ์ผู้ซื้อไว้) — ไว้ทดสอบทำข้อสอบซ้ำ
    case "reset": {
      if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
      await resetAttempt(email);
      return NextResponse.json({ ok: true });
    }

    // ลบทั้งสิทธิ์และการสอบ
    case "revoke": {
      if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
      await resetAttempt(email);
      removeDemoBuyer(email);
      return NextResponse.json({ ok: true });
    }

    // จำลอง "สอบเสร็จทั้งชุด" ทันที (สุ่มคำตอบตามระดับฝีมือ) — ไว้ดูหน้าผลสอบเร็ว ๆ
    case "simulate": {
      if (!email) return NextResponse.json({ error: "กรุณากรอกอีเมล" }, { status: 400 });
      if (await getAttempt(email)) {
        return NextResponse.json(
          { error: "อีเมลนี้มีการสอบอยู่แล้ว — กด 'รีเซ็ตการสอบ' ก่อน" },
          { status: 409 }
        );
      }
      const buyer = grantDemoBuyer({
        email,
        firstName: body.firstName?.trim() || "นักเรียน",
        lastName: body.lastName?.trim() || "ทดสอบ",
      });
      await startAttempt(buyer);

      const probs = ABILITY[body.ability ?? "avg"] ?? ABILITY.avg;
      const key = await getAnswerKey();
      const answers = Array.from({ length: EXAM.totalQuestions }, (_, i) => {
        const k = key[String(i + 1)];
        if (Math.random() < probs[k.difficulty]) return k.answer;
        // ตอบผิด: สุ่มช้อยส์อื่นที่ไม่ใช่คำตอบถูก
        const wrong = [1, 2, 3, 4, 5].filter((c) => c !== k.answer);
        return wrong[Math.floor(Math.random() * wrong.length)];
      });
      const attempt = await submitAttempt(email, answers);
      return NextResponse.json({
        ok: true,
        token: createExamToken(buyer),
        correctCount: attempt.correctCount,
        scaled: attempt.score,
      });
    }

    // รายชื่อผู้ซื้อจำลอง + สถานะการสอบ (ไว้โชว์บนหน้า demo)
    case "list": {
      const buyers = await Promise.all(
        listDemoBuyers().map(async (b) => {
          const attempt = await getAttempt(b.email);
          return {
            ...b,
            attemptState: attempt ? (attempt.submittedAt ? "submitted" : "in_progress") : "none",
            correctCount: attempt?.correctCount ?? null,
          };
        })
      );
      return NextResponse.json({ buyers });
    }

    default:
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  }
}
