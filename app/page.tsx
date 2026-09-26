"use client";

import { useEffect, useState } from "react";
import AccountButton, { ClientUser, fetchCurrentUser } from "@/components/AccountButton";
import ClaimButton from "@/components/ClaimButton";
import Gear from "@/components/Gear";
import SiteFooter from "@/components/SiteFooter";
import { PRODUCTS, Product } from "@/lib/catalog";
import { courseForProduct } from "@/lib/courses";
import { trackEvent } from "@/lib/analytics";

type ExamState = "eligible" | "in_progress" | "submitted";

/* หน้าแรก — โครง "จดหมายจากพี่มาโก้" ที่เจ้าของอนุมัติ 2026-09-16 ปรับเป็น "แจกฟรี" 2026-09-26 (เจ้าของสั่ง):
   - ไม่มีราคา ไม่มีฟอร์มสั่งซื้อ ไม่มี Bundles ไม่มีปุ่มโหลดตัวอย่าง/เดโม (ทุกอย่างฟรีแล้ว ไม่ต้องมีตัวอย่าง)
   - ปุ่มหลักของทุกการ์ดคือ "รับฟรี" → /api/claim (ล็อกอิน Google → ได้คอร์สทันทีที่ "คอร์สของฉัน")
   - คำทักทายเป็นจดหมายตัวใหญ่บนกระดาษตาราง + เฟืองหมุน + การ์ดขาว 2 ใบ + FAQ เหมือนเดิม */
export default function Home() {
  const [examState, setExamState] = useState<ExamState | null>(null);
  // undefined = กำลังถาม server · null = ยังไม่ล็อกอิน
  const [user, setUser] = useState<ClientUser | null | undefined>(undefined);
  const [claimError, setClaimError] = useState(false);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", referrer: document.referrer }),
    }).catch(() => {});
  }, []);

  // /api/claim เด้งกลับมาที่นี่ถ้าคอร์สที่ขอไม่มีอยู่ (?claim_error=unknown) — บอกให้กดใหม่จากปุ่มบนหน้า
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("claim_error")) {
      setClaimError(true);
      window.history.replaceState(null, "", "/"); // เก็บ URL ให้สะอาด กันขึ้นซ้ำตอนรีเฟรช
    }
  }, []);

  // เช็คสถานะห้องสอบแล้วเปลี่ยนปุ่ม hero: ยังไม่ทำ → "เข้าห้องสอบ", ทำแล้ว → "ดูผลสอบ"
  // ล็อกอินอยู่ = เช็คจากบัญชี Google · ไม่ได้ล็อกอิน = ใช้โทเค็นที่เครื่องนี้เคยเข้าห้องสอบไว้
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await fetchCurrentUser();
      if (cancelled) return;
      setUser(u);
      let body: { useSession: true } | { token: string } | null = null;
      if (u) {
        body = { useSession: true };
      } else {
        let token = "";
        try {
          token = localStorage.getItem("exam.token") ?? "";
        } catch {}
        if (token) body = { token };
      }
      if (!body) return;
      const data = await fetch("/api/exam/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      if (cancelled || !data) return;
      if (data.state === "eligible" || data.state === "in_progress" || data.state === "submitted") {
        setExamState(data.state);
        if (data.token) {
          try {
            localStorage.setItem("exam.token", data.token);
          } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href="/" className="flex items-center gap-2.5" aria-label="Mr.tpat3 หน้าแรก">
            <Gear teeth={10} className="h-7 w-7 text-maroon" spin="cw" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">Mr.tpat3</span>
          </a>
          <nav className="hidden items-center gap-8 md:flex" aria-label="เมนูหลัก">
            <a href="#mock" className="text-base font-semibold text-ink/60 transition hover:text-maroon">ข้อสอบ Mock</a>
            <a href="#content" className="text-base font-semibold text-ink/60 transition hover:text-maroon">ไฟล์เนื้อหา</a>
            <a href="#faq" className="text-base font-semibold text-ink/60 transition hover:text-maroon">ข้อสงสัย</a>
            <a href="/about" className="text-base font-semibold text-ink/60 transition hover:text-maroon">เกี่ยวกับพี่</a>
          </nav>
          <AccountButton user={user} />
        </div>
      </header>

      {/* ===== Hero: จดหมายจากพี่ (คำทักทายเป็นพระเอกของหน้า) ===== */}
      <section className="grid-paper relative overflow-hidden border-b border-grid">
        <Gear teeth={16} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-maroon/[0.07]" spin="cw" />
        <Gear teeth={12} className="pointer-events-none absolute right-28 top-40 hidden h-36 w-36 text-steel/20 md:block" spin="ccw" />
        <Gear teeth={14} className="pointer-events-none absolute -bottom-16 left-[-3rem] h-56 w-56 text-maroon/[0.06]" spin="ccw" />

        <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-24 lg:py-32">
          <p className="mb-5 inline-flex items-center gap-2 border border-maroon bg-white px-3.5 py-1.5 font-label text-xs font-bold uppercase tracking-[0.22em] text-maroon">
            แจกฟรีทั้งหมด · ไม่มีค่าใช้จ่าย
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.2] tracking-tight text-maroon">
            สวัสดีครับน้อง ๆ
          </h1>
          <p className="mt-5 max-w-[960px] text-[clamp(1.4rem,2.7vw,2.15rem)] leading-[1.6] text-ink md:mt-7">
            พี่ชื่อ <strong className="font-semibold text-maroon">มาโก้ ศุภวัฒน์</strong> กำลังศึกษาอยู่ที่{" "}
            <strong className="font-semibold text-maroon">วิศวคอม จุฬาฯ</strong> พี่และเพื่อน ๆ ในกลุ่มได้รวมหัวกันออกแบบ{" "}
            <strong className="font-semibold text-maroon">Mock TPAT3</strong> และ
            <strong className="font-semibold text-maroon">เนื้อหาสำหรับสอบ TPAT3</strong>{" "}
            <strong className="font-semibold text-maroon">แจกฟรีให้น้อง ๆ ทุกคน</strong> แค่ล็อกอินด้วย Google
            ก็รับไปใช้ได้เลย เลื่อนดูด้านล่าง<span className="whitespace-nowrap">ได้เลยครับ</span>
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5 md:mt-14">
            {/* ปุ่มหลักคือ "เข้าห้องสอบ" ตั้งแต่เปิดหน้าแรก — คนยังไม่มีสิทธิ์กดได้เหมือนกัน
                แล้วไปเจอหน้ายืนยันตัวตนที่ /exam (ไม่มีสิทธิ์จะมีปุ่มรับชุด Mock ฟรีให้ตรงนั้น)
                ถ้าเครื่องนี้เคยสอบแล้ว ปุ่มจะเปลี่ยนเป็นทำต่อ/ดูผลอัตโนมัติ */}
            <a
              href={examState === "submitted" ? "/exam/results" : "/exam"}
              onClick={() => trackEvent("click_exam_cta", { state: examState ?? "visitor" })}
              className="group inline-flex items-center justify-center gap-2.5 bg-maroon px-7 py-4 text-[1.1rem] font-semibold text-white transition hover:bg-maroon-dark max-sm:w-full"
            >
              {examState === "in_progress"
                ? "ทำข้อสอบต่อ — เวลากำลังเดิน"
                : examState === "submitted"
                  ? "ดูผลสอบ + บทวิเคราะห์"
                  : "เข้าห้องสอบ TPAT3"}
              <Arrow />
            </a>
            <a
              href="/about"
              className="group inline-flex items-center justify-center gap-2.5 border border-maroon px-7 py-4 text-[1.1rem] font-semibold text-maroon transition hover:bg-maroon hover:text-white max-sm:w-full"
            >
              บทความเกี่ยวกับฉัน
              <Arrow />
            </a>
          </div>

          {examState !== "submitted" && (
            <p className="mt-4 text-sm text-ink/60">แนะนำให้ทำในคอมพิวเตอร์ หรือ iPad · 1 บัญชีมีสิทธิ์สอบ 1 รอบ</p>
          )}
        </div>
      </section>

      {/* ===== ของฟรี 2 อย่าง (พื้นขาวเฉพาะส่วนนี้ — เจ้าของขอ) ===== */}
      <section id="mock" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <SectionHead
            title="พี่แจกฟรี 2 อย่าง"
            note="ล็อกอินด้วยบัญชี Google แล้วกดรับ ไม่ต้องกรอกอะไร ไม่มีค่าใช้จ่าย"
          />

          {claimError && (
            <p className="mb-6 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">
              ไม่พบคอร์สที่ขอรับ — กดปุ่ม “รับฟรี” จากการ์ดด้านล่างอีกครั้งได้เลย
            </p>
          )}

          <div className="grid gap-5">
            {/* การ์ด Mock */}
            <ProductCard
              cover={<MockStack />}
              courseHref={courseHref(PRODUCTS.mock1)}
              kicker="ข้อสอบ Mock · ชุดที่ 1"
              title="ข้อสอบ Mock TPAT3"
              desc="ห้องสอบออนไลน์ 70 ข้อ จับเวลา 3 ชม. ส่งแล้วรู้คะแนน อันดับ และบทที่ต้องซ่อมทันที พร้อมไฟล์เฉลยละเอียดทีละขั้น"
              includes={["ห้องสอบออนไลน์ 1 ครั้ง", "ไฟล์โจทย์ + เฉลยละเอียด (PDF)", "กระดาษคำตอบ"]}
              product={PRODUCTS.mock1}
              claimLabel="รับชุดข้อสอบฟรี"
            />

            {/* รับฟรีแล้วทำอะไรต่อ (ลำดับจริง 3 ขั้น) — วางใต้การ์ด Mock ตามที่เจ้าของขอ */}
            <div id="how" className="scroll-mt-20 py-4 md:py-7">
              <SectionHead
                small
                title="รับฟรีแล้วทำอะไรต่อ"
                note="ทุกอย่างอยู่ในบัญชี Google ที่ใช้รับ กลับมาเปิดได้ตลอดทุกเครื่อง"
              />
              <div className="grid gap-6 md:grid-cols-3 md:gap-10 lg:gap-14">
                <Step
                  n="ขั้นที่ 1"
                  title="ล็อกอิน Google แล้วกดรับฟรี"
                  text="ไม่ต้องกรอกอะไร ไม่มีค่าใช้จ่าย คอร์สโผล่ที่หน้า “คอร์สของฉัน” ทันที ใช้บัญชีเดียวกับที่จะเข้าสอบ"
                />
                <Step
                  n="ขั้นที่ 2"
                  title="เข้าห้องสอบออนไลน์"
                  text="กด “เริ่มสอบ” ได้ทันที ระบบจับเวลา 3 ชั่วโมงและบันทึกคำตอบให้อัตโนมัติ เน็ตหลุดหรือรีเฟรชก็ทำต่อได้"
                />
                <Step
                  n="ขั้นที่ 3"
                  title="รู้ผลทันทีที่ส่ง"
                  text="คะแนนเต็ม 100 อันดับเทียบผู้สอบคนอื่น วิเคราะห์รายข้อครบ 70 ข้อ แล้วเปิดเฉลยละเอียดที่หน้า “คอร์สของฉัน”"
                />
              </div>
            </div>

            {/* การ์ดเนื้อหา */}
            <ProductCard
              id="content"
              cover={
                <div className="mx-auto w-full max-w-[232px]">
                  <Cover src="/covers/tpat3-content.png" alt="ปกเนื้อหาทั้งหมดสำหรับสอบ TPAT3" />
                </div>
              }
              courseHref={courseHref(PRODUCTS.sum4)}
              kicker="ไฟล์เนื้อหา · Part 1–5"
              title="เนื้อหาทั้งหมดสำหรับสอบ TPAT3"
              desc="ครบทั้ง 5 พาร์ตของข้อสอบจริง รวมในไฟล์เดียว 174 หน้า อ่านจบแล้วไปทำ Mock ต่อได้เลย"
              includes={["ไฟล์ PDF 1 ไฟล์ · 174 หน้า", "Part 1–5 ครบ 38 บท", "อยู่ในบัญชี Google ของน้องถาวร"]}
              product={PRODUCTS.sum4}
              claimLabel="รับเล่มนี้ฟรี"
            />
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-5 py-14 md:py-24">
          <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-snug tracking-tight text-ink">ข้อสงสัย</h2>

          <div className="mt-8 divide-y divide-grid border-y border-grid">
            <FaqItem
              q="ฟรีจริงไหม? มีเงื่อนไขอะไรหรือเปล่า?"
              a="ฟรีจริง ไม่มีค่าใช้จ่าย ไม่มีเก็บเงินทีหลัง เงื่อนไขเดียวคือล็อกอินด้วยบัญชี Google เพื่อผูกคอร์สกับบัญชีของน้อง จะได้กลับมาเปิดได้ตลอดทุกเครื่อง"
            />
            <FaqItem
              q="รับฟรียังไง?"
              a="กดปุ่ม “รับฟรี” ที่การ์ดด้านบน ล็อกอินด้วย Google แล้วระบบเปิดสิทธิ์ให้ทันที ไม่ต้องกรอกอะไร คอร์สจะอยู่ที่หน้า “คอร์สของฉัน” อยากได้ทั้งสองอย่างก็กดรับทั้งสองการ์ด"
            />
            <FaqItem
              q="ทำข้อสอบออนไลน์ยังไง? ต้องเตรียมอะไร?"
              a="รับชุด Mock แล้วเข้าหน้าห้องสอบด้วยบัญชี Google เดียวกัน กดเริ่ม ระบบจะจับเวลา 3 ชั่วโมงและบันทึกคำตอบให้อัตโนมัติ (เน็ตหลุดหรือรีเฟรชก็ทำต่อได้) แนะนำให้ทำในคอมพิวเตอร์หรือ iPad เพื่อให้เห็นโจทย์ชัดเต็มตา"
            />
            <FaqItem
              q="ทำข้อสอบออนไลน์ได้กี่รอบ? ทำเสร็จแล้วได้อะไร?"
              a="1 บัญชีมีสิทธิ์สอบ 1 รอบ เหมือนสอบจริง ส่งกระดาษคำตอบแล้วรู้ผลทันที — คะแนนเต็ม 100 อันดับเทียบผู้สอบคนอื่น ค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน กราฟการแจกแจงคะแนน คะแนนรายตอน และวิเคราะห์รายข้อครบ 70 ข้อ พร้อมคำแนะนำเฉพาะข้อว่าควรซ่อมตรงไหน"
            />
            <FaqItem
              q="ได้อะไรบ้าง?"
              a="ชุด Mock ได้ห้องสอบ TPAT3 ออนไลน์ 1 ครั้งพร้อมผลวิเคราะห์ + ไฟล์เฉลยละเอียด (PDF) · เนื้อหาทั้งหมดสำหรับสอบ TPAT3 ได้ไฟล์ PDF 1 ไฟล์ (Part 1–5 ครบ 174 หน้า) · ทุกอย่างอยู่ในบัญชี Google ของน้องถาวร ไม่มีวันหมดอายุ"
            />
            <FaqItem
              q="กดรับแล้วแต่ไม่เห็นคอร์ส ทำยังไงดี?"
              a="ตรวจว่าล็อกอินด้วยบัญชี Google เดียวกับตอนกดรับ (กด “เปลี่ยนบัญชี” ที่หน้าคอร์สของฉันได้) ถ้ายังไม่เห็น กดรับใหม่ได้เลยไม่มีอะไรเสียหาย หรือติดต่อ mr.tpat3@gmail.com"
            />
            <FaqItem
              q="เอาไฟล์ไปแชร์ต่อได้ไหม?"
              a="ไฟล์แจกให้ใช้อ่านส่วนตัวเท่านั้น ไม่อนุญาตให้เผยแพร่ต่อ อยากให้เพื่อนได้ด้วย ส่งลิงก์เว็บนี้ให้เพื่อนกดรับเองได้เลย ฟรีเหมือนกัน"
            />
          </div>

          <p className="mt-8 text-center font-label text-sm text-ink/55">
            มีคำถามเพิ่มเติม? ติดต่อ{" "}
            <a href="mailto:mr.tpat3@gmail.com" className="font-semibold text-maroon underline-offset-2 hover:underline">
              mr.tpat3@gmail.com
            </a>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ---------- ลิงก์ไปหน้ารายละเอียดคอร์สของสินค้า ---------- */
function courseHref(product: Product) {
  return `/courses/${courseForProduct(product.id)?.slug ?? ""}`;
}

/* ---------- ลูกศรท้ายปุ่ม (ขยับขวานิดตอนโฮเวอร์) ---------- */
function Arrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} transition group-hover:translate-x-1`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

/* ---------- หัวข้อของแต่ละส่วน: ชื่อซ้าย คำอธิบายสั้นขวา ---------- */
function SectionHead({ title, note, small = false }: { title: string; note?: string; small?: boolean }) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 ${small ? "mb-6 md:mb-8" : "mb-8 md:mb-11"}`}>
      <h2
        className={`font-display font-semibold leading-snug tracking-tight text-ink ${
          small ? "text-[clamp(1.4rem,2.6vw,1.8rem)]" : "text-[clamp(1.7rem,3.4vw,2.4rem)]"
        }`}
      >
        {title}
      </h2>
      {note && <p className="max-w-[40ch] text-[1.05rem] text-ink/60">{note}</p>}
    </div>
  );
}

/* ---------- ขั้นตอนหลังรับฟรี (ขีดบนสีเลือดหมู + เลขขั้น) ---------- */
function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="border-t-2 border-maroon pt-4">
      <p className="font-label text-xs font-bold uppercase tracking-[0.22em] text-maroon">{n}</p>
      <h3 className="mt-1 font-display text-[1.3rem] font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-ink/60">{text}</p>
    </div>
  );
}

/* ---------- การ์ดคอร์ส: ปกซ้าย รายละเอียด + "ฟรี" + ปุ่มรับขวา ---------- */
function ProductCard({
  id, cover, courseHref, kicker, title, desc, includes, product, claimLabel,
}: {
  id?: string;
  cover: React.ReactNode;
  courseHref: string;
  kicker: string;
  title: string;
  desc: string;
  includes: string[];
  product: Product;
  claimLabel: string;
}) {
  return (
    // คลิกตรงไหนของการ์ดก็ได้ = ไปหน้ารายละเอียดคอร์ส (เจ้าของขอ 2026-09-16)
    // ทำด้วยลิงก์ "ดูรายละเอียดคอร์ส" ที่ขยาย ::after คลุมทั้งการ์ด — ปุ่มรับฟรีลอยอยู่บน (z-10) เลยยังกดของตัวเองได้
    <article
      id={id}
      className="group relative grid scroll-mt-20 items-center gap-7 border border-grid bg-white p-7 transition hover:border-maroon sm:grid-cols-[220px_1fr] md:grid-cols-[300px_1fr] md:gap-12 md:p-11"
    >
      <div>{cover}</div>
      <div>
        <p className="font-label text-xs font-semibold uppercase tracking-[0.22em] text-maroon">{kicker}</p>
        <h3 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold leading-snug text-ink">{title}</h3>
        <p className="mt-3 max-w-[52ch] text-[1.1rem] leading-relaxed text-ink">{desc}</p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.95rem] text-ink/60">
          {includes.map((item) => (
            <li key={item}>
              <span className="mr-1.5 font-bold text-maroon">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-6 h-1 w-10 bg-maroon" />
        <p className="mt-4 font-display text-[2rem] font-bold leading-none tracking-tight text-maroon">
          ฟรี{" "}
          <span className="text-[0.95rem] font-medium tracking-normal text-ink/50">ไม่มีค่าใช้จ่าย · ไม่มีวันหมดอายุ</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ClaimButton productId={product.id} label={claimLabel} source="home" className="relative z-10" />
          <a
            href={courseHref}
            aria-label={`ดูรายละเอียดคอร์ส ${title}`}
            className="ml-1 inline-flex items-center gap-1.5 font-semibold text-maroon underline-offset-4 after:absolute after:inset-0 after:z-[1] after:content-[''] group-hover:underline"
          >
            ดูรายละเอียดคอร์ส
            <Arrow className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* ---------- ปกหนังสือ (รูปภาพ) ----------
   ไฟล์รูปอยู่ที่ public/covers/*.png — สัดส่วนปก 1792×2400 (3:4) */
function Cover({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="block w-full border border-grid bg-white shadow-[0_16px_36px_-18px_rgba(36,16,22,0.5)] transition group-hover:-translate-y-1"
      style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
    />
  );
}

/* ---------- สแตกปก Mock + กระดาษคำตอบ (วางเหลื่อมซ้อนกัน) ---------- */
function MockStack() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]" style={{ aspectRatio: "1 / 1.12" }}>
      {/* กระดาษคำตอบ — เหลื่อมอยู่ด้านหลังขวา เอียงเล็กน้อย (แสดงเต็มสัดส่วนจริง ไม่ครอบ) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/covers/answersheet.png"
        alt="กระดาษคำตอบ Mock TPAT3"
        loading="lazy"
        className="absolute right-0 top-0 h-auto w-[64%] rotate-[6deg] border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.45)]"
      />
      {/* ปก Mock — อยู่ด้านหน้าซ้าย เอียงสวนทาง */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/covers/mock.png"
        alt="ปกข้อสอบ Mock TPAT3"
        loading="lazy"
        className="absolute bottom-0 left-0 h-auto w-[72%] -rotate-[4deg] border border-grid bg-white shadow-[0_20px_40px_-16px_rgba(36,16,22,0.6)] transition group-hover:-translate-y-1"
      />
    </div>
  );
}

/* ---------- รายการคำถาม FAQ ---------- */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[1.05rem] font-semibold text-ink marker:content-none">
        {q}
        <span className="grid h-6 w-6 shrink-0 place-items-center border border-ink/30 text-sm text-maroon transition group-open:rotate-45 group-open:border-maroon">
          +
        </span>
      </summary>
      <p className="mt-2 pr-0 text-base leading-relaxed text-ink/65 md:pr-12">{a}</p>
    </details>
  );
}
