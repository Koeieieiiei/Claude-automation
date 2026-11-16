/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // หน้า "บทความเกี่ยวกับฉัน" เจ้าของสั่งเอาออก 2026-11-16 — ลิงก์เก่าพากลับหน้าแรก (ชั่วคราว 307 เผื่อเจ้าของขอคืน)
  async redirects() {
    return [{ source: "/about", destination: "/", permanent: false }];
  },
};

export default nextConfig;
