import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

/** กรอบหน้าล็อกอิน/ลืมรหัส/ตั้งรหัสใหม่ — การ์ดกลางจอบนกระดาษตาราง (โครงเดียวกับการ์ดล็อกอินในหน้าคอร์สของฉัน) */
export default function AuthCard({
  badge,
  title,
  intro,
  children,
  next,
}: {
  badge: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  next?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={null} next={next} />
      <main className="grid-paper flex flex-1 items-center justify-center px-4 py-14">
        <div className="w-full max-w-md border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
          <div className="border-b border-ink px-6 py-3">
            <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">{badge}</span>
          </div>
          <div className="px-6 py-8">
            <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
            {intro && <p className="mt-2 text-sm leading-relaxed text-ink/70">{intro}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
