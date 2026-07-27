import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { EXAMS } from "@/lib/exams";
import { createExamToken } from "@/lib/exam-token";
import {
  startAttempt,
  saveAnswers,
  submitAttempt,
  getAttempt,
  deleteAttempt,
} from "@/lib/exam-store";
import { GET as getResults } from "@/app/api/exam/results/route";

/**
 * กันบั๊ก "ส่งข้อสอบแล้วหน้าผลบอกว่ายังไม่มีผลสอบ" ไม่ให้กลับมาอีก (เกิดจริง 2026-07-26)
 *
 * เทสต์ชุดนี้ไม่ได้ตั้งค่า Supabase → lib/exam-store ใช้โหมดไฟล์ในเครื่อง
 * และไม่ได้ตั้ง DOWNLOAD_SECRET → ระบบถือว่า secret ไม่ปลอดภัย ซึ่งเป็นเงื่อนไข
 * เดียวกับที่เคยทำให้หน้าผลสอบล่มทั้งหน้า
 */

const exam = EXAMS["tpat3-1"];
const EMAIL = "vitest-exam-results@example.com";
const buyer = { email: EMAIL, firstName: "ทดสอบ", lastName: "ระบบ", orderId: "vitest-order" };

const answers = () => Array.from({ length: exam.totalQuestions }, (_, i) => (i % 5) + 1);

beforeEach(async () => {
  await deleteAttempt(exam, EMAIL);
});
afterEach(async () => {
  await deleteAttempt(exam, EMAIL);
});

describe("ผลสอบที่ส่งแล้วต้องไม่ถูกลบล้าง", () => {
  it("autosave ที่มาถึงหลังกดส่ง ต้องไม่ทำให้กลับไปเป็น 'ยังไม่ส่ง'", async () => {
    await startAttempt(exam, buyer);
    const submitted = await submitAttempt(exam, EMAIL, answers());
    expect(submitted.submittedAt).toBeTruthy();

    // คำขอ autosave ที่ค้างอยู่ตั้งแต่ก่อนกดส่ง เพิ่งมาถึง server
    const late = await saveAnswers(exam, EMAIL, answers());
    expect(late.ok).toBe(false);

    const after = await getAttempt(exam, EMAIL);
    expect(after?.submittedAt).toBe(submitted.submittedAt);
    expect(after?.score).toBe(submitted.score);
  });

  it("กดส่งซ้ำ ได้ผลเดิมเป๊ะ ไม่ตรวจใหม่", async () => {
    await startAttempt(exam, buyer);
    const first = await submitAttempt(exam, EMAIL, answers());
    const again = await submitAttempt(exam, EMAIL, Array(exam.totalQuestions).fill(1));
    expect(again.submittedAt).toBe(first.submittedAt);
    expect(again.score).toBe(first.score);
    expect(again.correctCount).toBe(first.correctCount);
  });
});

describe("API ผลสอบ", () => {
  const tokenFor = () =>
    createExamToken({
      examId: exam.id,
      email: EMAIL,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      orderId: buyer.orderId,
    });

  const call = (token: string) =>
    getResults(
      new NextRequest(`http://localhost/api/exam/results?token=${encodeURIComponent(token)}`)
    );

  it("ตั้ง DOWNLOAD_SECRET ไม่ปลอดภัย → ยังต้องเห็นคะแนนและบทวิเคราะห์ (แค่ไม่มีไฟล์แนบ)", async () => {
    await startAttempt(exam, buyer);
    const submitted = await submitAttempt(exam, EMAIL, answers());

    const res = await call(tokenFor());
    expect(res.status).toBe(200); // ห้ามล่มทั้งหน้าเพราะสร้างลิงก์ดาวน์โหลดไม่ได้
    const data = await res.json();
    expect(data.score.correctCount).toBe(submitted.correctCount);
    expect(data.score.scaled).toBe(submitted.score);
    expect(data.questions).toHaveLength(exam.totalQuestions);
    expect(data.downloads).toEqual([]); // ลิงก์สร้างไม่ได้ ก็แค่ไม่มี ไม่ใช่ error
  });

  it("ยังไม่ได้ส่งข้อสอบ → ตอบ 409 ตามเดิม", async () => {
    await startAttempt(exam, buyer);
    const res = await call(tokenFor());
    expect(res.status).toBe(409);
  });
});
