import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import type { ClientUser } from "./AccountButton";

/** โครงหน้าเอกสาร (นโยบายความเป็นส่วนตัว / ข้อกำหนดการใช้งาน) — หัวเว็บ + หัวเรื่อง + เนื้อหา + ท้ายเว็บ */
export default function LegalLayout({
  user,
  path,
  title,
  updated,
  children,
}: {
  user: ClientUser | null;
  path: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} next={path} />
      <main className="flex-1">
        <section className="grid-paper border-b border-grid">
          <div className="mx-auto max-w-3xl px-5 py-12 md:py-14">
            <h1 className="font-display text-[2rem] font-bold leading-tight text-ink md:text-[2.5rem]">{title}</h1>
            <p className="mt-2 font-label text-sm text-ink/55">ปรับปรุงล่าสุด {updated}</p>
          </div>
        </section>
        <article className="legal mx-auto max-w-3xl px-5 py-12 text-[1rem] leading-[1.85] text-ink/85 md:text-[1.05rem]">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

/** หัวข้อย่อยในเอกสาร */
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-10 font-display text-xl font-bold text-ink first:mt-0">{children}</h2>;
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="my-3 space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="relative pl-5">
          <span className="absolute left-0 text-maroon">•</span>
          {it}
        </li>
      ))}
    </ul>
  );
}
