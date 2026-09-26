/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // ไฟล์ตัวอย่างฟรี (เดโม) เลิกใช้ 2026-09-26 — ทุกคอร์สแจกฟรีแล้ว ลิงก์เก่าที่เคยแชร์ไว้พามาหน้าแรกแทน
      { source: "/samples/:path*", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
