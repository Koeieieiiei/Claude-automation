import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { COURSES } from "@/lib/courses";

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
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    // หน้ารายละเอียดคอร์ส — ให้ Google เก็บด้วย (มีชื่อคอร์ส/สารบัญ เป็นคำค้นที่คนหา)
    ...COURSES.map((c) => ({
      url: `${base}/courses/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
