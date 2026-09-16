import { describe, it, expect } from "vitest";
import { ownsProduct, ownedFiles, LibraryItem } from "@/lib/library";
import { PRODUCTS } from "@/lib/catalog";
import { splitName } from "@/lib/name";

const base = { orderId: "o", purchasedAt: "2026-09-16T00:00:00Z", firstName: "a", lastName: "b", email: "e@x.com" };

describe("library", () => {
  it("ซื้อ Mock อย่างเดียว → มี mock1 ไม่มี sum4/bundle", () => {
    const items: LibraryItem[] = [
      { ...base, productId: "mock1", productName: "", files: PRODUCTS.mock1.files },
    ];
    expect(ownsProduct(items, PRODUCTS.mock1)).toBe(true);
    expect(ownsProduct(items, PRODUCTS.sum4)).toBe(false);
    expect(ownsProduct(items, PRODUCTS["bundle-all"])).toBe(false);
  });

  it("ซื้อ Mock + เนื้อหาแยกกัน 2 ออเดอร์ → นับว่ามีครบเซ็ตแล้ว", () => {
    const items: LibraryItem[] = [
      { ...base, productId: "mock1", productName: "", files: PRODUCTS.mock1.files },
      { ...base, productId: "sum4", productName: "", files: PRODUCTS.sum4.files },
    ];
    expect(ownsProduct(items, PRODUCTS["bundle-all"])).toBe(true);
    expect([...ownedFiles(items)].sort()).toEqual(
      ["questions", "answers", "answersheet", "tpat3content"].sort()
    );
  });

  it("ออเดอร์ sum4 รุ่นเก่า (ไฟล์ sum4content/formula) ไม่นับว่ามีเล่มเนื้อหาใหม่", () => {
    const items: LibraryItem[] = [
      { ...base, productId: "sum4", productName: "", files: ["sum4content", "sum4formula"] },
    ];
    expect(ownsProduct(items, PRODUCTS.sum4)).toBe(false);
  });
});

describe("splitName", () => {
  it("แยกชื่อ-นามสกุลจากชื่อบัญชี Google", () => {
    expect(splitName("สมชาย ใจดี")).toEqual({ firstName: "สมชาย", lastName: "ใจดี" });
    expect(splitName("  Mako  Supawat  ")).toEqual({ firstName: "Mako", lastName: "Supawat" });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
});
