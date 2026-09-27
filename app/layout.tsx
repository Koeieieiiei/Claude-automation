import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";

const SITE_URL = "https://tpat3mock.com";
const TITLE = "ข้อสอบ Mock TPAT3 พร้อมเฉลยละเอียด | Mr.tpat3";
// ข้อความที่ขึ้นใต้ชื่อเว็บในผลค้นหา Google และตอนแชร์ลิงก์ — ชูจุดขายที่ร้านอื่นไม่มี
// (ทำข้อสอบบนเว็บ จับเวลา แล้ววิเคราะห์ผลให้) แล้วค่อยตามด้วยไฟล์ที่ได้และราคา
const DESCRIPTION =
  "Mock TPAT3 สอบออนไลน์ 70 ข้อ จับเวลา 3 ชม. รู้คะแนน อันดับ และจุดที่ต้องซ่อมทันที พร้อมเฉลยละเอียด ฿199 / เนื้อหา TPAT3 174 หน้า แจกฟรี";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "TPAT3",
    "ข้อสอบ TPAT3",
    "Mock TPAT3",
    "ข้อสอบเสมือนจริง TPAT3",
    "เฉลย TPAT3",
    "เนื้อหา TPAT3",
    "ความถนัดวิศวกรรม",
  ],
  alternates: { canonical: "/" },
  // ยืนยันความเป็นเจ้าของโดเมนกับ Google Search Console (ใช้ประกอบการยืนยันแบรนด์ OAuth) — ห้ามลบ
  verification: { google: "Fv1bhnvbNK-gCMLmN1UYVXCPJVHfR8oc4etku6pxENA" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE_URL,
    siteName: "Mr.tpat3",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {/* สถิติผู้เข้าเว็บ — ไม่ตั้ง NEXT_PUBLIC_GA_ID ก็ไม่โหลดอะไรเลย */}
        <Analytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
