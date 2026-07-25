import { Suspense } from "react";
import ExamView from "./ExamView";

export const metadata = {
  title: "ห้องสอบ Mock TPAT3 · Mr.tpat3",
  robots: { index: false }, // หน้าเฉพาะผู้ซื้อ — ไม่ให้ search engine เก็บ
};

// useSearchParams ต้องอยู่ใต้ Suspense (แบบเดียวกับหน้า success)
export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <main className="grid-paper flex min-h-screen items-center justify-center">
          <p className="text-ink/60">กำลังโหลดห้องสอบ…</p>
        </main>
      }
    >
      <ExamView />
    </Suspense>
  );
}
