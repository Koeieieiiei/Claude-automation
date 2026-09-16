import Gear from "./Gear";
import AccountButton, { ClientUser } from "./AccountButton";

/**
 * แถบหัวเว็บสำหรับหน้าย่อย (รายละเอียดคอร์ส / คอร์สของฉัน) — หน้าแรกมีของตัวเอง
 * user: ส่งมาจาก server component ได้เลย (ไม่ต้องรอ client ถาม /api/auth/me)
 */
export default function SiteHeader({
  user,
  next,
}: {
  user: ClientUser | null;
  /** หน้าที่จะกลับมาหลังกดล็อกอินจากปุ่มบนหัวเว็บ */
  next?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <a href="/" className="flex items-center gap-2.5">
          <Gear teeth={10} className="h-6 w-6 text-maroon" spin="cw" />
          <span className="font-display text-lg font-bold tracking-tight text-ink">Mr.tpat3</span>
          <span className="hidden font-label text-xs font-semibold tracking-[0.22em] text-maroon sm:inline">
            TPAT3 · ฟิสิกส์
          </span>
        </a>
        <nav className="hidden items-center gap-6 md:flex" aria-label="เมนูหลัก">
          <a href="/#mock" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ข้อสอบ Mock</a>
          <a href="/#summaries" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ไฟล์เนื้อหา</a>
          <a href="/#bundles" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">Bundles</a>
          <a href="/#faq" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ข้อสงสัย</a>
          <a href="/about" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">เกี่ยวกับพี่</a>
        </nav>
        <AccountButton user={user} next={next} />
      </div>
    </header>
  );
}
