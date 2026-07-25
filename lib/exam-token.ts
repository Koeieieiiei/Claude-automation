import { createHmac, timingSafeEqual } from "crypto";
import { config } from "./config";
import { DEFAULT_EXAM_ID } from "./exams";

/**
 * โทเค็นสิทธิ์ทำข้อสอบ — เซ็น HMAC ด้วย secret เดียวกับลิงก์ดาวน์โหลด
 * แต่ฝัง type "exam" กันเอาโทเค็นดาวน์โหลดมาสวมสิทธิ์ทำข้อสอบ (และกลับกัน)
 *
 * โทเค็นบอกแค่ "อีเมลนี้มีสิทธิ์เข้าห้องสอบสนามไหน" — ส่วนสถานะว่าเริ่มหรือส่งไปแล้ว
 * เก็บฝั่ง server (lib/exam-store.ts) เพื่อบังคับกติกา 1 อีเมลทำได้ 1 รอบต่อสนาม
 */
export interface ExamTokenPayload {
  t: "exam";
  /**
   * รหัสสนามสอบ (ดู lib/exams.ts) — โทเค็นรุ่นแรกออกก่อนมีหลายสนามจึงไม่มี field นี้
   * ฝั่งตรวจถือว่าเป็นสนามหลัก (TPAT3) เพื่อให้ลิงก์/เครื่องของลูกค้าเดิมใช้ได้ต่อ
   */
  examId?: string;
  email: string;
  firstName: string;
  lastName: string;
  orderId: string;
  exp: number; // unix ms
}

const EXAM_TOKEN_DAYS = 90; // สิทธิ์เข้าห้องสอบอยู่ได้นานแค่ไหนนับจากออกโทเค็น

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", config.download.secret).update(data).digest());
}

export function createExamToken(
  payload: Omit<ExamTokenPayload, "t" | "exp">
): string {
  const full: ExamTokenPayload = {
    t: "exam",
    ...payload,
    examId: payload.examId ?? DEFAULT_EXAM_ID,
    email: payload.email.trim().toLowerCase(),
    exp: Date.now() + EXAM_TOKEN_DAYS * 24 * 3600 * 1000,
  };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  return `${body}.${sign(body)}`;
}

export function verifyExamToken(token: string): (ExamTokenPayload & { examId: string }) | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(body).toString()) as ExamTokenPayload;
    if (payload.t !== "exam") return null;
    if (Date.now() > payload.exp) return null;
    // โทเค็นรุ่นเก่าไม่มี examId → สนามหลัก (ตอนนั้นมีสนามเดียวคือ TPAT3)
    return { ...payload, examId: payload.examId ?? DEFAULT_EXAM_ID };
  } catch {
    return null;
  }
}
