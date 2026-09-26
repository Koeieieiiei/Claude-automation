"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Google Analytics 4 — โหลดแบบไม่ถ่วงหน้าเว็บ (afterInteractive: รอหน้าโหลดเสร็จก่อน)
 *
 * ใส่ไว้ที่ app/layout.tsx จึงทำงานทุกหน้า (หน้าแรก ห้องสอบ ผลสอบ จ่ายเงินสำเร็จ)
 * เว็บนี้เป็น Single Page App — เปลี่ยนหน้าแล้ว browser ไม่ได้โหลดใหม่ ต้องยิง page_view
 * เองทุกครั้งที่ path เปลี่ยน ไม่งั้น GA จะนับแค่หน้าแรกที่เปิด
 *
 * ไม่ตั้ง NEXT_PUBLIC_GA_ID = ไม่โหลดอะไรเลย (เช่น ตอน dev ในเครื่อง จะได้ไม่ปนสถิติจริง)
 */
export default function Analytics({ gaId }: { gaId?: string }) {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!gaId || typeof window.gtag !== "function") return;
    // ครั้งแรก gtag config ยิง page_view ให้เองแล้ว — ข้ามไปกันนับซ้ำ
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, gaId]);

  if (!gaId) return null;

  return (
    <>
      {/* ตัวตั้งต้นต้องมาก่อน hydration — ไม่งั้นเหตุการณ์ที่ยิงทันทีตอนเปิดหน้า
          (เช่น purchase_success, open_buy_form จากลิงก์) จะหายเพราะ gtag ยังไม่เกิด
          เป็นสคริปต์สั้น ๆ ไม่โหลดอะไรจากเน็ต จึงไม่ถ่วงเว็บ */}
      <Script id="ga-init" strategy="beforeInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
      {/* ตัวไลบรารีจริงโหลดทีหลังแบบไม่บล็อกหน้าเว็บ — เหตุการณ์ที่ค้างใน dataLayer
          จะถูกส่งให้ Google ทันทีที่โหลดเสร็จ */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
    </>
  );
}
