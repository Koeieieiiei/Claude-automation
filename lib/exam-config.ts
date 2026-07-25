/**
 * ข้อมูลกลางของระบบ "ทำข้อสอบออนไลน์" ฝั่งที่ไม่เป็นความลับ
 *
 * import ได้ทั้ง client และ server — ห้ามมีเฉลย/ความยากรายข้อในไฟล์นี้เด็ดขาด
 * (เฉลยอยู่ใน data/exam/answer-key.json อ่านได้เฉพาะฝั่ง server ผ่าน lib/exam-store.ts)
 *
 * ตัวเลขตำแหน่งข้อ/หน้ามาจาก lib/exam-manifest.json ซึ่ง generate โดย
 * scripts/build-exam-assets.py — แก้ไฟล์โจทย์เมื่อไหร่ให้รันสคริปต์นั้นใหม่
 */
import manifest from "./exam-manifest.json";

export interface ExamSection {
  no: number;
  title: string;
  from: number;
  to: number;
}

export interface ExamQuestionPos {
  no: number;
  page: number; // เลขหน้า PDF (1-based) ที่ข้อนี้เริ่ม
  yFrac: number; // ตำแหน่งแนวตั้งในหน้า (0-1) ไว้เลื่อน scroll ไปหาข้อ
}

export const EXAM = {
  totalQuestions: manifest.totalQuestions as number,
  choices: manifest.choices as number,
  durationMinutes: manifest.durationMinutes as number,
  maxScore: manifest.maxScore as number,
  instructionPages: manifest.instructionPages as number[],
  questionPages: manifest.questionPages as number[],
  pageWidth: manifest.pageWidth as number,
  pageHeight: manifest.pageHeight as number,
  sections: manifest.sections as ExamSection[],
  questions: manifest.questions as ExamQuestionPos[],
};

/** เวลาผ่อนผันหลังหมดเวลา (เผื่อเน็ตช้าตอนกดส่ง) — ฝั่ง server ใช้ตัดสิทธิ์ */
export const GRACE_MS = 2 * 60 * 1000;

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "ง่าย",
  medium: "กลาง",
  hard: "ยาก",
};

/**
 * คำแนะนำรายข้อ 6 แบบ — แยกตาม ความยาก × ตอบถูก/ผิด
 * (ปรับถ้อยคำได้ที่นี่ที่เดียว หน้าเว็บและรายงานใช้ชุดเดียวกัน)
 */
export const ADVICE: Record<Difficulty, { correct: string; wrong: string }> = {
  easy: {
    correct: "ทำดีแล้ว ข้อแจกคะแนนแบบนี้ห้ามพลาด — ฝึกให้เร็วขึ้นอีกนิด จะได้เผื่อเวลาให้ข้อยาก",
    wrong:
      "ข้อนี้เป็นข้อง่ายที่ควรทำได้ เสียคะแนนตรงนี้น่าเสียดายที่สุด — กลับไปดูเฉลยละเอียดแล้วฝึกแนวนี้ซ้ำให้แม่น",
  },
  medium: {
    correct: "เยี่ยมมาก ข้อระดับกลางคือตัวตัดสินคะแนนสอบจริง เก็บได้แบบนี้แสดงว่าพื้นฐานแน่น",
    wrong:
      "ยังไม่แม่นแนวนี้ — อ่านเฉลยละเอียดแล้วลองทำโจทย์แนวเดียวกันอีก 2–3 ข้อ ข้อระดับกลางเก็บเพิ่มได้อีกเยอะ",
  },
  hard: {
    correct: "เก่งมาก! ข้อยากระดับนี้คนทำถูกไม่เยอะ คุณมีโอกาสทำคะแนนได้สูงกว่าค่าเฉลี่ยมาก",
    wrong: "ไม่เป็นไร ข้อนี้ยากจริง คนส่วนใหญ่ก็พลาด — ดูเฉลยเก็บไว้เป็นไอเดีย รอบหน้าค่อยเก็บข้อแบบนี้",
  },
};

export function adviceFor(difficulty: Difficulty, correct: boolean): string {
  return ADVICE[difficulty][correct ? "correct" : "wrong"];
}

/** หา "ตอน" (บท) ของข้อที่กำหนด */
export function sectionOf(no: number): ExamSection {
  return EXAM.sections.find((s) => no >= s.from && no <= s.to) ?? EXAM.sections[0];
}

/**
 * น้ำหนักคะแนนรายข้อ (คะแนนเต็ม 100 ตามสเปกเจ้าของร้าน):
 * ข้อ 1-60 ข้อละ 4/3 คะแนน (รวม 80) · ข้อ 61-70 ข้อละ 2 คะแนน (รวม 20)
 * — ต้องตรงกับ question_weight ใน scripts/build-exam-assets.py (ประชากรจำลองใช้สูตรเดียวกัน)
 */
export function questionWeight(no: number): number {
  return no <= 60 ? 4 / 3 : 2;
}

/** ปัดคะแนนเป็นทศนิยม 2 ตำแหน่ง (น้ำหนัก 4/3 ทำให้เกิดเศษ .33/.67) */
export function roundScore(v: number): number {
  return Math.round(v * 100) / 100;
}
