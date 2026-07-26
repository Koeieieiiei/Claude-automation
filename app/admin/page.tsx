import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ADMIN_COOKIE, adminReady, verifyAdminSession } from "@/lib/admin-auth";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

// หน้านี้เป็นข้อมูลภายในร้าน — ห้ามให้ Google เก็บ และห้าม cache
export const metadata: Metadata = {
  title: "สรุปยอดขาย | Mr.tpat3",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminReady()) {
    return (
      <main className="min-h-screen grid-paper flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-grid bg-white p-6 shadow-sm">
          <p className="eyebrow">ยังตั้งค่าไม่ครบ</p>
          <h1 className="mt-2 text-xl font-bold">หน้าสรุปยอดขายยังไม่เปิดใช้งาน</h1>
          <p className="mt-3 text-sm leading-7 text-ink/80">
            ต้องตั้งค่า <code className="rounded bg-paper px-1.5 py-0.5">ADMIN_PASSWORD</code> (รหัสผ่านเข้าหน้านี้)
            และ <code className="rounded bg-paper px-1.5 py-0.5">DOWNLOAD_SECRET</code> ใน Environment Variables ก่อน
            แล้ว deploy ใหม่อีกครั้ง
          </p>
        </div>
      </main>
    );
  }

  const authed = verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
  return authed ? <AdminDashboard /> : <AdminLogin />;
}
