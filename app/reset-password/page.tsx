import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import { ResetForm } from "@/components/PasswordForms";
import { verifyResetToken } from "@/lib/password-reset-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ตั้งรหัสผ่านใหม่ | Mr.tpat3",
  robots: { index: false },
};

/** ปลายทางของลิงก์ในอีเมล — /reset-password?token=… · ตรวจโทเค็นก่อนโชว์ฟอร์ม (หมดอายุ/ปลอม = บอกให้ขอใหม่) */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const payload = verifyResetToken(token);

  if (!payload) {
    return (
      <AuthCard badge="ตั้งรหัสผ่านใหม่" title="ลิงก์ใช้ไม่ได้แล้ว" next="/login">
        <p className="text-sm leading-relaxed text-ink/75">
          ลิงก์ไม่ถูกต้องหรือหมดอายุ (ใช้ได้ 30 นาที)
        </p>
        <a
          href="/forgot-password"
          className="mt-5 flex w-full items-center justify-center bg-maroon py-3.5 font-semibold text-white transition hover:bg-maroon-dark"
        >
          ขอลิงก์ใหม่
        </a>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      badge="ตั้งรหัสผ่านใหม่"
      title="ตั้งรหัสผ่านใหม่"
      intro={
        <>
          บัญชี <strong className="text-ink">{payload.email}</strong> ตั้งเสร็จเข้าสู่ระบบให้ทันที
        </>
      }
      next="/login"
    >
      <ResetForm token={token ?? ""} />
    </AuthCard>
  );
}
