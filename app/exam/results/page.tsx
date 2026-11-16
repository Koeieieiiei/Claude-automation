import type { Metadata } from "next";
import { Suspense } from "react";
import { getExam } from "@/lib/exams";
import ResultsView from "./ResultsView";

// ชื่อแท็บตามสนามสอบใน ?exam= (ไม่ระบุ = TPAT3)
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}): Promise<Metadata> {
  const { exam } = await searchParams;
  return {
    title: `ผลสอบ ${getExam(exam).title} | Mr.tpat3`,
    robots: { index: false }, // ผลสอบส่วนบุคคล — ไม่ให้ search engine เก็บ
  };
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="grid-paper flex min-h-screen items-center justify-center">
          <p className="text-ink/60">กำลังโหลดผลสอบ…</p>
        </main>
      }
    >
      <ResultsView />
    </Suspense>
  );
}
