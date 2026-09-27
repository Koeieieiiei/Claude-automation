import { describe, it, expect } from "vitest";
import { gaWindow } from "@/lib/ga";

/**
 * "รีเซ็ตหน้าแอดมินเป็นศูนย์" = เริ่มนับใหม่ตั้งแต่เวลาที่กำหนด (lib/admin-reset.ts)
 * ฝั่ง Google Analytics ตัดได้ละเอียดสุดระดับชั่วโมง — ต้องตัดชั่วโมงก่อนจุดเริ่มนับของวันแรกทิ้งให้ครบ
 */

const RESET = Date.parse("2026-09-27T13:00:00Z"); // 20:00 น. เวลาไทย
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("gaWindow", () => {
  it("ไม่ได้รีเซ็ต → ย้อนหลังเต็ม 30 วัน ไม่ตัดชั่วโมงไหน", () => {
    const w = gaWindow(RESET + HOUR, 30, 0);
    expect(w).toEqual({ startDate: "2026-08-29", days: 30, excludedDateHours: [] });
  });

  it("วันเดียวกับที่รีเซ็ต → นับเฉพาะตั้งแต่ 20:00 น. (ตัดชั่วโมง 00 ถึง 19 ของวันนั้น)", () => {
    const w = gaWindow(RESET + HOUR, 30, RESET);
    expect(w.startDate).toBe("2026-09-27");
    expect(w.days).toBe(1);
    expect(w.excludedDateHours).toHaveLength(20);
    expect(w.excludedDateHours[0]).toBe("2026092700");
    expect(w.excludedDateHours[19]).toBe("2026092719");
  });

  it("ผ่านไป 3 วัน → ช่วงยาว 4 วัน ยังตัดเฉพาะชั่วโมงของวันแรก", () => {
    const w = gaWindow(RESET + 3 * DAY, 30, RESET);
    expect(w.startDate).toBe("2026-09-27");
    expect(w.days).toBe(4);
    expect(w.excludedDateHours).toHaveLength(20);
  });

  it("รีเซ็ตไม่ลงต้นชั่วโมง → เริ่มนับที่ต้นชั่วโมงถัดไป", () => {
    const w = gaWindow(RESET + DAY, 30, RESET + 10 * 60 * 1000); // 20:10 น.
    expect(w.excludedDateHours).toHaveLength(21);
    expect(w.excludedDateHours[20]).toBe("2026092720");
  });

  it("ยังไม่ถึงเวลารีเซ็ต → ไม่มีอะไรให้นับ", () => {
    expect(gaWindow(RESET - HOUR, 30, RESET).days).toBe(0);
  });

  it("รีเซ็ตนานเกิน 30 วันแล้ว → กลับไปย้อนหลัง 30 วันตามปกติ", () => {
    const w = gaWindow(RESET + 40 * DAY, 30, RESET);
    expect(w.days).toBe(30);
    expect(w.excludedDateHours).toEqual([]);
  });
});
