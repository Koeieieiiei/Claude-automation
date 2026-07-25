import { Suspense } from "react";
import ResultsView from "./ResultsView";

export const metadata = {
  title: "ผลสอบ Mock TPAT3 · Mr.tpat3",
  robots: { index: false }, // ผลสอบส่วนบุคคล — ไม่ให้ search engine เก็บ
};

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
