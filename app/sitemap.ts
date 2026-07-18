import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

// โดเมนหลัก (canonical) — ใช้ https://tpat3mock.com ถ้าไม่ได้ตั้ง NEXT_PUBLIC_BASE_URL
const base = config.baseUrl.startsWith("http") ? config.baseUrl : "https://tpat3mock.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
