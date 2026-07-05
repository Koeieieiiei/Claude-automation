import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ข้อสอบ Mock TPAT3 (Ebook)",
  description: "ข้อสอบจำลอง TPAT3 พร้อมเฉลย ดาวน์โหลดเป็น Ebook ทันทีหลังชำระเงิน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@500;600;700&family=Sarabun:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
