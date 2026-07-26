/**
 * ตัวช่วยส่ง "เหตุการณ์สำคัญ" เข้า Google Analytics 4
 *
 * ใช้ฝั่ง client เท่านั้น · ถ้ายังไม่ได้ตั้ง NEXT_PUBLIC_GA_ID หรือสคริปต์ GA โหลดไม่ทัน
 * ฟังก์ชันจะเงียบ ๆ ไม่ทำอะไร (ห้ามให้การเก็บสถิติทำหน้าเว็บพัง)
 *
 * ชื่อเหตุการณ์ตั้งเป็นภาษาอังกฤษตามธรรมเนียม GA4 (รายงานอ่านง่ายกว่า)
 * ดูได้ที่ GA4 → Reports → Engagement → Events
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type ExamEvent =
  /** กดปุ่มใหญ่หน้าแรก "ทำข้อสอบ Mock TPAT3" */
  | "click_exam_cta"
  /** เปิดฟอร์มสั่งซื้อ (กดปุ่มสั่งซื้อใบใดก็ได้) */
  | "open_buy_form"
  /** กดปุ่มไปหน้าชำระเงินจริงใน Stripe */
  | "begin_checkout"
  /** มาถึงหน้า "ชำระเงินสำเร็จ" = ขายได้จริง */
  | "purchase_success"
  /** กดเริ่มจับเวลาสอบ */
  | "exam_start"
  /** ส่งกระดาษคำตอบสำเร็จ */
  | "exam_submit"
  /** ยืนยันตัวตนเข้าห้องสอบไม่ผ่าน (ยังไม่ซื้อ/กรอกไม่ตรง) */
  | "exam_access_denied";

export function trackEvent(event: ExamEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, params);
      return;
    }
    // สำรอง: ยังไม่มี gtag (เช่นยิงเร็วมากตอนหน้าเพิ่งเปิด) — ฝากไว้ในคิว
    // GA จะหยิบไปส่งเองทันทีที่ไลบรารีโหลดเสร็จ
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(["event", event, params]);
  } catch {
    // เก็บสถิติไม่ได้ ไม่ใช่เรื่องคอขาดบาดตาย — ปล่อยผ่าน
  }
}
