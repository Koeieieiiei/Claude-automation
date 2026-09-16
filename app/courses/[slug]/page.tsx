import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CourseBuyButton from "@/components/CourseBuyButton";
import CourseIcon from "@/components/CourseIcons";
import Gear from "@/components/Gear";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";
import { getLibrary, ownsProduct } from "@/lib/library";
import { PRODUCTS } from "@/lib/catalog";
import { COURSES, getCourse } from "@/lib/courses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = "https://tpat3mock.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) return { title: "ไม่พบคอร์ส · Mr.tpat3" };
  const product = PRODUCTS[course.productId];
  const description = `${course.tagline} — ${course.includes.join(" · ")} ราคา ฿${product.price.toLocaleString()} โดย Mr.tpat3`;
  return {
    title: `${course.title} | Mr.tpat3`,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      type: "website",
      locale: "th_TH",
      url: `${SITE_URL}/courses/${course.slug}`,
      siteName: "Mr.tpat3",
      title: course.title,
      description,
      images: [{ url: `${SITE_URL}${course.covers[course.covers.length - 1].src}` }],
    },
  };
}

const TONE = {
  blue: "bg-[#DCE6F2] text-[#1F3A5F]",
  rose: "bg-[#EBDADA] text-[#5A1E2A]",
  maroon: "bg-maroon text-paper",
} as const;

/**
 * หน้ารายละเอียดคอร์ส — โครงแบบเว็บคอร์สเรียน: แบนเนอร์ + การ์ดซื้อด้านขวา + รายละเอียด/สารบัญด้านล่าง
 * ซื้อแล้ว (ล็อกอินอยู่) → ปุ่มเปลี่ยนเป็น "เข้าเรียน" พาไปหน้าคอร์สของฉัน
 */
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getCourse(slug);
  if (!course) notFound();
  const product = PRODUCTS[course.productId];

  const user = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
  let owned = false;
  if (user) {
    try {
      owned = ownsProduct(await getLibrary(user.email), product);
    } catch (err) {
      console.error("เช็คว่าซื้อคอร์สแล้วหรือยังไม่สำเร็จ:", err);
    }
  }

  const save = product.compareAt ? product.compareAt - product.price : 0;
  const others = COURSES.filter((c) => c.slug !== course.slug);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} next={`/courses/${course.slug}`} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-6">
          <a href="/" className="inline-flex items-center gap-1.5 font-label text-sm text-ink/60 transition hover:text-maroon">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            ย้อนกลับ
          </a>

          {/* มือถือเรียง: แบนเนอร์ → การ์ดซื้อ → รายละเอียด · จอใหญ่: ซ้าย (แบนเนอร์+รายละเอียด) ขวา (การ์ดซื้อ sticky) */}
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:grid-rows-[auto_1fr]">
            {/* ===== แบนเนอร์ ===== */}
              <div className={`relative overflow-hidden border border-grid lg:col-start-1 lg:row-start-1 ${TONE[course.bannerTone]}`}>
                <Gear teeth={16} className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 opacity-10" spin="cw" />
                <Gear teeth={12} className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 opacity-10" spin="ccw" />
                <div className="relative grid items-center gap-6 px-7 py-9 sm:grid-cols-[1fr_auto] md:px-10 md:py-12">
                  <div>
                    <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">by Mr.tpat3</p>
                    <h1 className="mt-2 font-display text-[2rem] font-bold leading-[1.15] md:text-[2.5rem]">{course.title}</h1>
                    <p className="mt-3 max-w-md text-[1.05rem] font-medium leading-relaxed opacity-90">{course.tagline}</p>
                  </div>
                  <div className="flex items-center justify-center sm:justify-end">
                    {course.covers.map((c, i, arr) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={c.src}
                        src={c.src}
                        alt={c.alt}
                        className={`w-[132px] border border-black/10 bg-white shadow-[0_22px_45px_-18px_rgba(0,0,0,0.55)] md:w-[150px] ${
                          arr.length > 1 ? (i === 0 ? "-rotate-[6deg]" : "z-10 -ml-9 mt-4 rotate-[6deg]") : ""
                        }`}
                        style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
                      />
                    ))}
                  </div>
                </div>
              </div>

            {/* ===== ขวา: ชื่อ + สถิติ + การ์ดซื้อ ===== */}
            <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20 lg:self-start">
              <h2 className="font-display text-xl font-bold leading-snug text-ink">{course.title}</h2>
              <p className="mt-1.5 font-label text-xs text-ink/50">รหัส: {product.id.toUpperCase()}</p>
              <p className="font-label text-xs text-ink/50">วิชา: {course.subject}</p>

              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {course.stats.map((st) => (
                  <div key={st.label} className="border border-grid bg-white px-2 py-4">
                    <CourseIcon kind={st.icon} className="mx-auto h-8 w-8 text-maroon" />
                    <p className="mt-2 font-label text-[11px] text-ink/55">{st.label}</p>
                    <p className="mt-0.5 font-display text-sm font-bold text-ink">{st.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border border-ink bg-white p-6 shadow-[0_25px_60px_-30px_rgba(14,26,43,0.5)]">
                <p className="font-display text-lg font-bold text-ink">รูปแบบการเรียน</p>
                <div className="mt-3 border border-maroon/40 bg-maroon/[0.04] px-4 py-3 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {product.files.includes("questions") ? "สอบออนไลน์บนเว็บ + ไฟล์ PDF" : "ไฟล์ PDF อ่านได้ทุกอุปกรณ์"}
                  </p>
                  <p className="mt-1 font-label text-[11px] text-ink/55">เข้าเรียนผ่านหน้า “คอร์สของฉัน” · ไม่มีวันหมดอายุ</p>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {course.includes.map((x) => (
                    <li key={x} className="relative pl-5 text-sm text-ink/80">
                      <span className="absolute left-0 font-bold text-maroon">✓</span>
                      {x}
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-wrap items-baseline justify-end gap-2.5 border-t border-dashed border-grid pt-4">
                  <span className="font-display text-[2.1rem] font-bold leading-none text-maroon">
                    ฿{product.price.toLocaleString()}
                  </span>
                  {product.compareAt && (
                    <>
                      <span className="text-sm text-ink/45 line-through">฿{product.compareAt.toLocaleString()}</span>
                      <span className="border border-maroon/40 px-2 py-0.5 font-label text-xs font-bold text-maroon">
                        ประหยัด ฿{save.toLocaleString()}
                      </span>
                    </>
                  )}
                </div>

                {owned ? (
                  <>
                    <a
                      href="/my-courses"
                      className="mt-4 flex w-full items-center justify-center gap-2 bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
                    >
                      เข้าเรียน — ไปที่คอร์สของฉัน →
                    </a>
                    <p className="mt-2 text-center font-label text-[11px] text-ink/55">บัญชีนี้มีคอร์สนี้แล้ว</p>
                  </>
                ) : (
                  <>
                    <CourseBuyButton product={product} user={user} slug={course.slug} className="mt-4" />
                    <p className="mt-2 text-center font-label text-[11px] text-ink/50">
                      🔒 ชำระเงินปลอดภัยผ่าน Stripe · PromptPay
                    </p>
                    {!user && (
                      <p className="mt-3 text-center font-label text-xs text-ink/60">
                        ซื้อไปแล้ว?{" "}
                        <a
                          href={`/api/auth/google?next=${encodeURIComponent(`/courses/${course.slug}`)}`}
                          className="font-semibold text-maroon underline underline-offset-2"
                        >
                          ล็อกอินด้วย Google
                        </a>{" "}
                        เพื่อเข้าเรียน
                      </p>
                    )}
                  </>
                )}
              </div>
            </aside>

            {/* ===== รายละเอียด ===== */}
            <div className="lg:col-start-1 lg:row-start-2">
              {/* แท็บ (มีแท็บเดียว — เอาไว้ให้หน้าตาเหมือนหน้าคอร์ส) */}
              <div className="mt-8 border-b border-grid">
                <span className="inline-block border-b-2 border-maroon px-4 pb-2.5 font-display text-sm font-bold text-maroon">
                  รายละเอียด
                </span>
              </div>

              <section className="mt-6">
                <h2 className="font-display text-lg font-bold text-ink">รายละเอียดคอร์ส</h2>
                <dl className="mt-4 space-y-2 text-[0.95rem] leading-relaxed">
                  {course.facts.map((f) => (
                    <div key={f.label} className="grid gap-1 sm:grid-cols-[130px_1fr]">
                      <dt className="font-bold text-ink">{f.label}:</dt>
                      <dd className="text-ink/80">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                <h3 className="mt-8 font-display text-lg font-bold text-ink">สิ่งที่จะได้รับ</h3>
                <ul className="mt-3 space-y-1.5">
                  {course.includes.map((x) => (
                    <li key={x} className="relative pl-6 text-[0.95rem] text-ink/85">
                      <span className="absolute left-0 font-bold text-maroon">✓</span>
                      {x}
                    </li>
                  ))}
                </ul>

                <h3 className="mt-8 font-display text-lg font-bold text-ink">จุดเด่น</h3>
                <ul className="mt-3 space-y-1.5">
                  {course.highlights.map((x) => (
                    <li key={x} className="relative pl-5 text-[0.95rem] leading-relaxed text-ink/85">
                      <span className="absolute left-0 text-maroon">–</span>
                      {x}
                    </li>
                  ))}
                </ul>

                <h3 className="mt-8 font-display text-lg font-bold text-ink">{course.contentsTitle}</h3>
                <div className="mt-3 divide-y divide-grid border-y border-grid">
                  {course.contents.map((g, i) => (
                    <details key={g.title} className="group py-3" open={i === 0 && g.items.length > 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:content-none">
                        <span>
                          <span className="font-display text-[0.98rem] font-bold text-ink">{g.title}</span>
                          {g.meta && <span className="ml-2 font-label text-xs text-ink/50">{g.meta}</span>}
                        </span>
                        {g.items.length > 0 && (
                          <span className="grid h-5 w-5 shrink-0 place-items-center border border-ink/30 text-sm text-maroon transition group-open:rotate-45">
                            +
                          </span>
                        )}
                      </summary>
                      {g.items.length > 0 && (
                        <ol className="mt-2 space-y-1 pl-1">
                          {g.items.map((it, j) => (
                            <li key={it} className="flex gap-3 text-[0.93rem] text-ink/80">
                              <span className="w-6 shrink-0 font-label text-xs font-semibold text-ink/40">
                                {String(j + 1).padStart(2, "0")}
                              </span>
                              {it}
                            </li>
                          ))}
                        </ol>
                      )}
                    </details>
                  ))}
                </div>

                {course.sample && (
                  <a
                    href={course.sample.href}
                    download={course.sample.downloadName}
                    className="mt-8 inline-flex items-center gap-2.5 border border-ink px-5 py-3 font-semibold text-ink transition hover:bg-ink hover:text-paper"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" />
                    </svg>
                    {course.sample.label} (PDF)
                  </a>
                )}
              </section>
            </div>

          </div>

          {/* ===== คอร์สอื่น ===== */}
          {others.length > 0 && (
            <section className="mt-16 border-t border-grid pt-10">
              <h2 className="font-display text-xl font-bold text-ink">คอร์สอื่นของ Mr.tpat3</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {others.map((c) => {
                  const p = PRODUCTS[c.productId];
                  return (
                    <a
                      key={c.slug}
                      href={`/courses/${c.slug}`}
                      className="flex items-center gap-4 border border-grid bg-white p-4 transition hover:border-maroon"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.covers[c.covers.length - 1].src}
                        alt={c.covers[c.covers.length - 1].alt}
                        className="w-14 border border-grid"
                        style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
                      />
                      <span className="min-w-0">
                        <span className="block font-display font-bold text-ink">{c.title}</span>
                        <span className="mt-0.5 block text-sm text-ink/60">{c.tagline}</span>
                        <span className="mt-1 block font-display font-bold text-maroon">฿{p.price.toLocaleString()}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
