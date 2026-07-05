import { describe, it, expect, vi } from "vitest";

async function loadRoute() {
  vi.resetModules();
  // ไม่ตั้งค่า Google Sheets → logVisit จะเป็น no-op (mock) ไม่เรียก service จริง
  delete process.env.GOOGLE_SHEETS_ID;
  return import("@/app/api/track/route");
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  }) as never; // route รับ NextRequest; Request มี .json()/.headers ครบพอสำหรับเทส
}

describe("POST /api/track", () => {
  it("รับ path ปกติ → 200 ok", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ path: "/", referrer: "https://google.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("รับ path เป็นตัวเลข (ชนิดผิด) → 200 ไม่ crash (กัน regression .slice)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(postReq({ path: 123, referrer: {} }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("body ว่าง/ไม่ใช่ JSON → 200 ไม่ crash", async () => {
    const { POST } = await loadRoute();
    const bad = new Request("http://localhost/api/track", { method: "POST", body: "not-json" }) as never;
    const res = await POST(bad);
    expect(res.status).toBe(200);
  });
});
