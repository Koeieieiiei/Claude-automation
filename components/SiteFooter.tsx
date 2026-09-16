/** ท้ายเว็บ — ช่องทางติดต่อ + ลิงก์หน้าหลัก (ใช้ทุกหน้า) */
export default function SiteFooter() {
  return (
    <footer className="border-t border-grid bg-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 font-label text-sm text-ink/55">
        <p>
          © {new Date().getFullYear()} Mr.tpat3 · ติดต่อ{" "}
          <a href="mailto:mr.tpat3@gmail.com" className="font-medium text-maroon underline-offset-2 hover:underline">
            mr.tpat3@gmail.com
          </a>{" "}
          · TikTok{" "}
          <a
            href="https://www.tiktok.com/@mrtpat3"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-maroon underline-offset-2 hover:underline"
          >
            @Mrtpat3
          </a>
        </p>
        <nav className="flex flex-wrap gap-4" aria-label="ลิงก์ท้ายเว็บ">
          <a href="/" className="hover:text-maroon">หน้าหลัก</a>
          <a href="/my-courses" className="hover:text-maroon">คอร์สของฉัน</a>
          <a href="/exam" className="hover:text-maroon">ห้องสอบ</a>
          <a href="/#faq" className="hover:text-maroon">ข้อสงสัย</a>
          <a href="/about" className="hover:text-maroon">เกี่ยวกับพี่</a>
          <a href="/privacy" className="hover:text-maroon">นโยบายความเป็นส่วนตัว</a>
          <a href="/terms" className="hover:text-maroon">ข้อกำหนดการใช้งาน</a>
        </nav>
      </div>
    </footer>
  );
}
