import { describe, it, expect } from "vitest";
import { formatExpiry } from "@/lib/format-expiry";

describe("formatExpiry", () => {
  it("0 หรือค่าติดลบ = ไม่มีวันหมดอายุ (คืน null)", () => {
    expect(formatExpiry(0)).toBeNull();
    expect(formatExpiry(-1)).toBeNull();
    expect(formatExpiry(NaN)).toBeNull();
  });

  it("หารด้วย 720 ลงตัว → บอกเป็นเดือน", () => {
    expect(formatExpiry(2160)).toBe("3 เดือน"); // ค่าที่ร้านใช้อยู่
    expect(formatExpiry(720)).toBe("1 เดือน");
  });

  it("หารด้วย 24 ลงตัว (แต่ไม่ครบเดือน) → บอกเป็นวัน", () => {
    expect(formatExpiry(168)).toBe("7 วัน");
    expect(formatExpiry(24)).toBe("1 วัน");
  });

  it("เศษชั่วโมง → บอกเป็นชั่วโมง", () => {
    expect(formatExpiry(5)).toBe("5 ชั่วโมง");
    expect(formatExpiry(100)).toBe("100 ชั่วโมง");
  });
});
