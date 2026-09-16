"use client";

import { useEffect, useState } from "react";
import BuyModal from "./BuyModal";
import type { ClientUser } from "./AccountButton";
import type { Product } from "@/lib/catalog";
import { trackEvent } from "@/lib/analytics";

/**
 * ปุ่มสั่งซื้อบนหน้ารายละเอียดคอร์ส — เปิดฟอร์มสั่งซื้อตัวเดียวกับหน้าแรก
 * เปิด /courses/<slug>?buy=1 = เปิดฟอร์มให้เลย (ใช้ตอนกลับมาจากล็อกอินในฟอร์ม)
 */
export default function CourseBuyButton({
  product,
  user,
  slug,
  className = "",
}: {
  product: Product;
  user: ClientUser | null;
  slug: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("buy") === "1") {
      setOpen(true);
      window.history.replaceState(null, "", `/courses/${slug}`);
    }
  }, [slug]);

  const buy = () => {
    trackEvent("open_buy_form", {
      product_id: product.id,
      value: product.price,
      currency: "THB",
      source: "course_page",
    });
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={buy}
        className={`w-full bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark ${className}`}
      >
        สั่งซื้อคอร์สนี้ · ฿{product.price.toLocaleString()}
      </button>
      {open && (
        <BuyModal
          product={product}
          user={user}
          returnTo={`/courses/${slug}?buy=1`}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
