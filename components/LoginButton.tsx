/**
 * ปุ่ม "เข้าสู่ระบบ / สมัครสมาชิก" — ลิงก์ธรรมดาไปหน้า /login (ใช้ได้ทั้ง server/client component)
 * next = หน้าที่จะพากลับมาหลังล็อกอินเสร็จ · mode = เปิดแท็บไหนก่อน
 * มาแทนปุ่ม Google เดิม (2026-09-26 เจ้าของสั่ง: ล็อกอินด้วยอีเมล+รหัสผ่านแทน)
 */
export default function LoginButton({
  next,
  label = "เข้าสู่ระบบ / สมัครสมาชิก",
  mode,
  className = "",
}: {
  next: string;
  label?: string;
  mode?: "signin" | "signup";
  className?: string;
}) {
  const q = new URLSearchParams({ next });
  if (mode) q.set("mode", mode);
  return (
    <a
      href={`/login?${q.toString()}`}
      className={`flex w-full items-center justify-center gap-2 bg-maroon px-5 py-3.5 font-semibold text-white transition hover:bg-maroon-dark ${className}`}
    >
      {label}
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </a>
  );
}
