import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

const base = config.baseUrl.startsWith("http") ? config.baseUrl : "https://tpat3mock.com";

export default function robots(): MetadataRoute.Robots {
  return {
    // อนุญาตให้เก็บหน้าสาธารณะได้ แต่กันหน้า API (มีลิงก์ดาวน์โหลดฝังโทเค็น) และหน้าขอบคุณ
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/success"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
