import type { Metadata } from "next";
import { Suspense } from "react";
import { getExam } from "@/lib/exams";
import ExamView from "./ExamView";

// ชื่อแท็บตามสนามสอบใน ?exam= (ไม่ระบุ = TPAT3)
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}): Promise<Metadata> {
  const { exam } = await searchParams;
  return {
    title: `ห้องสอบ ${getExam(exam).title} | Mr.tpat3`,
    robots: { index: false }, // หน้าเฉพาะผู้ซื้อ — ไม่ให้ search engine เก็บ
  };
}

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
