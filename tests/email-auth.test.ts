import { describe, it, expect, vi } from "vitest";

/**
 * ระบบบัญชีอีเมล+รหัสผ่าน (เปลี่ยนจาก Google 2026-09-26)
 * - lib/password.ts: hash/verify ด้วย scrypt
 * - lib/user-store.ts: สมัคร/ล็อกอิน/ตั้งรหัสใหม่ ในโหมด memory (ไม่มี Supabase)
 * - lib/password-reset-token.ts: โทเค็นลิงก์ตั้งรหัสผ่าน
 */
async function loadStore() {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  return import("@/lib/user-store");
}

describe("password hashing", () => {
  it("hash แล้วตรวจกลับได้ · รหัสผิดไม่ผ่าน · hash ไม่ซ้ำกันแม้รหัสเดียวกัน (salt สุ่ม)", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/password");
    const h1 = await hashPassword("secret-1234");
    const h2 = await hashPassword("secret-1234");
    expect(h1).not.toBe(h2);
    expect(h1.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("secret-1234", h1)).toBe(true);
    expect(await verifyPassword("secret-1235", h1)).toBe(false);
    expect(await verifyPassword("secret-1234", "garbage")).toBe(false);
  });

  it("กติการหัสผ่าน: สั้นกว่า 8 ไม่ผ่าน", async () => {
    const { passwordProblem } = await import("@/lib/password");
    expect(passwordProblem("1234567")).toMatch(/8/);
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem(undefined)).toBeTruthy();
  });
});

describe("user-store (memory mode)", () => {
  it("สมัคร → ล็อกอินถูก/ผิด → สมัครซ้ำได้ 'exists' → อีเมลไม่สนตัวเล็กใหญ่", async () => {
    const s = await loadStore();
    const r = await s.createUser("Som@Example.com", "password123");
    expect(r.status).toBe("ok");
    expect(r.user.email).toBe("som@example.com");
    expect(await s.authenticate("som@example.com", "password123")).not.toBeNull();
    expect(await s.authenticate("SOM@example.com", "password123")).not.toBeNull();
    expect(await s.authenticate("som@example.com", "wrong-password")).toBeNull();
    expect(await s.authenticate("nobody@example.com", "password123")).toBeNull();
    expect((await s.createUser("som@example.com", "another123")).status).toBe("exists");
    // สมัครซ้ำต้องไม่เขียนทับรหัสเดิม
    expect(await s.authenticate("som@example.com", "password123")).not.toBeNull();
  });

  it("ตั้งรหัสใหม่: รหัสเก่าใช้ไม่ได้ · ไม่มีบัญชีก็สร้างให้ · passwordUpdatedAt ขยับ", async () => {
    const s = await loadStore();
    const before = await s.createUser("a@b.co", "oldpass123");
    await new Promise((r) => setTimeout(r, 5));
    const rec = await s.setPassword("a@b.co", "newpass123");
    expect(rec.createdAt).toBe(before.user.createdAt);
    expect(rec.passwordUpdatedAt > before.user.passwordUpdatedAt).toBe(true);
    expect(await s.authenticate("a@b.co", "oldpass123")).toBeNull();
    expect(await s.authenticate("a@b.co", "newpass123")).not.toBeNull();
    const fresh = await s.setPassword("new@b.co", "brandnew123");
    expect(fresh.email).toBe("new@b.co");
    expect(await s.authenticate("new@b.co", "brandnew123")).not.toBeNull();
  });

  it("isValidEmail", async () => {
    const s = await loadStore();
    expect(s.isValidEmail("a@b.co")).toBe(true);
    expect(s.isValidEmail("a@b")).toBe(false);
    expect(s.isValidEmail("not an email")).toBe(false);
  });
});

describe("password reset token", () => {
  it("ออกแล้วตรวจได้ · หมดอายุ 30 นาที · แก้ไม่ได้ · ปลอมด้วยคุกกี้ล็อกอินไม่ได้", async () => {
    vi.resetModules();
    process.env.DOWNLOAD_SECRET = "a".repeat(64);
    const t = await import("@/lib/password-reset-token");
    const u = await import("@/lib/user-session");
    const token = t.createResetToken("X@y.com", 1_000_000);
    expect(t.verifyResetToken(token, 1_000_001)?.email).toBe("x@y.com");
    expect(t.verifyResetToken(token, 1_000_000 + 30 * 60 * 1000 + 1)).toBeNull();
    const [body, sig] = token.split(".");
    expect(t.verifyResetToken(`${body}.${sig.slice(0, -2)}zz`, 1_000_001)).toBeNull();
    expect(t.verifyResetToken(`${body}x.${sig}`, 1_000_001)).toBeNull();
    // คุกกี้ล็อกอิน (เซ็นคนละกุญแจ) เอามาเป็นโทเค็นตั้งรหัสไม่ได้ และกลับกัน
    const cookie = u.createUserSession({ email: "x@y.com", name: "", picture: "" }, 1_000_000).value;
    expect(t.verifyResetToken(cookie, 1_000_001)).toBeNull();
    expect(u.verifyUserSession(token, 1_000_001)).toBeNull();
  });
});

describe("auth rate limit", () => {
  it("เกินจำนวนในหน้าต่างเวลา → ปฏิเสธ · หมดหน้าต่าง → นับใหม่ · reset ล้างได้", async () => {
    vi.resetModules();
    const { allow, reset } = await import("@/lib/auth-rate-limit");
    expect(allow("k", 2, 1000, 0)).toBe(true);
    expect(allow("k", 2, 1000, 1)).toBe(true);
    expect(allow("k", 2, 1000, 2)).toBe(false);
    expect(allow("k", 2, 1000, 1001)).toBe(true);
    reset("k");
    expect(allow("k", 2, 1000, 1002)).toBe(true);
  });
});
