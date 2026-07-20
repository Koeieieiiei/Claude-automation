import { Suspense } from "react";
import SuccessView, { Frame } from "./SuccessView";

// useSearchParams ต้องอยู่ใต้ Suspense — ครอบไว้ที่นี่ (fallback = การ์ดกำลังโหลด)
export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <Frame badge="กำลังตรวจสอบ…">
          <div className="px-8 py-14 text-center text-ink/70">กำลังโหลด…</div>
        </Frame>
      }
    >
      <SuccessView />
    </Suspense>
  );
}
