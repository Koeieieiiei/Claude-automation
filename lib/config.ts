/**
 * ศูนย์รวมการอ่านค่า config จาก environment variables
 *
 * แนวคิด: ถ้ายังไม่ได้ใส่ key ของ service ไหน ระบบจะเข้า "โหมด mock" ของ service นั้น
 * โดยอัตโนมัติ (ไม่เรียก service จริง) เพื่อให้รันและทดสอบหน้าเว็บได้ตั้งแต่ยังไม่มี key
 */

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

// ค่า placeholder ตัวอย่างที่ห้ามใช้จริงใน production (เทียบแบบ exact)
const INSECURE_SECRET_SAMPLES = [
  "dev-insecure-secret",
  "dev-only-secret-please-change-in-production",
  "change-me-to-a-long-random-string",
];
const downloadSecret = env("DOWNLOAD_SECRET");

export const config = {
  // ชื่อร้าน/เว็บ (ชื่อและราคาสินค้าแต่ละตัวอยู่ใน lib/catalog.ts)
  siteName: env("NEXT_PUBLIC_SITE_NAME", "Mr.tpat3"),
  // ถ้าไม่ได้ตั้ง NEXT_PUBLIC_BASE_URL บน Vercel ให้ใช้ URL ที่ Vercel แจกมา
  // แทนที่จะ fallback เป็น localhost (ซึ่งจะกลายเป็นลิงก์เสียในอีเมลลูกค้า)
  baseUrl:
    env("NEXT_PUBLIC_BASE_URL") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),

  stripe: {
    secretKey: env("STRIPE_SECRET_KEY"),
    webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
    currency: env("STRIPE_CURRENCY", "thb"),
  },

  supabase: {
    url: env("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: env("SUPABASE_BUCKET", "ebooks"),
  },

  resend: {
    apiKey: env("RESEND_API_KEY"),
    from: env("EMAIL_FROM", "ร้านข้อสอบ <onboarding@resend.dev>"),
  },

  sheets: {
    id: env("GOOGLE_SHEETS_ID"),
    clientEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  },

  /** หน้าสรุปยอดขาย /admin — เข้าได้เฉพาะคนที่รู้รหัสผ่านนี้ */
  admin: {
    password: env("ADMIN_PASSWORD"),
    /** อายุการล็อกอิน (วัน) */
    sessionDays: Number(env("ADMIN_SESSION_DAYS", "7")) || 7,
  },

  /** Google Analytics 4 — Data API (ดึงสถิติผู้เข้าชมมาโชว์บนหน้า /admin) */
  ga: {
    // Property ID เป็น "ตัวเลขล้วน" (คนละตัวกับ Measurement ID G-XXXX)
    propertyId: env("GA4_PROPERTY_ID"),
    // ใช้ service account ตัวเดียวกับ Google Sheets ได้ (แค่เพิ่มสิทธิ์ Viewer ใน GA4)
    clientEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  },

  download: {
    secret: downloadSecret || "dev-insecure-secret",
    /**
     * อายุลิงก์ดาวน์โหลด (ชั่วโมง) — **ค่าที่ร้านใช้อยู่คือ 0 = ไม่มีวันหมดอายุ**
     * (เจ้าของกำหนด 2026-07-25 — ไฟล์ที่ซื้อแล้วเป็นของลูกค้าถาวร)
     *
     * ถ้าใส่จำนวนบวก อายุจะคิดจาก "เวลาที่ออกลิงก์ (iat ในโทเค็น) + ค่านี้"
     * ไม่ได้ฝังวันหมดอายุตายตัวไว้ในลิงก์ เปลี่ยนค่านี้เมื่อไหร่ลิงก์ที่ออกไปแล้ว
     * จึงยืด/หดตามทันที ไม่ต้องออกลิงก์ใหม่ให้ลูกค้า
     */
    expiryHours: Number(env("DOWNLOAD_EXPIRY_HOURS", "0")) || 0,
    // ถือว่า "ไม่ปลอดภัย" ถ้า: ไม่ได้ตั้งค่า / สั้นเกินไป / ตรงกับค่า placeholder ตัวอย่างเป๊ะ
    // (เทียบแบบ exact เพื่อเลี่ยง false-positive กับ secret สุ่มที่บังเอิญมีสตริงพวกนี้)
    insecure:
      !downloadSecret ||
      downloadSecret.length < 32 ||
      INSECURE_SECRET_SAMPLES.includes(downloadSecret),
  },
};

/** ตรวจว่า service แต่ละตัวพร้อมใช้งานจริงหรือยัง (ถ้าไม่พร้อม = โหมด mock) */
export const ready = {
  supabase: Boolean(config.supabase.url && config.supabase.serviceRoleKey),
  stripe: Boolean(config.stripe.secretKey),
  stripeWebhook: Boolean(config.stripe.webhookSecret),
  resend: Boolean(config.resend.apiKey),
  sheets: Boolean(config.sheets.id && config.sheets.clientEmail && config.sheets.privateKey),
  // หน้า /admin ต้องมีทั้งรหัสผ่านและ secret สำหรับเซ็นคุกกี้ ไม่งั้นถือว่ายังไม่เปิดใช้
  admin: Boolean(config.admin.password && config.download.secret),
  ga: Boolean(config.ga.propertyId && config.ga.clientEmail && config.ga.privateKey),
};
