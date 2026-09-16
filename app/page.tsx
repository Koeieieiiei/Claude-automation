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

  // เช็คสถานะผู้ซื้อแล้วเปลี่ยนปุ่ม hero: ยังไม่ทำ → "ทำข้อสอบ", ทำแล้ว → "ดูผลสอบ"
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

  return (
    <div className="min-h-screen">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Gear teeth={10} className="h-6 w-6 text-maroon" spin="cw" />
            <span className="font-display text-lg font-bold tracking-tight text-ink">Mr.tpat3</span>
            <span className="font-label text-xs font-semibold tracking-[0.22em] text-maroon">TPAT3 · ฟิสิกส์</span>
          </div>
          <nav className="hidden items-center gap-6 md:flex" aria-label="เมนูหลัก">
            <a href="#mock" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ข้อสอบ Mock</a>
            <a href="#summaries" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ไฟล์เนื้อหา</a>
            <a href="#bundles" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">Bundles</a>
            <a href="#faq" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ข้อสงสัย</a>
            <a href="/about" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">เกี่ยวกับพี่</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <AccountButton user={user} />
            <button
              onClick={() => buy(PRODUCTS["bundle-all"])}
              className="hidden border border-maroon bg-maroon px-5 py-1.5 text-sm font-semibold text-paper transition hover:bg-maroon-dark sm:inline-block"
            >
              สั่งซื้อ
            </button>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="grid-paper relative overflow-hidden border-b border-grid">
        <Gear teeth={16} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-maroon/[0.07]" spin="cw" />
        <Gear teeth={12} className="pointer-events-none absolute right-28 top-40 h-36 w-36 text-steel/20" spin="ccw" />
        <Gear teeth={14} className="pointer-events-none absolute -bottom-16 left-[-3rem] h-56 w-56 text-maroon/[0.06]" spin="ccw" />

        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-24">
          <h1 className="font-display text-[2.4rem] font-bold leading-[1.15] tracking-tight text-ink md:text-[3.4rem]">
            Tpat3 and Physics A-Level<br />
            <span className="text-maroon">by Mr.tpat3</span>
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            {/* ปุ่มหลักคือ "ทำข้อสอบ" ตั้งแต่เปิดหน้าแรก — คนยังไม่ซื้อกดได้เหมือนกัน
                แล้วไปเจอหน้ายืนยันตัวตนที่ /exam (ไม่มีสิทธิ์จะมีลิงก์พาไปหน้าขายให้)
                ถ้าเครื่องนี้เคยสอบแล้ว ปุ่มจะเปลี่ยนเป็นทำต่อ/ดูผลอัตโนมัติ */}
            <a
              href={examState === "submitted" ? "/exam/results" : "/exam"}
              onClick={() => trackEvent("click_exam_cta", { state: examState ?? "visitor" })}
              className="group inline-flex items-center gap-3 bg-maroon px-[42px] py-[23px] text-[19px] font-bold text-white transition hover:bg-maroon-dark"
            >
              {examState === "in_progress"
                ? "ทำข้อสอบต่อ — เวลากำลังเดิน"
                : examState === "submitted"
                  ? "ดูผลสอบ + บทวิเคราะห์"
                  : "ทำข้อสอบ Mock TPAT3 · 70 ข้อ · 3 ชม."}
              <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>

          {examState !== "submitted" && (
            <p className="mt-3 text-sm font-medium text-ink/60">
              💻 แนะนำให้ทำในคอมพิวเตอร์ หรือ iPad · 1 บัญชีมีสิทธิ์สอบ 1 รอบ
            </p>
          )}
        </div>
      </section>

      {/* ===== แถบแดง: คำทักทายจากผู้สร้าง =====
          เจ้าของขอ 2026-09-16: เอาข้อความเดิมในแถบแดงออก แล้วเอาคำทักทาย + ปุ่มบทความมาใส่แทน */}
      <section className="border-b border-maroon-dark bg-maroon text-paper">
        <div className="mx-auto max-w-6xl px-5 py-6 md:py-7">
          <p className="text-[1.05rem] leading-relaxed text-paper/90 md:text-[1.15rem]">
            สวัสดีครับน้อง ๆ พี่ชื่อ <strong className="text-paper">มาโก้ ศุภวัฒน์</strong> กำลังศึกษาอยู่ที่
            <strong className="text-paper"> วิศวคอม จุฬาฯ</strong> พี่และเพื่อน ๆ ในกลุ่มได้รวมหัวกันออกแบบ{" "}
            <strong className="text-paper">Mock TPAT3</strong> และ
            <strong className="text-paper">เนื้อหาสำหรับสอบ TPAT3</strong> หากน้องสนใจ
            สามารถคลิกดูด้านล่าง<span className="whitespace-nowrap">ได้เลยครับ</span>
          </p>
          <a
            href="/about"
            className="mt-4 inline-flex items-center gap-2 border border-paper px-4 py-2 text-sm font-bold text-paper transition hover:bg-paper hover:text-maroon"
          >
            อ่านเรื่องราวของพี่
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </section>

      {/* ===== Mock ===== */}
      <section id="mock" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 pt-20">
        <h2 className="max-w-xl font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
          ข้อสอบ Mock TPAT3
        </h2>
        <p className="mt-3 max-w-2xl text-[1.2rem] font-medium leading-relaxed text-ink">
          ห้องสอบออนไลน์ 70 ข้อ จับเวลา 3 ชม. + ไฟล์เฉลยละเอียด
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-[1.1fr_1fr]">
          {/* การ์ดสินค้า Mock */}
          <div className="flex flex-col border border-grid bg-white p-7 transition hover:border-maroon">
            {/* กดปก/ชื่อ = เข้าหน้ารายละเอียดคอร์ส */}
            <a href="/courses/mock-tpat3" className="group block" aria-label="ดูรายละเอียดคอร์ส ข้อสอบ Mock TPAT3">
              <MockStack />
              <div>
                <span className="font-display text-2xl font-bold text-maroon">ชุดที่ 1</span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink group-hover:text-maroon">ข้อสอบ Mock TPAT3</h3>
              <DetailLink />
            </a>
            <div className="mt-auto" />
            <div className="mt-6 h-1 w-10 bg-maroon" />
            <p className="mt-4 font-display text-3xl font-bold text-maroon">
              ฿{PRODUCTS.mock1.price.toLocaleString()} <span className="text-sm font-medium text-ink/50">/ ชุด</span>
            </p>
            <button
              onClick={() => buy(PRODUCTS.mock1)}
              className="mt-4 w-full bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
            >
              สั่งซื้อชุดข้อสอบ · ฿{PRODUCTS.mock1.price.toLocaleString()}
            </button>
          </div>

          {/* การ์ดตัวอย่างฟรี */}
          <div className="flex flex-col border border-dashed border-maroon/40 p-7">
            <div className="mx-auto mb-6 w-full max-w-[210px]">
              <Cover src="/covers/demo.png" alt="ปกไฟล์ Demo ตัวอย่างฟรี" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">ไฟล์ Demo (ตัวอย่างฟรี)</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              ตัวอย่าง 4 ข้อนี้เป็นคนละชุดกับข้อสอบจริง 70 ข้อ — ไม่ใช่ข้อที่อยู่ในชุดเต็ม
            </p>
            <div className="mt-auto" />
            {/* ไฟล์เดียว = โจทย์ 4 ข้อ + เฉลยละเอียด (สร้างด้วย Desktop/Project/MOCK/_build-sarabun/demo/make_sample.py) */}
            <SampleButton href="/samples/tpat3-mock-sample.pdf" downloadName="TPat3 Mock Sample.pdf" label="โหลดตัวอย่างโจทย์ + เฉลยฟรี (PDF)" />
          </div>
        </div>
      </section>

      {/* ===== ไฟล์เนื้อหาทั้งหมด ===== */}
      <section id="summaries" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16">
        <h2 className="max-w-3xl font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
          เนื้อหาทั้งหมดสำหรับสอบ TPAT3
        </h2>
        <p className="mt-3 max-w-2xl text-[1.2rem] font-medium leading-relaxed text-ink">
          ครบทั้ง 5 พาร์ตของข้อสอบจริง รวมในไฟล์เดียว 160 หน้า
        </p>

        {/* จงใจให้แคบกว่าโซน Mock — ดันให้ Mock เป็นพระเอกของหน้า */}
        <div className="mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <SummaryCard
            no="เนื้อหาทั้งหมดสำหรับสอบ TPAT3"
            tag={<span className="shrink-0 whitespace-nowrap border border-maroon/40 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-maroon">มีตัวอย่างฟรี</span>}
            product={PRODUCTS.sum4}
            title="Part 1–5 ครบ · 160 หน้า"
            bar="bg-maroon"
            cover="/covers/tpat3-content.png"
            onBuy={buy}
          />

          {/* การ์ดตัวอย่างฟรีของไฟล์เนื้อหา — วางข้างกันแบบเดียวกับฝั่ง Mock */}
          <div className="flex flex-col border border-dashed border-maroon/40 p-7">
            <div className="mx-auto mb-6 w-full max-w-[210px]">
              <Cover src="/covers/demo.png" alt="ปกไฟล์ Demo ตัวอย่างเนื้อหาฟรี" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ink">ไฟล์ Demo (ตัวอย่างฟรี)</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              ตัวอย่างหน้าเนื้อหาจากไฟล์จริง — โหลดดูก่อนตัดสินใจ
            </p>
            <div className="mt-auto" />
            <SampleButton href="/samples/tpat3-summary1-sample.pdf" downloadName="ตัวอย่างเนื้อหา TPAT3.pdf" label="โหลดตัวอย่างเนื้อหาฟรี (PDF)" />
          </div>
        </div>
      </section>

      {/* ===== ชุดสุดคุ้ม ===== */}
      <section id="bundles" className="grid-paper scroll-mt-20 border-y border-grid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold leading-snug text-ink md:text-4xl">Bundles</h2>
          </div>

          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-[1fr_1fr_1.12fr]">
            <BundleCard
              eyebrow="เช็คความพร้อม"
              product={PRODUCTS.mock1}
              displayName="Mock เดี่ยว"
              covers={[{ src: "/covers/mock.png", alt: "ปกข้อสอบ Mock TPAT3" }]}
              items={["Mock TPAT3 (ห้องสอบออนไลน์ + เฉลยละเอียด)", "โควตาเข้าสอบ TPAT3 ออนไลน์ 1 ครั้ง"]}
              dimItems={["เนื้อหาทั้งหมดสำหรับสอบ TPAT3"]}
              onBuy={buy}
            />
            <BundleCard
              eyebrow="เก็บเนื้อหา"
              product={PRODUCTS.sum4}
              displayName="เนื้อหาเดี่ยว"
              covers={[{ src: "/covers/tpat3-content.png", alt: "ปกเนื้อหา TPAT3" }]}
              items={["เนื้อหาทั้งหมดสำหรับสอบ TPAT3"]}
              dimItems={["Mock TPAT3", "โควตาเข้าสอบ TPAT3 ออนไลน์"]}
              onBuy={buy}
            />
            <BundleCard
              hot
              eyebrow="รวมแพควิศวะ"
              product={PRODUCTS["bundle-all"]}
              displayName="ครบเซ็ตพร้อมสอบ"
              covers={[
                { src: "/covers/mock.png", alt: "ปกข้อสอบ Mock TPAT3" },
                { src: "/covers/tpat3-content.png", alt: "ปกเนื้อหา TPAT3" },
              ]}
              items={[
                "Mock TPAT3 (ห้องสอบออนไลน์ + เฉลยละเอียด)",
                "โควตาเข้าสอบ TPAT3 ออนไลน์ 1 ครั้ง",
                "เนื้อหาทั้งหมดสำหรับสอบ TPAT3",
              ]}
              upsellFrom={PRODUCTS.mock1}
              onBuy={buy}
            />
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-20 bg-paper">
        <div className="mx-auto max-w-2xl px-5 py-14">
          <h2 className="font-display text-2xl font-bold leading-snug text-ink md:text-[1.75rem]">ข้อสงสัย</h2>

          <div className="mt-7 divide-y divide-grid border-y border-grid">
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

          <p className="mt-6 text-center font-label text-sm text-ink/55">
            มีคำถามเพิ่มเติม? ติดต่อ{" "}
            <a href="mailto:mr.tpat3@gmail.com" className="font-medium text-maroon underline-offset-2 hover:underline">
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

/* ---------- "ดูรายละเอียดคอร์ส" ใต้ชื่อบนการ์ด (ปก+ชื่อเป็นลิงก์อยู่แล้ว ตัวนี้บอกให้รู้ว่ากดได้) ---------- */
function DetailLink() {
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-maroon underline-offset-4 group-hover:underline">
      ดูรายละเอียดคอร์ส
      <svg className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </span>
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
      className="block w-full border border-grid bg-white shadow-[0_16px_36px_-18px_rgba(36,16,22,0.5)]"
      style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
    />
  );
}

/* ---------- สแตกปก Mock + กระดาษคำตอบ (วางเหลื่อมซ้อนกัน) ---------- */
function MockStack() {
  return (
    <div className="relative mx-auto mb-6 w-full max-w-[300px]" style={{ aspectRatio: "1 / 1.12" }}>
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
        className="absolute bottom-0 left-0 h-auto w-[72%] -rotate-[4deg] border border-grid bg-white shadow-[0_20px_40px_-16px_rgba(36,16,22,0.6)]"
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
      className="mt-4 inline-flex w-full items-center justify-center gap-2.5 bg-[#3D4854] px-4 py-3.5 text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#2E3742]"
    >
      <DownloadIcon className="h-[17px] w-[17px]" />
      {label}
    </a>
  );
}

/* ---------- การ์ดหนังสือเนื้อหา ---------- */
function SummaryCard({
  no, tag, product, title, bar, onBuy, sample, cover,
}: {
  no: string;
  tag?: React.ReactNode;
  product: Product;
  title: string;
  bar: string;
  onBuy: (p: Product) => void;
  sample?: { href: string; label: string; downloadName: string };
  cover: string;
}) {
  return (
    <div className="flex flex-col border border-grid bg-white p-7 transition hover:border-maroon">
      {/* กดปก/ชื่อ = เข้าหน้ารายละเอียดคอร์ส */}
      <a
        href={`/courses/${courseForProduct(product.id)?.slug ?? ""}`}
        className="group block"
        aria-label={`ดูรายละเอียดคอร์ส ${no}`}
      >
        <div className="mx-auto mb-6 w-full max-w-[210px]">
          <Cover src={cover} alt={`ปก${no}`} />
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-2xl font-bold text-maroon">{no}</span>
          {tag}
        </div>
        <h3 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h3>
        <DetailLink />
      </a>
      <div className={`mt-auto h-1.5 w-full ${bar}`} style={{ marginTop: "auto" }} />
      <p className="mt-4 font-display text-3xl font-bold text-maroon">฿{product.price.toLocaleString()}</p>
      <button
        onClick={() => onBuy(product)}
        className="mt-4 w-full bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
      >
        สั่งซื้อเล่มนี้ · ฿{product.price.toLocaleString()}
      </button>
      {sample && <SampleButton href={sample.href} label={sample.label} downloadName={sample.downloadName} />}
    </div>
  );
}

/* ---------- การ์ดชุดสุดคุ้ม ---------- */
function BundleCard({
  eyebrow, product, displayName, items, dimItems = [], onBuy, hot = false, covers = [], upsellFrom,
}: {
  eyebrow: string;
  product: Product;
  displayName: string;
  items: string[];
  dimItems?: string[];
  onBuy: (p: Product) => void;
  hot?: boolean;
  /** รูปปกโชว์บนหัวการ์ด — ใบเดียววางตรง สองใบวางเหลื่อมซ้อนกัน */
  covers?: { src: string; alt: string }[];
  /** ถ้าใส่: ชูราคาส่วนต่างจากสินค้านี้ ("เพิ่ม +40") แทนที่จะโชว์ราคาเต็มเฉยๆ */
  upsellFrom?: Product;
}) {
  const save = product.compareAt ? product.compareAt - product.price : 0;
  // ส่วนต่างจาก Mock เดี่ยว — จ่ายเพิ่มอีกนิดได้เนื้อหาครบ (คำนวณสด กันลืมแก้ตอนเปลี่ยนราคา)
  const upsell = upsellFrom ? product.price - upsellFrom.price : 0;
  return (
    <div
      className={`relative flex flex-col bg-white p-7 ${
        hot
          ? "border-2 border-maroon shadow-[0_18px_45px_-20px_rgba(110,20,35,0.45)]"
          : "border border-grid"
      }`}
    >
      {hot && (
        <span className="absolute -top-3.5 left-6 bg-maroon px-3 py-1 font-label text-[11px] font-bold uppercase tracking-[0.18em] text-paper">
          คุ้มสุด · คนซื้อเยอะสุด
        </span>
      )}
      {covers.length > 0 && (
        <a
          href={`/courses/${courseForProduct(product.id)?.slug ?? ""}`}
          className="mb-6 flex items-center justify-center"
          aria-label={`ดูรายละเอียดคอร์ส ${displayName}`}
        >
          {covers.map((c, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={c.src}
              src={c.src}
              alt={c.alt}
              loading="lazy"
              className={`w-[108px] border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.5)] ${
                covers.length > 1
                  ? i === 0
                    ? "-rotate-[5deg]"
                    : "z-10 -ml-7 mt-3 rotate-[5deg]"
                  : ""
              }`}
              style={{ aspectRatio: "1792 / 2400", objectFit: "cover" }}
            />
          ))}
        </a>
      )}
      <p className="eyebrow tracking-[0.18em]">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-ink">
        <a href={`/courses/${courseForProduct(product.id)?.slug ?? ""}`} className="hover:text-maroon">
          {displayName}
        </a>
      </h3>
      <ul className="mt-5 flex-1">
        {items.map((item) => (
          <li key={item} className="relative border-b border-dashed border-grid py-2 pl-6 text-[0.92rem] text-ink">
            <span className="absolute left-0 font-bold text-maroon">✓</span>
            {item}
          </li>
        ))}
        {dimItems.map((item) => (
          <li key={item} className="relative border-b border-dashed border-grid py-2 pl-6 text-[0.92rem] text-ink/45">
            <span className="absolute left-0">—</span>
            {item}
          </li>
        ))}
      </ul>
      {upsell > 0 ? (
        // ราคาเต็มตัวใหญ่ + บรรทัด "เพิ่มเนื้อหาทั้งหมดแค่ +170" ขนาดกลางเป็นตัวชู
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-display text-[2.1rem] font-bold leading-none text-maroon">
              ฿{product.price.toLocaleString()}
            </span>
            {product.compareAt && (
              <span className="text-[0.95rem] text-ink/45 line-through">฿{product.compareAt.toLocaleString()}</span>
            )}
          </div>
          <p className="mt-2.5 font-display text-[1.15rem] font-bold text-maroon">
            เพิ่มเนื้อหาทั้งหมดแค่ +฿{upsell.toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-[2.1rem] font-bold leading-none text-maroon">
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
      )}
      <button
        onClick={() => onBuy(product)}
        className={`mt-5 w-full py-3.5 font-bold transition ${
          hot
            ? "bg-maroon text-paper hover:bg-maroon-dark"
            : "border border-maroon/40 text-maroon hover:border-maroon"
        }`}
      >
        {hot
          ? upsell > 0
            ? "สั่งซื้อครบเซ็ต"
            : `สั่งซื้อครบเซ็ต · ฿${product.price.toLocaleString()}`
          : "เลือกชุดนี้"}
      </button>
    </div>
  );
}

/* ---------- รายการคำถาม FAQ ---------- */
function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[0.95rem] font-semibold text-ink marker:content-none">
        {q}
        <span className="grid h-5 w-5 shrink-0 place-items-center border border-ink/30 text-sm text-maroon transition group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-ink/65">{a}</p>
    </details>
  );
}
