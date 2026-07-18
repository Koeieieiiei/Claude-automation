import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mr.tpat3",
  description:
    "ข้อสอบ Mock TPAT3 พร้อมเฉลยละเอียด และสรุปฟิสิกส์ 3 เล่มแบ่งตามหมวด ดาวน์โหลดเป็น Ebook ทันทีหลังชำระเงิน",
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
      <body>{children}</body>
    </html>
  );
}
