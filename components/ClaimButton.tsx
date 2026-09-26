"use client";

import { trackEvent } from "@/lib/analytics";

/**
 * ปุ่ม "รับฟรี" — ลิงก์ธรรมดาไป /api/claim?product=<id> (ล็อกอิน → เปิดสิทธิ์ → คอร์สของฉัน)
 * ใช้กับสินค้าที่ price = 0 (เล่มเนื้อหา TPAT3) · ใช้ได้ทั้งใน server และ client component
 */
export default function ClaimButton({
  productId,
  label = "รับฟรี",
  source = "",
  variant = "primary",
  className = "",
}: {
  productId: string;
  label?: string;
  /** ไว้แยกในสถิติว่ากดจากหน้าไหน (หน้าแรก / หน้าคอร์ส / คอร์สของฉัน) */
  source?: string;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const base =
    variant === "primary"
      ? "bg-maroon text-white hover:bg-maroon-dark"
      : "border border-maroon text-maroon hover:bg-maroon hover:text-white";
  return (
    <a
      href={`/api/claim?product=${encodeURIComponent(productId)}`}
      onClick={() => trackEvent("claim_free", { product_id: productId, source })}
      className={`group inline-flex items-center justify-center gap-2.5 px-5 py-3.5 font-semibold transition ${base} ${className}`}
    >
      {label}
      <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </a>
  );
}
