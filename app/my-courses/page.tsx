import { cookies } from "next/headers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LoginButton from "@/components/LoginButton";
import { Avatar } from "@/components/AccountButton";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";
import { getLibrary, LibraryItem } from "@/lib/library";
import { buildDownloadLinks, DownloadLink } from "@/lib/downloads";
import ClaimButton from "@/components/ClaimButton";
import { FileId, PRODUCTS } from "@/lib/catalog";
import { COURSES, courseForProduct, getCourse } from "@/lib/courses";
import { getExam } from "@/lib/exams";
import { getAttemptState, isUnlimitedEmail, AttemptState } from "@/lib/exam-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "คอร์สของฉัน · Mr.tpat3",
  robots: { index: false }, // หน้าส่วนตัว — ไม่ให้ search engine เก็บ
};

/**
 * "คอร์ส" ในหน้านี้มีแค่ 2 ตัวตายตัว (เจ้าของกำหนด 2026-09-16) ไม่ใช่รายการสั่งซื้อ:
 *   mock-tpat3    = ห้องสอบ + ไฟล์เฉลย        ← ได้เมื่อมีไฟล์ questions (ซื้อ Mock หรือ bundle)
 *   tpat3-content = ไฟล์เล่มเนื้อหา            ← ได้เมื่อมี tpat3content (หรือ sum4content รุ่นเก่า)
 * ซื้อ bundle = ได้ 2 การ์ดนี้เหมือนคนซื้อแยก ไม่มีการ์ด "ครบเซ็ต"
 * ไฟล์โจทย์/กระดาษคำตอบ/สูตรล้วนไม่โชว์ที่นี่ (ยังโหลดได้จากลิงก์ในอีเมลตามเดิม)
 */
interface LibraryCourse {
  slug: "mock-tpat3" | "tpat3-content";
  /** ออเดอร์ที่ให้สิทธิ์ (ใช้ชื่อ-อีเมลใส่ลายน้ำ + วันที่ซื้อ) */
  item: LibraryItem;
  files: FileId[];
  hasExam: boolean;
}

function deriveCourses(items: LibraryItem[]): LibraryCourse[] {
  const out: LibraryCourse[] = [];
  const mockSrc = items.find((i) => i.files.includes("questions"));
  if (mockSrc) out.push({ slug: "mock-tpat3", item: mockSrc, files: ["answers"], hasExam: true });
  const contentFile: FileId | null = items.some((i) => i.files.includes("tpat3content"))
    ? "tpat3content"
    : items.some((i) => i.files.includes("sum4content"))
      ? "sum4content"
      : null;
  if (contentFile) {
    const src = items.find((i) => i.files.includes(contentFile))!;
    out.push({ slug: "tpat3-content", item: src, files: [contentFile], hasExam: false });
  }
  return out;
}

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: "ยกเลิกการเข้าสู่ระบบ ลองใหม่ได้เลย",
  expired: "ลิงก์หมดอายุ เข้าสู่ระบบใหม่อีกครั้ง",
  server: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
  setup: "ระบบยังไม่พร้อม ติดต่อ mr.tpat3@gmail.com",
};

/**
 * "คอร์สของฉัน" — ทุกอย่างที่อีเมลนี้ซื้อไว้: ปุ่มเข้าห้องสอบ/ดูผล + ไฟล์ทุกไฟล์โหลดซ้ำได้ตลอด
 * สิทธิ์ผูกกับอีเมล → ล็อกอินด้วยบัญชีอีเมลเดียวกับตอนสั่งซื้อ
 */
export default async function MyCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ login_error?: string; claimed?: string; already?: string; claim_error?: string }>;
}) {
  const user = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
  const { login_error: loginError, claimed, already, claim_error: claimError } = await searchParams;

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={null} next="/my-courses" />
        <main className="grid-paper flex flex-1 items-center justify-center px-4 py-14">
          <div className="w-full max-w-md border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
            <div className="border-b border-ink px-6 py-3">
              <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">
                คอร์สของฉัน
              </span>
            </div>
            <div className="px-6 py-8">
              <h1 className="font-display text-2xl font-bold text-ink">เข้าสู่ระบบ</h1>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">
                ใช้<strong>อีเมลเดียวกับที่สั่งซื้อ</strong> คอร์ส ไฟล์ และผลสอบจะรวมอยู่ที่นี่
              </p>
              <LoginButton next="/my-courses" className="mt-5" />
              {loginError && (
                <p className="mt-4 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm leading-relaxed text-maroon">
                  {LOGIN_ERRORS[loginError] ?? LOGIN_ERRORS.server}
                </p>
              )}
              <p className="mt-5 border-t border-dashed border-grid pt-4 text-sm leading-relaxed text-ink/75">
                ยังไม่มีคอร์ส?{" "}
                <a href="/#mock" className="font-bold text-maroon underline underline-offset-2 hover:no-underline">
                  ดูคอร์สทั้งหมด →
                </a>
              </p>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  let items: LibraryItem[] = [];
  let loadError = false;
  try {
    items = await getLibrary(user.email);
  } catch (err) {
    console.error("อ่านคอร์สของผู้ใช้ไม่สำเร็จ:", err);
    loadError = true;
  }

  const courses = deriveCourses(items);
  // แถบแจ้งผลจากปุ่ม "รับฟรี" (/api/claim) — เพิ่งรับสำเร็จ / มีอยู่แล้ว / รับไม่สำเร็จ
  const claimedTitle = claimed ? courseForProduct(claimed)?.title ?? "คอร์ส" : null;

  // สถานะห้องสอบ (สนามหลัก) — เฉพาะคนที่มีชุด Mock หรืออีเมลเจ้าของร้าน
  const exam = getExam();
  const hasMock = courses.some((c) => c.hasExam);
  const owner = isUnlimitedEmail(user.email);
  let examState: AttemptState = "none";
  if (hasMock || owner) {
    try {
      examState = (await getAttemptState(exam, user.email)).state;
    } catch (err) {
      console.error("อ่านสถานะการสอบไม่สำเร็จ:", err);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />
      <main className="flex-1">
        {/* แถบบัญชี */}
        <section className="grid-paper border-b border-grid">
          <div className="mx-auto max-w-6xl px-5 pt-6">
            <a
              href="/"
              className="inline-flex items-center gap-2 border border-ink/25 bg-white px-4 py-2 font-label text-sm font-semibold text-ink transition hover:border-maroon hover:text-maroon"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              กลับหน้าหลัก
            </a>
          </div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-10 pt-6">
            <div className="flex items-center gap-4">
              <Avatar user={user} size="h-14 w-14" />
              <div>
                <p className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">คอร์สของฉัน</p>
                <h1 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">
                  สวัสดี {user.name || "ผู้เรียน"}
                </h1>
                <p className="mt-1 text-sm text-ink/60">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 font-label text-sm">
              <a
                href={`/api/auth/logout?switch=1&next=${encodeURIComponent("/my-courses")}`}
                className="border border-ink/30 px-4 py-2 font-semibold text-ink transition hover:border-ink"
              >
                เปลี่ยนบัญชี
              </a>
              <a
                href={`/api/auth/logout?next=${encodeURIComponent("/")}`}
                className="border border-ink/30 px-4 py-2 font-semibold text-ink/70 transition hover:border-ink hover:text-ink"
              >
                ออกจากระบบ
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">
          {claimedTitle && (
            <p className="mb-6 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm leading-relaxed text-ink">
              {already ? (
                <>มี <strong>“{claimedTitle}”</strong> อยู่แล้ว</>
              ) : (
                <>
                  <strong className="text-maroon">รับ “{claimedTitle}” แล้ว ✓</strong> เปิดใช้ได้ด้านล่าง
                </>
              )}
            </p>
          )}
          {claimError && (
            <p className="mb-6 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">
              รับคอร์สไม่สำเร็จ ลองใหม่ หรือติดต่อ mr.tpat3@gmail.com
            </p>
          )}
          {loadError && (
            <p className="mb-6 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">
              โหลดไม่สำเร็จ รีเฟรชอีกครั้ง
            </p>
          )}

          {items.length === 0 && !loadError && (
            <div className="border border-dashed border-maroon/40 bg-white px-6 py-10 text-center">
              <p className="font-display text-xl font-bold text-ink">ยังไม่มีคอร์ส</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/65">
                ซื้อแล้วแต่ไม่เห็น? ลอง{" "}
                <a
                  href={`/api/auth/logout?switch=1&next=${encodeURIComponent("/my-courses")}`}
                  className="font-semibold text-maroon underline underline-offset-2"
                >
                  เปลี่ยนบัญชี
                </a>{" "}
                เป็นอีเมลที่ใช้ซื้อ หรือติดต่อ mr.tpat3@gmail.com
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ClaimButton productId="sum4" label="รับเนื้อหา TPAT3 ฟรี" source="my_courses_empty" />
                <a
                  href="/#mock"
                  className="inline-flex items-center border border-maroon px-6 py-3 font-bold text-maroon transition hover:bg-maroon hover:text-paper"
                >
                  ดูชุด Mock TPAT3 →
                </a>
              </div>
            </div>
          )}

          {(courses.length > 0 || owner) && (
            <div className="grid gap-6 md:grid-cols-2">
              {courses.map((c) => (
                <CourseCard key={c.slug} course={c} examState={examState} />
              ))}
              {owner && !hasMock && (
                <OwnerExamCard examState={examState} />
              )}
            </div>
          )}

          {items.length > 0 && (
            <p className="mt-8 font-label text-xs leading-relaxed text-ink/50">
              ดาวน์โหลดอาจใช้เวลา 2–3 วินาที · ไม่มีวันหมดอายุ · ห้ามเผยแพร่ต่อ
            </p>
          )}
        </section>

        {/* คอร์สอื่นที่ยังไม่มี */}
        <MoreCourses items={items} />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------- การ์ดคอร์สที่ซื้อแล้ว ---------- */
function CourseCard({ course: lc, examState }: { course: LibraryCourse; examState: AttemptState }) {
  const { item, hasExam } = lc;
  const course = getCourse(lc.slug);

  let links: DownloadLink[] = [];
  try {
    links = buildDownloadLinks({
      id: item.orderId,
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      product: { ...PRODUCTS[item.productId], files: lc.files },
    });
  } catch (err) {
    console.error("สร้างลิงก์ดาวน์โหลดในหน้าคอร์สของฉันไม่สำเร็จ:", err);
  }

  const purchased = new Date(item.purchasedAt).toLocaleDateString("th-TH", { dateStyle: "long" });

  return (
    <article className="flex flex-col border border-grid bg-white p-6 md:p-7">
      <div className="flex gap-5">
        {course && (
          <a href={`/courses/${course.slug}`} className="flex shrink-0 items-start">
            {course.covers.slice(-2).map((c, i, arr) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.src}
                src={c.src}
                alt={c.alt}
                className={`w-[84px] border border-grid bg-white shadow-[0_12px_26px_-14px_rgba(36,16,22,0.5)] ${
                  arr.length > 1 ? (i === 0 ? "-rotate-[5deg]" : "z-10 -ml-6 mt-2 rotate-[5deg]") : ""
                }`}
                style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
              />
            ))}
          </a>
        )}
        <div className="min-w-0">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
            {hasExam ? "คอร์ส + ห้องสอบออนไลน์" : "คอร์ส"}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold leading-snug text-ink">
            {course ? <a href={`/courses/${course.slug}`} className="hover:text-maroon">{course.title}</a> : item.productName}
          </h2>
          <p className="mt-1.5 font-label text-xs text-ink/55">
            {PRODUCTS[item.productId].price === 0 ? "รับเมื่อ" : "ซื้อเมื่อ"} {purchased}
          </p>
        </div>
      </div>

      {hasExam && <ExamButton state={examState} />}

      <div className="mt-6">
        <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">ไฟล์</p>
        <div className="mt-2.5 space-y-2.5">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              download={l.downloadName}
              className="flex w-full items-center justify-between gap-3 border border-ink bg-white px-4 py-3 text-[0.95rem] font-semibold text-ink transition hover:bg-ink hover:text-paper"
            >
              <span className="text-left leading-snug">{l.label}</span>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" />
              </svg>
            </a>
          ))}
          {links.length === 0 && (
            <p className="text-sm text-maroon">โหลดลิงก์ไม่สำเร็จ รีเฟรชอีกครั้ง</p>
          )}
        </div>
        {hasExam && examState !== "submitted" && (
          <p className="mt-2 font-label text-[12px] leading-snug text-ink/55">
            แนะนำเปิดเฉลยหลังสอบเสร็จ
          </p>
        )}
      </div>
    </article>
  );
}

/* ---------- ปุ่มห้องสอบตามสถานะ ---------- */
function ExamButton({ state }: { state: AttemptState }) {
  const cfg =
    state === "submitted"
      ? { href: "/exam/results", label: "ดูผลสอบ", sub: "ส่งแล้ว · เปิดดูได้ตลอด" }
      : state === "in_progress"
        ? { href: "/exam", label: "ทำข้อสอบต่อ — เวลากำลังเดิน", sub: "เริ่มสอบไปแล้ว" }
        : { href: "/exam", label: "เริ่มสอบ · 70 ข้อ · 3 ชม.", sub: "สอบได้ 1 รอบ" };
  return (
    <div className="mt-6">
      <a
        href={cfg.href}
        className="flex w-full items-center justify-center gap-3 bg-maroon px-5 py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
      >
        {cfg.label}
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
      <p className="mt-2 text-center font-label text-xs text-ink/55">{cfg.sub} · แนะนำทำในคอมพิวเตอร์หรือ iPad</p>
    </div>
  );
}

/* ---------- เจ้าของร้าน: เข้าห้องสอบได้เสมอแม้ไม่มีคำสั่งซื้อ ---------- */
function OwnerExamCard({ examState }: { examState: AttemptState }) {
  return (
    <article className="flex flex-col border border-dashed border-maroon/50 bg-white p-6 md:p-7">
      <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">สิทธิ์เจ้าของร้าน</p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink">ห้องสอบ Mock TPAT3 (ทดสอบระบบ)</h2>
      <p className="mt-1.5 text-sm text-ink/60">สอบได้ไม่จำกัด ผลรอบใหม่แทนที่รอบเก่า</p>
      <ExamButton state={examState} />
    </article>
  );
}

/* ---------- คอร์สที่ยังไม่มีในบัญชี (เล่มเนื้อหาแจกฟรี → กดรับได้จากตรงนี้เลย · Mock → ไปหน้าคอร์ส) ---------- */
function MoreCourses({ items }: { items: LibraryItem[] }) {
  const owned = new Set(items.flatMap((i) => i.files));
  const missing = COURSES.filter(
    (c) => !PRODUCTS[c.productId].retired && !PRODUCTS[c.productId].files.every((f) => owned.has(f))
  );
  // มีครบทุกไฟล์แล้ว → ไม่ต้องเสนออะไร · ไม่มีอะไรเลย → กล่องด้านบนมีปุ่มอยู่แล้ว
  if (missing.length === 0 || items.length === 0) return null;
  return (
    <section className="border-t border-grid bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="font-display text-xl font-bold text-ink">คอร์สอื่น</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {missing.map((c) => {
            const p = PRODUCTS[c.productId];
            return (
              <div key={c.slug} className="flex flex-wrap items-center gap-4 border border-grid bg-white p-4">
                <a href={`/courses/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.covers[c.covers.length - 1].src}
                    alt={c.covers[c.covers.length - 1].alt}
                    className="w-14 border border-grid"
                    style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
                  />
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-ink hover:text-maroon">{c.title}</span>
                    <span className="mt-0.5 block text-sm text-ink/60">{c.tagline}</span>
                    <span className="mt-1 block font-display font-bold text-maroon">
                      {p.price === 0 ? "ฟรี" : `฿${p.price.toLocaleString()}`}
                    </span>
                  </span>
                </a>
                {p.price === 0 && (
                  <ClaimButton productId={p.id} label="รับฟรี" source="my_courses_more" className="px-4 py-2.5 text-sm" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
