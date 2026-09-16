import { describe, it, expect, beforeEach, vi } from "vitest";

const SECURE_SECRET = "b".repeat(64);

/** โหลดโมดูลใหม่ทุกครั้งด้วย env ที่กำหนด (config อ่าน env ตอน import) */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const session = await import("@/lib/user-session");
  const download = await import("@/lib/download-token");
  return { ...session, ...download };
}

const user = { email: "Som@Example.com", name: "สมชาย ใจดี", picture: "https://x/y.png" };

describe("user-session", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("roundtrip: คุกกี้ที่ออกแล้ว verify ได้ อีเมลถูกแปลงเป็นตัวเล็ก", async () => {
    const m = await load({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET });
    const { value, maxAge } = m.createUserSession(user);
    expect(maxAge).toBe(m.SESSION_DAYS * 86400);
    expect(m.verifyUserSession(value)).toEqual({
      email: "som@example.com",
      name: "สมชาย ใจดี",
      picture: "https://x/y.png",
    });
  });

  it("แก้ลายเซ็น/เนื้อคุกกี้ → ใช้ไม่ได้", async () => {
    const m = await load({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET });
    const { value } = m.createUserSession(user);
    const [body, sig] = value.split(".");
    expect(m.verifyUserSession(`${body}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(m.verifyUserSession(`${body}x.${sig}`)).toBeNull();
    expect(m.verifyUserSession("")).toBeNull();
    expect(m.verifyUserSession(undefined)).toBeNull();
  });

  it("หมดอายุแล้ว → ใช้ไม่ได้", async () => {
    const m = await load({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET });
    const { value } = m.createUserSession(user, 1_000);
    expect(m.verifyUserSession(value, 1_000 + 1)).not.toBeNull();
    expect(m.verifyUserSession(value, 1_000 + m.SESSION_DAYS * 86400 * 1000 + 1)).toBeNull();
  });

  it("เอาโทเค็นดาวน์โหลด (secret เดียวกัน) มาสวมเป็นคุกกี้ล็อกอินไม่ได้", async () => {
    const m = await load({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET });
    const dl = m.createDownloadToken({
      orderId: "o1",
      firstName: "a",
      lastName: "b",
      email: "victim@example.com",
      files: ["questions"],
    });
    expect(m.verifyUserSession(dl)).toBeNull();
  });

  it("secret ไม่ปลอดภัยนอก dev → ออกคุกกี้ไม่ได้ และคุกกี้เดิมใช้ไม่ได้", async () => {
    const m = await load({ NODE_ENV: "production", DOWNLOAD_SECRET: "short" });
    expect(() => m.createUserSession(user)).toThrow();
    expect(m.verifyUserSession("anything.sig")).toBeNull();
  });

  it("safeNextPath: รับเฉพาะ path ภายในเว็บ", async () => {
    const m = await load({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET });
    expect(m.safeNextPath("/exam")).toBe("/exam");
    expect(m.safeNextPath("/?buy=mock1")).toBe("/?buy=mock1");
    expect(m.safeNextPath("https://evil.com")).toBe("/my-courses");
    expect(m.safeNextPath("//evil.com")).toBe("/my-courses");
    expect(m.safeNextPath("/\\evil.com")).toBe("/my-courses");
    expect(m.safeNextPath("/a\r\nLocation: x")).toBe("/my-courses");
    expect(m.safeNextPath(null, "/")).toBe("/");
  });
});
