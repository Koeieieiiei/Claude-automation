import type { Metadata } from "next";
import OpenInBrowser from "./OpenInBrowser";
import { safeNextPath } from "@/lib/user-session";

export const metadata: Metadata = {
  title: "เปิดในเบราว์เซอร์เพื่อเข้าสู่ระบบ | Mr.tpat3",
  robots: { index: false },
};

/**
 * หน้าพักเมื่อกดล็อกอินจากเบราว์เซอร์ในแอป (TikTok / IG / FB …) — Google ไม่ให้ล็อกอินในนั้น
 * /api/auth/google ส่งมาที่นี่พร้อม ?next=<หน้าที่จะไป>&app=<ชื่อแอป>
 */
export default async function OpenInBrowserPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; app?: string }>;
}) {
  const { next, app } = await searchParams;
  return <OpenInBrowser next={safeNextPath(next, "/")} app={(app ?? "").slice(0, 20) || "แอป"} />;
}
