import { describe, expect, it } from "vitest";
import {
  cleanNumericInput,
  countAnswered,
  emptyAnswers,
  isAnswered,
  isCorrectAnswer,
  isNumericQuestion,
  sanitizeAnswers,
} from "@/lib/exam-answers";
import { EXAMS, examsForFiles } from "@/lib/exams";

const tpat3 = EXAMS["tpat3-1"];
const phys = EXAMS["phys-1"];

describe("สนาม A-Level ฟิสิกส์ (phys-1)", () => {
  it("30 ข้อ 90 นาที เต็ม 100 (ข้อ 1-25 ×3 + 26-30 ×5)", () => {
    expect(phys.totalQuestions).toBe(30);
    expect(phys.durationMinutes).toBe(90);
    let total = 0;
    for (let q = 1; q <= 30; q++) total += phys.weights.find((w) => q >= w.from && q <= w.to)!.weight;
    expect(total).toBe(phys.maxScore);
    expect(phys.questions).toHaveLength(30);
  });

  it("ข้อ 26-30 เป็นข้อตอบตัวเลข มีหน่วยครบ", () => {
    expect(isNumericQuestion(phys, 25)).toBe(false);
    for (let q = 26; q <= 30; q++) {
      expect(isNumericQuestion(phys, q)).toBe(true);
      expect(phys.numericUnits?.[q]).toBeTruthy();
    }
    expect(isNumericQuestion(tpat3, 70)).toBe(false);
  });

  it("กระดาษคำตอบว่าง: ปรนัย 0 / ตัวเลข \"\"", () => {
    const a = emptyAnswers(phys);
    expect(a.slice(0, 25).every((v) => v === 0)).toBe(true);
    expect(a.slice(25).every((v) => v === "")).toBe(true);
    expect(emptyAnswers(tpat3).every((v) => v === 0)).toBe(true); // TPAT3 เหมือนเดิมทุกไบต์
  });
});

describe("ตรวจคำตอบ", () => {
  it("ข้อปรนัยเทียบเลขช้อยส์ตรง ๆ (แบบเดิม)", () => {
    expect(isCorrectAnswer(3, 3)).toBe(true);
    expect(isCorrectAnswer(2, 3)).toBe(false);
    expect(isCorrectAnswer(0, 3)).toBe(false);
  });

  it("ข้อตัวเลข: ปัดทศนิยมให้เท่าเฉลยแล้วต้องเท่ากัน", () => {
    expect(isCorrectAnswer("2.9", "2.9")).toBe(true);
    expect(isCorrectAnswer("2.90", "2.9")).toBe(true);
    expect(isCorrectAnswer("2.87", "2.9")).toBe(true);
    expect(isCorrectAnswer("2.8", "2.9")).toBe(false);
    expect(isCorrectAnswer("42", "42")).toBe(true);
    expect(isCorrectAnswer("41.6", "42")).toBe(true);
    expect(isCorrectAnswer("43", "42")).toBe(false);
    expect(isCorrectAnswer("0.10", "0.10")).toBe(true);
    expect(isCorrectAnswer("0.1", "0.10")).toBe(true);
    expect(isCorrectAnswer("0.098", "0.10")).toBe(true);
    expect(isCorrectAnswer("0.11", "0.10")).toBe(false);
    expect(isCorrectAnswer("1", "1.0")).toBe(true);
    expect(isCorrectAnswer("86", "86")).toBe(true);
  });

  it("ข้อตัวเลข: ว่าง/ไม่ครบ/ไม่ใช่ตัวเลข = ผิด", () => {
    expect(isCorrectAnswer("", "42")).toBe(false);
    expect(isCorrectAnswer("-", "42")).toBe(false);
    expect(isCorrectAnswer(".", "42")).toBe(false);
    expect(isCorrectAnswer(0, "42")).toBe(false);
  });

  it("นับข้อที่ตอบแล้วได้ทั้งสองแบบ", () => {
    expect(isAnswered(0)).toBe(false);
    expect(isAnswered(4)).toBe(true);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered("  ")).toBe(false);
    expect(isAnswered("0")).toBe(true); // ตอบ 0 เป็นคำตอบจริงได้
    expect(countAnswered([1, 0, "2.9", ""])).toBe(2);
  });
});

describe("รับคำตอบจากหน้าเว็บ (sanitizeAnswers)", () => {
  it("TPAT3: รับเหมือนเดิม และปฏิเสธช้อยส์เกิน", () => {
    const ok = Array(70).fill(0);
    ok[0] = 5;
    expect(sanitizeAnswers(tpat3, ok)).toEqual(ok);
    const bad = [...ok];
    bad[1] = 6;
    expect(sanitizeAnswers(tpat3, bad)).toBeNull();
    expect(sanitizeAnswers(tpat3, Array(69).fill(0))).toBeNull();
    const text = [...ok];
    text[3] = "2.9"; // ข้อปรนัยห้ามเป็นข้อความ
    expect(sanitizeAnswers(tpat3, text)).toBeNull();
  });

  it("ฟิสิกส์: ข้อตัวเลขรับข้อความตัวเลข ทำความสะอาดช่องว่าง/จุลภาค", () => {
    const raw: (number | string)[] = Array(30).fill(0);
    raw[0] = 4;
    raw[25] = " 2,9 ";
    raw[26] = 42; // ส่งมาเป็น number ก็รับ
    raw[27] = "";
    const out = sanitizeAnswers(phys, raw)!;
    expect(out[0]).toBe(4);
    expect(out[25]).toBe("2.9");
    expect(out[26]).toBe("42");
    expect(out[27]).toBe("");
    expect(out[29]).toBe(""); // 0 ของข้อตัวเลข = ยังไม่ตอบ
  });

  it("ฟิสิกส์: ข้อความที่ไม่ใช่ตัวเลข/ยาวเกิน ถูกปฏิเสธ", () => {
    const raw: (number | string)[] = Array(30).fill(0);
    raw[26] = "abc";
    expect(sanitizeAnswers(phys, raw)).toBeNull();
    raw[26] = "123456789012";
    expect(sanitizeAnswers(phys, raw)).toBeNull();
  });

  it("cleanNumericInput ระหว่างพิมพ์", () => {
    expect(cleanNumericInput("2.")).toBe("2.");
    expect(cleanNumericInput("-")).toBe("-");
    expect(cleanNumericInput("1,5")).toBe("1.5");
    expect(cleanNumericInput("1e3")).toBeNull();
    expect(cleanNumericInput("๑")).toBeNull();
  });
});

describe("สิทธิ์ห้องสอบจากไฟล์ของสินค้า", () => {
  it("Mock แต่ละวิชาให้สิทธิ์เฉพาะสนามของตัวเอง", () => {
    expect(examsForFiles(["questions", "answers"]).map((e) => e.id)).toEqual(["tpat3-1"]);
    expect(examsForFiles(["physQuestions", "physAnswers"]).map((e) => e.id)).toEqual(["phys-1"]);
    expect(examsForFiles(["tpat3Drill"])).toEqual([]);
  });
});
