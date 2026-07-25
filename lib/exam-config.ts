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
    correct: "ทำดีแล้ว — ข้อแจกคะแนนแบบนี้เก็บให้เร็วขึ้นอีกนิด เผื่อเวลาให้ข้อยาก",
    wrong: "ข้อง่ายที่ควรทำได้ — ดูเฉลยแล้วฝึกแนวนี้ซ้ำให้แม่น",
  },
  medium: {
    correct: "เยี่ยม พื้นฐานแน่น — ข้อระดับกลางคือตัวตัดสินคะแนน",
    wrong: "ยังไม่แม่นแนวนี้ — อ่านเฉลยแล้วฝึกโจทย์แนวเดียวกันอีก 2–3 ข้อ",
  },
  hard: {
    correct: "เก่งมาก! ข้อยากระดับนี้คนทำถูกไม่เยอะ",
    wrong: "ไม่เป็นไร ข้อนี้ยากจริง — ดูเฉลยเก็บไว้ รอบหน้าค่อยเก็บ",
  },
};

export function adviceFor(difficulty: Difficulty, correct: boolean): string {
  return ADVICE[difficulty][correct ? "correct" : "wrong"];
}

/** ปัดคะแนนเป็นทศนิยม 2 ตำแหน่ง (น้ำหนักแบบ 4/3 ทำให้เกิดเศษ .33/.67) */
export function roundScore(v: number): number {
  return Math.round(v * 100) / 100;
}
