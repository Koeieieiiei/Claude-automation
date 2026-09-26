import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";
import { ForgotForm } from "@/components/PasswordForms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ลืมรหัสผ่าน | Mr.tpat3",
  robots: { index: false },
};

/** ลืมรหัสผ่าน — ส่งลิงก์ตั้งรหัสผ่านไปที่อีเมล (ลูกค้ายุคล็อกอิน Google ใช้หน้านี้ตั้งรหัสผ่านครั้งแรกได้) */
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthCard
      badge="ลืมรหัสผ่าน"
      title="ตั้งรหัสผ่านใหม่"
      intro="กรอกอีเมล เราจะส่งลิงก์ตั้งรหัสผ่านให้ (ใช้ได้ 30 นาที) เคยซื้อด้วยบัญชี Google ก็ตั้งรหัสผ่านที่นี่"
      next="/login"
    >
      <ForgotForm initialEmail={(email ?? "").slice(0, 254)} />
      <p className="mt-5 border-t border-dashed border-grid pt-4 font-label text-xs text-ink/60">
        <a href="/login" className="font-semibold text-maroon underline underline-offset-2 hover:no-underline">← เข้าสู่ระบบ</a>
      </p>
    </AuthCard>
  );
}
