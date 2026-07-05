import { describe, it, expect } from "vitest";
import { sanitizeCell } from "@/lib/sheets";

describe("sanitizeCell (กัน formula/CSV injection ใน Google Sheets)", () => {
  it.each([
    ["=IMPORTXML(...)", "'=IMPORTXML(...)"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=cmd", "'\t=cmd"],
    ["\r=cmd", "'\r=cmd"],
  ])("เติม ' นำหน้าเมื่อขึ้นต้นด้วยอักขระอันตราย: %s", (input, expected) => {
    expect(sanitizeCell(input)).toBe(expected);
  });

  it.each([
    "สมชาย ใจดี",
    "som@example.com", // อีเมลมี @ ตรงกลาง ไม่ใช่ต้นสตริง → ปล่อยผ่าน
    "/",
    "https://google.com",
    "",
  ])("ปล่อยผ่านสตริงปกติ: %s", (input) => {
    expect(sanitizeCell(input)).toBe(input);
  });

  it("ตัวเลขปล่อยผ่านตามเดิม (ไม่แปลงเป็นสตริง)", () => {
    expect(sanitizeCell(199)).toBe(199);
    expect(sanitizeCell(0)).toBe(0);
  });
});
