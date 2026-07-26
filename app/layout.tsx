import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";

const SITE_URL = "https://tpat3mock.com";
const TITLE = "ข้อสอบ Mock TPAT3 พร้อมเฉลยละเอียด | Mr.tpat3";
// ข้อความที่ขึ้นใต้ชื่อเว็บในผลค้นหา Google และตอนแชร์ลิงก์ — ชูจุดขายที่ร้านอื่นไม่มี
// (ทำข้อสอบบนเว็บ จับเวลา แล้ววิเคราะห์ผลให้) แล้วค่อยตามด้วยไฟล์ที่ได้และราคา
const DESCRIPTION =
  "ซ้อม TPAT3 เหมือนสนามจริง — ทำข้อสอบ 70 ข้อบนเว็บ จับเวลา 3 ชั่วโมง ส่งแล้วรู้คะแนน อันดับ และบทที่ต้องซ่อมทันที พร้อมเฉลยละเอียดทีละขั้นและสรุปเนื้อหา TPAT3 เริ่ม ฿99";

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
    "สรุป TPAT3",
    "ความถนัดวิศวกรรม",
  ],
  alternates: { canonical: "/" },
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap"
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
