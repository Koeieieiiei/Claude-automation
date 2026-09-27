import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import AuthForm from "@/components/AuthForm";
import { USER_COOKIE, safeNextPath, verifyUserSession } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In / Sign Up | Mr.tpat3",
  robots: { index: false },
};

/**
 * หน้าเข้าสู่ระบบ / สมัครสมาชิกด้วยอีเมล+รหัสผ่าน (แทนปุ่ม Google เดิม — เจ้าของสั่ง 2026-09-26)
 * /login?next=/exam&mode=signup&email=… ถ้าล็อกอินอยู่แล้ว → ข้ามไป next เลย
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; email?: string }>;
}) {
  const { next: rawNext, mode, email } = await searchParams;
  const next = safeNextPath(rawNext);
  if (verifyUserSession((await cookies()).get(USER_COOKIE)?.value)) redirect(next);

  return (
    <AuthCard
      badge="บัญชีผู้เรียน"
      title="Sign In / Sign Up"
      next={next}
    >
      <AuthForm next={next} initialMode={mode === "signup" ? "signup" : "signin"} initialEmail={(email ?? "").slice(0, 254)} />
    </AuthCard>
  );
}
