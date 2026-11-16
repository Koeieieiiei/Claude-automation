import { describe, expect, it } from "vitest";
import { PRODUCTS, ProductId, bundleSaving, isPurchasableProduct } from "@/lib/catalog";
import { COURSES, courseForProduct } from "@/lib/courses";
import { examsForFiles } from "@/lib/exams";

/** ราคาตามที่เจ้าของกำหนด 2026-11-16 (ตารางในรูปที่ส่งมา) */
describe("ราคาสินค้าใหม่ + Bundle", () => {
  it("ราคาเดี่ยว", () => {
    expect(PRODUCTS.mock1.price).toBe(199);
    expect(PRODUCTS["mock-phys1"].price).toBe(149);
    expect(PRODUCTS["drill-tpat3"].price).toBe(399);
    expect(PRODUCTS["drill-phys"].price).toBe(299);
  });

  it.each([
    ["bundle-tpat3", 598, 499, 99, 17],
    ["bundle-phys", 448, 379, 69, 15],
    ["bundle-engineer", 1046, 799, 247, 24],
  ] as const)("%s: ซื้อแยก %i → %i ประหยัด %i (%i%)", (id, compareAt, price, amount, percent) => {
    const p = PRODUCTS[id];
    expect(p.price).toBe(price);
    expect(p.compareAt).toBe(compareAt);
    // ราคาซื้อแยก = ผลรวมราคาสินค้าย่อยจริง
    expect(p.bundleOf!.reduce((s, c) => s + PRODUCTS[c].price, 0)).toBe(compareAt);
    expect(bundleSaving(p)).toEqual({ amount, percent });
    expect(isPurchasableProduct(id)).toBe(true);
  });

  it("ไฟล์ของ bundle = ไฟล์ของสินค้าย่อยรวมกันพอดี", () => {
    for (const p of Object.values(PRODUCTS)) {
      if (!p.bundleOf) continue;
      const fromParts = new Set(p.bundleOf.flatMap((c) => PRODUCTS[c].files));
      expect(new Set(p.files)).toEqual(fromParts);
    }
  });

  it("แพ็คสอบติดวิศวะให้สิทธิ์ห้องสอบทั้ง 2 วิชา", () => {
    expect(examsForFiles(PRODUCTS["bundle-engineer"].files).map((e) => e.id).sort()).toEqual(["phys-1", "tpat3-1"]);
    expect(examsForFiles(PRODUCTS["bundle-tpat3"].files).map((e) => e.id)).toEqual(["tpat3-1"]);
    expect(examsForFiles(PRODUCTS["bundle-phys"].files).map((e) => e.id)).toEqual(["phys-1"]);
  });

  it("สินค้าที่ขายอยู่ทุกตัวมีหน้ารายละเอียดคอร์ส", () => {
    for (const p of Object.values(PRODUCTS)) {
      if (p.retired) continue;
      expect(courseForProduct(p.id as ProductId), p.id).not.toBeNull();
    }
    expect(new Set(COURSES.map((c) => c.slug)).size).toBe(COURSES.length);
  });
});
