"use client";

import { useEffect, useState } from "react";
import BuyModal from "@/components/BuyModal";
import AccountButton, { ClientUser, fetchCurrentUser } from "@/components/AccountButton";
import Gear from "@/components/Gear";
import SiteFooter from "@/components/SiteFooter";
import { getProduct, PRODUCTS, Product } from "@/lib/catalog";
import { courseForProduct } from "@/lib/courses";
import { trackEvent } from "@/lib/analytics";

type ExamState = "eligible" | "in_progress" | "submitted";

/* หน้าแรกแบบใหม่ (เจ้าของอนุมัติ 2026-09-16 จากตัวอย่าง https://claude.ai/artifact/1ReGvb49DjfUFuTdJaq6gS)
   - คำทักทายของพี่มาโก้เป็น "จดหมาย" ตัวใหญ่แทน hero เดิม บนกระดาษตาราง + เฟืองหมุนแบบเดิม
   - สินค้า 2 อย่างเป็นการ์ดขาวบนพื้นขาว มี "ซื้อแล้วทำอะไรต่อ" 3 ขั้นคั่นใต้การ์ด Mock
   - Bundles เหลือครบเซ็ตการ์ดเดียว ติดปกสองเล่ม ไม่มีเงาฟุ้ง
   - เอาบรรทัดลายเซ็น/คะแนนออกตามที่เจ้าของสั่ง */
export default function Home() {
  const [buying, setBuying] = useState<Product | null>(null);
  const [examState, setExamState] = useState<ExamState | null>(null);
  // undefined = กำลังถาม server · null = ยังไม่ล็อกอิน
  const [user, setUser] = useState<ClientUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", referrer: document.referrer }),
    }).catch(() => {});
  }, []);

  // มาจากลิงก์ "สั่งซื้อชุดข้อสอบ" (เช่น จากหน้าห้องสอบ) — เปิดฟอร์มสั่งซื้อให้เลย
  // อ่านจาก window แทน useSearchParams เพื่อไม่ต้องครอบหน้าแรกด้วย Suspense
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("buy");
    const product = id ? getProduct(id) : null;
    if (product) {
      // นับเหมือนกดปุ่มสั่งซื้อ (มาจากลิงก์ในหน้าห้องสอบ) ไม่งั้นกรวยการขายจะขาดช่วงนี้ไป
      trackEvent("open_buy_form", {
        product_id: product.id,
        value: product.price,
        currency: "THB",
        source: "exam_gate_link",
      });
      setBuying(product);
      window.history.replaceState(null, "", "/"); // เก็บ URL ให้สะอาด กันเปิดซ้ำตอนรีเฟรช
    }
  }, []);

  // เช็คสถานะผู้ซื้อแล้วเปลี่ยนปุ่ม hero: ยังไม่ทำ → "เข้าห้องสอบ", ทำแล้ว → "ดูผลสอบ"
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

  // ทุกปุ่มสั่งซื้อบนหน้านี้เรียกผ่านตัวนี้ — นับเป็นเหตุการณ์ "เปิดฟอร์มสั่งซื้อ" ที่เดียวจบ
  const buy = (p: Product) => {
    trackEvent("open_buy_form", { product_id: p.id, value: p.price, currency: "THB" });
    setBuying(p);
  };

  const bundle = PRODUCTS["bundle-all"];
  const bundleSave = bundle.compareAt ? bundle.compareAt - bundle.price : 0;

  return (
    <div className="min-h-screen">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href="/" className="flex items-center gap-2.5" aria-label="Mr.tpat3 หน้าแรก">
            <Gear teeth={10} className="h-7 w-7 text-maroon" spin="cw" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">Mr.tpat3</span>
            <span className="hidden font-label text-[0.8rem] font-semibold tracking-[0.22em] text-maroon sm:inline">TPAT3 · ฟิสิกส์</span>
          </a>
          <nav className="hidden items-center gap-8 md:flex" aria-label="เมนูหลัก">
            <a href="#mock" className="text-base font-semibold text-ink/60 transition hover:text-maroon">ข้อสอบ Mock</a>
            <a href="#content" className="text-base font-semibold text-ink/60 transition hover:text-maroon">ไฟล์เนื้อหา</a>
            <a href="#bundles" className="text-base font-semibold text-ink/60 transition hover:text-maroon">Bundles</a>
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
          <p className="font-label text-xs font-semibold uppercase tracking-[0.22em] text-maroon">
            Mock TPAT3 · Physics A-Level · by Mr.tpat3
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.2] tracking-tight text-maroon md:mt-8">
            สวัสดีครับน้อง ๆ
          </h1>
          <p className="mt-5 max-w-[960px] text-[clamp(1.4rem,2.7vw,2.15rem)] leading-[1.6] text-ink md:mt-7">
            พี่ชื่อ <strong className="font-semibold text-maroon">มาโก้ ศุภวัฒน์</strong> กำลังศึกษาอยู่ที่{" "}
            <strong className="font-semibold text-maroon">วิศวคอม จุฬาฯ</strong> พี่และเพื่อน ๆ ในกลุ่มได้รวมหัวกันออกแบบ{" "}
            <strong className="font-semibold text-maroon">Mock TPAT3</strong> และ
            <strong className="font-semibold text-maroon">เนื้อหาสำหรับสอบ TPAT3</strong> หากน้องสนใจ
            สามารถเลื่อนดูด้านล่าง<span className="whitespace-nowrap">ได้เลยครับ</span>
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5 md:mt-14">
            {/* ปุ่มหลักคือ "เข้าห้องสอบ" ตั้งแต่เปิดหน้าแรก — คนยังไม่ซื้อกดได้เหมือนกัน
                แล้วไปเจอหน้ายืนยันตัวตนที่ /exam (ไม่มีสิทธิ์จะมีลิงก์พาไปหน้าขายให้)
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

      {/* ===== สินค้า 2 อย่าง (พื้นขาวเฉพาะส่วนนี้ — เจ้าของขอ) ===== */}
      <section id="mock" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <SectionHead title="พี่ทำไว้ให้ 2 อย่าง" note="ทั้งสองอย่างมีตัวอย่างให้โหลดดูฟรีก่อนตัดสินใจ ไม่ต้องกรอกอะไร" />

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
              unit="/ ชุด"
              buyLabel={`สั่งซื้อชุดข้อสอบ · ฿${PRODUCTS.mock1.price.toLocaleString()}`}
              onBuy={buy}
              // ไฟล์เดียว = โจทย์ 4 ข้อ + เฉลยละเอียด (สร้างด้วย Desktop/Project/MOCK/_build-sarabun/demo/make_sample.py)
              sample={{ href: "/samples/tpat3-mock-sample.pdf", downloadName: "TPat3 Mock Sample.pdf", label: "โหลดตัวอย่างโจทย์ + เฉลยฟรี (PDF)" }}
            />

            {/* ซื้อแล้วทำอะไรต่อ (ลำดับจริง 3 ขั้น) — วางใต้การ์ด Mock ตามที่เจ้าของขอ */}
            <div id="how" className="scroll-mt-20 py-4 md:py-7">
              <SectionHead
                small
                title="ซื้อแล้วทำอะไรต่อ"
                note="ทุกอย่างอยู่ในบัญชี Google ที่ใช้ซื้อ กลับมาเปิดได้ตลอดทุกเครื่อง"
              />
              <div className="grid gap-6 md:grid-cols-3 md:gap-10 lg:gap-14">
                <Step
                  n="ขั้นที่ 1"
                  title="ชำระเงินด้วย PromptPay"
                  text="สแกน QR ผ่านแอปธนาคาร ดำเนินการอย่างปลอดภัยผ่าน Stripe ใช้บัญชี Google อีเมลเดียวกับที่จะเข้าสอบ"
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
              desc="ครบทั้ง 5 พาร์ตของข้อสอบจริง รวมในไฟล์เดียว 160 หน้า อ่านจบแล้วไปทำ Mock ต่อได้เลย"
              includes={["ไฟล์ PDF 1 ไฟล์ · 160 หน้า", "Part 1–5 ครบ", "อยู่ในบัญชี Google ของน้องถาวร"]}
              product={PRODUCTS.sum4}
              unit="/ เล่ม"
              buyLabel={`สั่งซื้อเล่มนี้ · ฿${PRODUCTS.sum4.price.toLocaleString()}`}
              onBuy={buy}
              sample={{ href: "/samples/tpat3-summary1-sample.pdf", downloadName: "ตัวอย่างเนื้อหา TPAT3.pdf", label: "โหลดตัวอย่างเนื้อหาฟรี (PDF)" }}
            />
          </div>
        </div>
      </section>

      {/* ===== Bundles: ครบเซ็ตการ์ดเดียว บนกระดาษตาราง ===== */}
      <section id="bundles" className="grid-paper scroll-mt-20 border-y border-grid">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <SectionHead
            title="Bundles"
            note={`ซื้อครบเซ็ตถูกกว่าซื้อแยก ฿${bundleSave.toLocaleString()} และคนส่วนใหญ่เลือกชุดนี้`}
          />
          <BundleCard product={bundle} upsellFrom={PRODUCTS.mock1} onBuy={buy} />
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-5 py-14 md:py-24">
          <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-snug tracking-tight text-ink">ข้อสงสัย</h2>

          <div className="mt-8 divide-y divide-grid border-y border-grid">
            <FaqItem
              q="ซื้อแล้วทำอะไรต่อ?"
              a="ชำระเงินสำเร็จ กด “เริ่มสอบ” เข้าห้องสอบออนไลน์ได้ทันที ไฟล์เฉลยละเอียดและไฟล์เนื้อหาอยู่ที่หน้า “คอร์สของฉัน” (ล็อกอินด้วยบัญชี Google ที่ใช้ซื้อ) กลับมาโหลดได้ตลอดทุกเครื่อง แนะนำให้เปิดเฉลยหลังทำข้อสอบเสร็จ ผลวิเคราะห์จะได้ตรงกับฝีมือจริง"
            />
            <FaqItem
              q="ทำข้อสอบออนไลน์ยังไง? ต้องเตรียมอะไร?"
              a="เข้าหน้าห้องสอบแล้วล็อกอินด้วยบัญชี Google อีเมลเดียวกับที่สั่งซื้อ จากนั้นกดเริ่ม ระบบจะจับเวลา 3 ชั่วโมงและบันทึกคำตอบให้อัตโนมัติ (เน็ตหลุดหรือรีเฟรชก็ทำต่อได้) แนะนำให้ทำในคอมพิวเตอร์หรือ iPad เพื่อให้เห็นโจทย์ชัดเต็มตา"
            />
            <FaqItem
              q="ทำข้อสอบออนไลน์ได้กี่รอบ? ทำเสร็จแล้วได้อะไร?"
              a="1 อีเมลมีสิทธิ์สอบ 1 รอบ เหมือนสอบจริง ส่งกระดาษคำตอบแล้วรู้ผลทันที — คะแนนเต็ม 100 อันดับเทียบผู้สอบคนอื่น ค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน กราฟการแจกแจงคะแนน คะแนนรายตอน และวิเคราะห์รายข้อครบ 70 ข้อ พร้อมคำแนะนำเฉพาะข้อว่าควรซ่อมตรงไหน"
            />
            <FaqItem
              q="มีตัวอย่างให้ดูก่อนไหม?"
              a="มี — โหลดตัวอย่างโจทย์/เฉลย และตัวอย่างไฟล์เนื้อหาได้ฟรี ไม่ต้องกรอกอะไร เป็น PDF แบบเดียวกับไฟล์จริง"
            />
            <FaqItem
              q="ซื้อแล้วแต่ไม่เห็นคอร์ส ทำยังไงดี?"
              a="ตรวจว่าล็อกอินด้วยบัญชี Google เดียวกับตอนสั่งซื้อ (กด “เปลี่ยนบัญชี” ที่หน้าคอร์สของฉันได้) ถ้ายังไม่เห็น ติดต่อ mr.tpat3@gmail.com พร้อมแจ้งอีเมลที่ใช้ซื้อ"
            />
            <FaqItem
              q="จ่ายเงินยังไงได้บ้าง?"
              a="PromptPay สแกน QR ผ่านแอปธนาคาร ดำเนินการอย่างปลอดภัยผ่าน Stripe"
            />
            <FaqItem
              q="ได้อะไรบ้าง?"
              a="ชุด Mock ได้ห้องสอบ TPAT3 ออนไลน์ 1 ครั้งพร้อมผลวิเคราะห์ + ไฟล์เฉลยละเอียด (PDF) · เนื้อหาทั้งหมดสำหรับสอบ TPAT3 ได้ไฟล์ PDF 1 ไฟล์ (Part 1–5 ครบ 160 หน้า) · ทุกอย่างอยู่ในบัญชี Google ของคุณถาวร ไม่มีวันหมดอายุ"
            />
            <FaqItem
              q="ขอคืนเงินได้ไหม?"
              a="เป็นสินค้าดิจิทัลที่ได้รับไฟล์ทันที จึงขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาพิจารณาก่อนสั่งซื้อ"
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

      {buying && <BuyModal product={buying} user={user ?? null} onClose={() => setBuying(null)} />}
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

/* ---------- ขั้นตอนหลังซื้อ (ขีดบนสีเลือดหมู + เลขขั้น) ---------- */
function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="border-t-2 border-maroon pt-4">
      <p className="font-label text-xs font-bold uppercase tracking-[0.22em] text-maroon">{n}</p>
      <h3 className="mt-1 font-display text-[1.3rem] font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-ink/60">{text}</p>
    </div>
  );
}

/* ---------- การ์ดสินค้า: ปกซ้าย รายละเอียด+ราคา+ปุ่มขวา ---------- */
function ProductCard({
  id, cover, courseHref, kicker, title, desc, includes, product, unit, buyLabel, onBuy, sample,
}: {
  id?: string;
  cover: React.ReactNode;
  courseHref: string;
  kicker: string;
  title: string;
  desc: string;
  includes: string[];
  product: Product;
  unit: string;
  buyLabel: string;
  onBuy: (p: Product) => void;
  sample: { href: string; label: string; downloadName: string };
}) {
  return (
    <article
      id={id}
      className="group grid scroll-mt-20 items-center gap-7 border border-grid bg-white p-7 transition hover:border-maroon sm:grid-cols-[220px_1fr] md:grid-cols-[300px_1fr] md:gap-12 md:p-11"
    >
      {/* กดปก = เข้าหน้ารายละเอียดคอร์ส */}
      <a href={courseHref} className="block" aria-label={`ดูรายละเอียดคอร์ส ${title}`}>
        {cover}
      </a>
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
          ฿{product.price.toLocaleString()} <span className="text-[0.95rem] font-medium tracking-normal text-ink/50">{unit}</span>
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onBuy(product)}
            className="bg-maroon px-5 py-3.5 font-semibold text-white transition hover:bg-maroon-dark"
          >
            {buyLabel}
          </button>
          <SampleButton href={sample.href} downloadName={sample.downloadName} label={sample.label} />
          <a href={courseHref} className="ml-1 inline-flex items-center gap-1.5 font-semibold text-maroon underline-offset-4 hover:underline">
            ดูรายละเอียดคอร์ส
            <Arrow className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* ---------- ไอคอนดาวน์โหลด ---------- */
function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" />
    </svg>
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

/* ---------- ปุ่มโหลดไฟล์ตัวอย่าง ---------- */
function SampleButton({ href, label, downloadName }: { href: string; label: string; downloadName: string }) {
  return (
    <a
      href={href}
      download={downloadName}
      // นับเข้า GA เพื่อคำนวณอัตราส่วน "คนเข้าเว็บ → โหลดเดโม → ซื้อ" บนหน้า /admin
      onClick={() => trackEvent("download_sample", { file: downloadName })}
      className="inline-flex items-center gap-2.5 bg-[#3D4854] px-5 py-3.5 font-semibold text-white transition hover:bg-[#2E3742]"
    >
      <DownloadIcon className="h-[17px] w-[17px]" />
      {label}
    </a>
  );
}

/* ---------- การ์ดครบเซ็ต: ปกสองเล่มซ้าย ราคา+รายการขวา (กรอบเลือดหมู ไม่มีเงา) ---------- */
function BundleCard({
  product, upsellFrom, onBuy,
}: {
  product: Product;
  /** ชูราคาส่วนต่างจากสินค้านี้ ("เพิ่ม +170") — คำนวณสด กันลืมแก้ตอนเปลี่ยนราคา */
  upsellFrom: Product;
  onBuy: (p: Product) => void;
}) {
  const save = product.compareAt ? product.compareAt - product.price : 0;
  const upsell = product.price - upsellFrom.price;
  const href = courseHref(product);
  return (
    <div className="group relative mt-2 grid items-center gap-7 border-2 border-maroon bg-white p-7 md:grid-cols-[360px_1fr] md:gap-12 md:p-12">
      <span className="absolute -top-3.5 left-6 bg-maroon px-3 py-1 font-label text-[11px] font-bold uppercase tracking-[0.18em] text-white">
        คุ้มสุด · คนซื้อเยอะสุด
      </span>
      {/* ปกสองเล่มวางเหลื่อมซ้อนกัน เอียงคนละทาง */}
      <a href={href} className="flex items-start justify-center py-3" aria-label="ดูรายละเอียดคอร์ส ครบเซ็ตพร้อมสอบ">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/covers/mock.png"
          alt="ปกข้อสอบ Mock TPAT3"
          loading="lazy"
          className="w-[52%] max-w-[190px] -rotate-[5deg] border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.5)] transition group-hover:-translate-y-1"
          style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/covers/tpat3-content.png"
          alt="ปกเนื้อหาทั้งหมดสำหรับสอบ TPAT3"
          loading="lazy"
          className="relative z-10 -ml-[8%] mt-3.5 w-[52%] max-w-[190px] rotate-[5deg] border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.5)] transition group-hover:-translate-y-1"
          style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
        />
      </a>
      <div>
        <p className="font-label text-xs font-semibold uppercase tracking-[0.22em] text-maroon">รวมแพควิศวะ</p>
        <h3 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold leading-snug text-ink">
          <a href={href} className="hover:text-maroon">ครบเซ็ตพร้อมสอบ</a>
        </h3>
        <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-[2rem] font-bold leading-none tracking-tight text-maroon">
            ฿{product.price.toLocaleString()}
          </span>
          {product.compareAt && (
            <>
              <span className="text-[0.95rem] text-ink/45 line-through">฿{product.compareAt.toLocaleString()}</span>
              <span className="border border-maroon/40 px-2 py-0.5 font-label text-xs font-bold text-maroon">
                ประหยัด ฿{save.toLocaleString()}
              </span>
            </>
          )}
        </div>
        {upsell > 0 && (
          <p className="mt-1.5 text-[1.05rem] font-semibold text-maroon">
            เพิ่มเนื้อหาทั้งหมดแค่ +฿{upsell.toLocaleString()} จาก Mock เดี่ยว
          </p>
        )}
        <ul className="mb-6 mt-5 max-w-[460px]">
          {["Mock TPAT3 (ห้องสอบออนไลน์ + เฉลยละเอียด)", "โควตาเข้าสอบ TPAT3 ออนไลน์ 1 ครั้ง", "เนื้อหาทั้งหมดสำหรับสอบ TPAT3"].map((item) => (
            <li key={item} className="relative border-b border-dashed border-grid py-2 pl-6 text-[0.97rem] text-ink">
              <span className="absolute left-0 font-bold text-maroon">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <button
          onClick={() => onBuy(product)}
          className="bg-maroon px-6 py-3.5 font-semibold text-white transition hover:bg-maroon-dark"
        >
          สั่งซื้อครบเซ็ต · ฿{product.price.toLocaleString()}
        </button>
      </div>
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
