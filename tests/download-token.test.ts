import { describe, it, expect, beforeEach, vi } from "vitest";

const SECURE_SECRET = "a".repeat(64); // ยาว ≥32 และไม่ตรง placeholder → ปลอดภัย

/** โหลดโมดูลใหม่ทุกครั้งด้วย env ที่กำหนด (config อ่าน env ตอน import) */
async function loadTokenModule(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("@/lib/download-token");
}

const buyer = { orderId: "order-1", firstName: "สมชาย", lastName: "ใจดี", email: "som@example.com" };

describe("download-token", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("roundtrip: token ที่เซ็นถูก verify แล้วได้ payload เดิม", async () => {
    const { createDownloadToken, verifyDownloadToken } = await loadTokenModule({
      NODE_ENV: "test",
      DOWNLOAD_SECRET: SECURE_SECRET,
      DOWNLOAD_EXPIRY_HOURS: "72",
    });
    const token = createDownloadToken(buyer);
    const payload = verifyDownloadToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.orderId).toBe("order-1");
    expect(payload!.email).toBe("som@example.com");
  });

  it("forge: token ที่ถูกแก้ลายเซ็น → verify คืน null", async () => {
    const { createDownloadToken, verifyDownloadToken } = await loadTokenModule({
      NODE_ENV: "test",
      DOWNLOAD_SECRET: SECURE_SECRET,
      DOWNLOAD_EXPIRY_HOURS: "72",
    });
    const token = createDownloadToken(buyer);
    const [body] = token.split(".");
    const forged = `${body}.AAAAtamperedSignatureAAAA`;
    expect(verifyDownloadToken(forged)).toBeNull();
  });

  it("forge: token ที่เซ็นด้วย secret อื่น → verify คืน null", async () => {
    const a = await loadTokenModule({ NODE_ENV: "test", DOWNLOAD_SECRET: SECURE_SECRET, DOWNLOAD_EXPIRY_HOURS: "72" });
    const token = a.createDownloadToken(buyer);
    const b = await loadTokenModule({ NODE_ENV: "test", DOWNLOAD_SECRET: "b".repeat(64), DOWNLOAD_EXPIRY_HOURS: "72" });
    expect(b.verifyDownloadToken(token)).toBeNull();
  });

  it("expired: token ที่หมดอายุแล้ว → verify คืน null", async () => {
    const { createDownloadToken, verifyDownloadToken } = await loadTokenModule({
      NODE_ENV: "test",
      DOWNLOAD_SECRET: SECURE_SECRET,
      DOWNLOAD_EXPIRY_HOURS: "-1", // exp = now - 1h → หมดอายุทันที
    });
    const token = createDownloadToken(buyer);
    expect(verifyDownloadToken(token)).toBeNull();
  });

  it("garbage: string ที่ไม่ใช่ token → verify คืน null (ไม่ throw)", async () => {
    const { verifyDownloadToken } = await loadTokenModule({
      NODE_ENV: "test",
      DOWNLOAD_SECRET: SECURE_SECRET,
      DOWNLOAD_EXPIRY_HOURS: "72",
    });
    expect(verifyDownloadToken("")).toBeNull();
    expect(verifyDownloadToken("no-dot")).toBeNull();
    expect(verifyDownloadToken("a.b.c")).toBeNull();
  });

  it("production guard: secret ไม่ปลอดภัย + NODE_ENV=production → throw", async () => {
    const { createDownloadToken } = await loadTokenModule({
      NODE_ENV: "production",
      DOWNLOAD_SECRET: "dev-only-secret-please-change-in-production",
      DOWNLOAD_EXPIRY_HOURS: "72",
    });
    expect(() => createDownloadToken(buyer)).toThrow();
  });

  it("production ok: secret ปลอดภัย + NODE_ENV=production → ไม่ throw", async () => {
    const { createDownloadToken } = await loadTokenModule({
      NODE_ENV: "production",
      DOWNLOAD_SECRET: SECURE_SECRET,
      DOWNLOAD_EXPIRY_HOURS: "72",
    });
    expect(() => createDownloadToken(buyer)).not.toThrow();
  });
});
