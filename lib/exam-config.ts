/**
 * ค่ากลางของระบบทำข้อสอบที่ "ใช้ร่วมกันทุกสนามสอบ"
 * (นิยามรายสนาม — จำนวนข้อ เวลา น้ำหนักคะแนน ฯลฯ — อยู่ที่ lib/exams.ts)
 *
 * import ได้ทั้ง client และ server — ห้ามมีเฉลย/ของลับในไฟล์นี้
 */

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
 * (ปรับถ้อยคำได้ที่นี่ที่เดียว หน้าเว็บและรายงานใช้ชุดเดียวกันทุกสนามสอบ)
 */
export const ADVICE: Record<Difficulty, { correct: string; wrong: string }> = {
  easy: {
    correct: "ดีแล้ว ข้อแจกคะแนน เก็บให้เร็วขึ้นอีกนิด",
    wrong: "ข้อง่ายที่ควรได้ ดูเฉลยแล้วฝึกซ้ำ",
  },
  medium: {
    correct: "เยี่ยม พื้นฐานแน่น",
    wrong: "ยังไม่แม่น ดูเฉลยแล้วฝึกแนวนี้อีก 2–3 ข้อ",
  },
  hard: {
    correct: "เก่งมาก ข้อนี้คนทำถูกไม่เยอะ",
    wrong: "ข้อนี้ยากจริง ดูเฉลยเก็บไว้",
  },
};

export function adviceFor(difficulty: Difficulty, correct: boolean): string {
  return ADVICE[difficulty][correct ? "correct" : "wrong"];
}

/** ปัดคะแนนเป็นทศนิยม 2 ตำแหน่ง (น้ำหนักแบบ 4/3 ทำให้เกิดเศษ .33/.67) */
export function roundScore(v: number): number {
  return Math.round(v * 100) / 100;
}
