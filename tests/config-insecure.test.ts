import { describe, it, expect, vi } from "vitest";

async function loadConfig(secret: string | undefined) {
  vi.resetModules();
  if (secret === undefined) delete process.env.DOWNLOAD_SECRET;
  else process.env.DOWNLOAD_SECRET = secret;
  return import("@/lib/config");
}

describe("config.download.insecure", () => {
  it.each([
    ["ไม่ได้ตั้งค่า", undefined, true],
    ["สั้นเกินไป", "abc123", true],
    ["placeholder dev-insecure-secret", "dev-insecure-secret", true],
    ["placeholder dev-only...", "dev-only-secret-please-change-in-production", true],
    ["placeholder change-me...", "change-me-to-a-long-random-string", true],
    ["secure 64-hex", "f".repeat(64), false],
    ["secure ยาวพอและไม่ตรง placeholder", "x9K2m".repeat(8), false],
  ])("%s → insecure=%s", async (_label, secret, expected) => {
    const { config } = await loadConfig(secret as string | undefined);
    expect(config.download.insecure).toBe(expected);
  });
});
