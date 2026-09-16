import { createHash, randomBytes } from "crypto";
import { config, ready } from "./config";
import type { SessionUser } from "./user-session";

/**
 * ล็อกอินด้วย Google ผ่าน Supabase Auth แบบ PKCE — ทำฝั่ง server ทั้งหมด
 *
 * 1) /api/auth/google  สร้าง verifier สุ่ม → พาไป Supabase /authorize (ต่อไปหน้า Google)
 * 2) Google ส่งกลับมาที่ Supabase → Supabase ส่งกลับมาที่ /api/auth/callback?code=…
 * 3) callback เอา code + verifier ไปแลกข้อมูลผู้ใช้กับ Supabase (ใช้ key ฝั่ง server)
 *
 * ข้อดี: ไม่ต้องมี anon key ในหน้าเว็บ และไม่มี token ของ Supabase หลุดไปฝั่ง browser
 * ตั้งค่าที่ต้องมีใน Supabase: Authentication → Providers → Google (Client ID + Secret)
 * และ URL Configuration → Redirect URLs ต้องมีโดเมนเว็บ (เช่น https://tpat3mock.com/**)
 */

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function googleLoginReady(): boolean {
  return ready.supabase;
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function googleAuthorizeUrl(input: { redirectTo: string; challenge: string }): string {
  const u = new URL(`${config.supabase.url.replace(/\/+$/, "")}/auth/v1/authorize`);
  u.searchParams.set("provider", "google");
  u.searchParams.set("redirect_to", input.redirectTo);
  u.searchParams.set("code_challenge", input.challenge);
  u.searchParams.set("code_challenge_method", "s256");
  // ให้ Google ถามทุกครั้งว่าจะใช้บัญชีไหน (เครื่องที่ล็อกอิน Google ไว้หลายบัญชีจะได้เลือกถูก)
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

interface SupabaseUser {
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
}

/** แลก code เป็นข้อมูลผู้ใช้ — คืน null ถ้าไม่ผ่าน (code หมดอายุ/ใช้ซ้ำ/verifier ไม่ตรง) */
export async function exchangeCodeForUser(code: string, verifier: string): Promise<SessionUser | null> {
  const res = await fetch(
    `${config.supabase.url.replace(/\/+$/, "")}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        apikey: config.supabase.serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.error("แลก code ล็อกอิน Google ไม่สำเร็จ:", res.status, (await res.text()).slice(0, 300));
    return null;
  }
  const data = (await res.json()) as { user?: SupabaseUser };
  const user = data.user;
  const meta = user?.user_metadata ?? {};
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  // สิทธิ์ทั้งหมดผูกกับอีเมล → รับเฉพาะอีเมลที่ยืนยันแล้ว (บัญชี Google ยืนยันให้เสมอ)
  const verified = Boolean(user?.email_confirmed_at) || meta.email_verified === true;
  if (!email || !verified) return null;

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    email,
    name: str(meta.full_name) || str(meta.name),
    picture: str(meta.avatar_url) || str(meta.picture),
  };
}
