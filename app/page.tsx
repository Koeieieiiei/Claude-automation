"use client";

import { useEffect, useState } from "react";
import BuyModal from "@/components/BuyModal";
import AccountButton, { ClientUser, fetchCurrentUser } from "@/components/AccountButton";
import ClaimButton from "@/components/ClaimButton";
import Gear from "@/components/Gear";
import SiteFooter from "@/components/SiteFooter";
import {
  displayName,
  getProduct,
  isPurchasableProduct,
  PRODUCTS,
  Product,
  ProductId,
} from "@/lib/catalog";
import { courseForProduct } from "@/lib/courses";
import { DEFAULT_EXAM_ID, EXAMS, ExamDef, examPath, examResultsPath } from "@/lib/exams";
import { trackEvent } from "@/lib/analytics";

type ExamState = "eligible" | "in_progress" | "submitted";

/* หน้าแรก
   - โครงเดิม (เจ้าของอนุมัติ 2026-09-16): กระดาษตาราง + เฟืองหมุน, การ์ดสินค้าขาวบนพื้นขาว, หัวข้อ "My Product"
   - 2026-11-16 (เจ้าของสั่ง): เอาจดหมายทักทาย "สวัสดีครับน้อง ๆ" และปุ่ม/ลิงก์ "บทความเกี่ยวกับฉัน" ออก
     hero เหลือหัวเรื่อง + ปุ่มเข้าห้องสอบ 2 วิชา · เพิ่มสินค้า Mock A-Level ฟิสิกส์ / หนังสือตะลุยโจทย์ 2 เล่ม
     จัดกลุ่มตามวิชา (TPAT3 / A-Level ฟิสิกส์) + ส่วน Bundle 3 แบบ (แพ็คสอบติดวิศวะ = คุ้มที่สุด) */
export default function Home() {
  const [buying, setBuying] = useState<Product | null>(null);
  // สถานะห้องสอบต่อสนาม (ไม่มี key = ยังไม่รู้/ไม่มีสิทธิ์ → ปุ่มเป็น "เข้าห้องสอบ")
  const [examStates, setExamStates] = useState<Record<string, ExamState>>({});
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

  // มาจากลิงก์ "สั่งซื้อชุดข้อสอบ" (เช่น จากหน้าห้องสอบ) — เปิดฟอร์มสั่งซื้อให้เลย (เฉพาะสินค้าที่ขายอยู่)
  // /api/claim เด้งกลับมาพร้อม ?claim_error=unknown ถ้าคอร์สที่ขอรับไม่ได้แจกฟรี
  // อ่านจาก window แทน useSearchParams เพื่อไม่ต้องครอบหน้าแรกด้วย Suspense
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("buy");
    const product = id && isPurchasableProduct(id) ? getProduct(id) : null;
    if (product) {
      // นับเหมือนกดปุ่มสั่งซื้อ (มาจากลิงก์ในหน้าห้องสอบ) ไม่งั้นกรวยการขายจะขาดช่วงนี้ไป
      trackEvent("open_buy_form", {
        product_id: product.id,
        value: product.price,
        currency: "THB",
        source: "exam_gate_link",
      });
      setBuying(product);
    }
    if (params.has("claim_error")) setClaimError(true);
    if (product || params.has("claim_error")) {
      window.history.replaceState(null, "", "/"); // เก็บ URL ให้สะอาด กันเปิดซ้ำตอนรีเฟรช
    }
  }, []);

  // เช็คสถานะผู้ซื้อแล้วเปลี่ยนปุ่มห้องสอบ: ยังไม่ทำ → "เข้าห้องสอบ", กำลังทำ → "ทำต่อ", ทำแล้ว → "ดูผลสอบ"
  // ล็อกอินอยู่ = เช็คจากบัญชี (คุกกี้) · ไม่ได้ล็อกอิน = ใช้โทเค็นที่เครื่องนี้เคยเข้าห้องสอบไว้ (แยกต่อสนาม)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await fetchCurrentUser();
      if (cancelled) return;
      setUser(u);
      await Promise.all(
        Object.values(EXAMS).map(async (exam) => {
          const lsKey = exam.id === DEFAULT_EXAM_ID ? "exam.token" : `exam.token.${exam.id}`;
          let body: { useSession: true; examId: string } | { token: string } | null = null;
          if (u) {
            body = { useSession: true, examId: exam.id };
          } else {
            let token = "";
            try {
              token = localStorage.getItem(lsKey) ?? "";
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
            setExamStates((prev) => ({ ...prev, [exam.id]: data.state }));
            if (data.token) {
              try {
                localStorage.setItem(lsKey, data.token);
              } catch {}
            }
          }
        })
      );
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

  const tpat3Exam = EXAMS["tpat3-1"];
  const physExam = EXAMS["phys-1"];
  const anyNotSubmitted = Object.values(EXAMS).some((e) => examStates[e.id] !== "submitted");

  return (
    <div className="min-h-screen">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <a href="/" className="flex items-center gap-2.5" aria-label="Mr.tpat3 หน้าแรก">
            <Gear teeth={10} className="h-7 w-7 text-maroon" spin="cw" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">Mr.tpat3</span>
          </a>
          {/* กดแล้วเลื่อนไปยังส่วนนั้นแบบเร็ว ๆ แทนการกระโดด (เจ้าของสั่ง 2026-11-16) — ดู scrollToSection */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="เมนูหลัก">
            <a href="#tpat3" onClick={scrollToSection} className="text-base font-semibold text-ink/60 transition hover:text-maroon">TPAT3</a>
            <a href="#physics" onClick={scrollToSection} className="text-base font-semibold text-ink/60 transition hover:text-maroon">A-Level ฟิสิกส์</a>
            <a href="#bundles" onClick={scrollToSection} className="text-base font-semibold text-ink/60 transition hover:text-maroon">Bundle</a>
            <a href="#faq" onClick={scrollToSection} className="text-base font-semibold text-ink/60 transition hover:text-maroon">ข้อสงสัย</a>
          </nav>
          <AccountButton user={user} />
        </div>
      </header>

      {/* ===== Hero: หัวเรื่อง + ปุ่มเข้าห้องสอบ 2 วิชา (จดหมายทักทายเจ้าของสั่งเอาออก 2026-11-16) ===== */}
      <section className="grid-paper relative overflow-hidden border-b border-grid">
        <Gear teeth={16} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-maroon/[0.07]" spin="cw" />
        <Gear teeth={12} className="pointer-events-none absolute right-28 top-40 hidden h-36 w-36 text-steel/20 md:block" spin="ccw" />
        <Gear teeth={14} className="pointer-events-none absolute -bottom-16 left-[-3rem] h-56 w-56 text-maroon/[0.06]" spin="ccw" />

        <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-24">
          {/* ป้าย "by Mr.tpat3" เหนือหัวเรื่อง เจ้าของสั่งเอาออก 2026-11-17 */}
          <h1 className="font-display text-[clamp(2.4rem,5.6vw,4rem)] font-bold leading-[1.2] tracking-tight text-ink">
            TPAT3 และ <span className="text-maroon">A-Level ฟิสิกส์</span>
          </h1>
          <p className="mt-4 max-w-[60ch] text-[clamp(1.1rem,1.8vw,1.35rem)] leading-relaxed text-ink/75">
            ข้อสอบ Mock สอบออนไลน์รู้ผลทันที และหนังสือตะลุยโจทย์พร้อมเฉลยละเอียด
            {/* บรรทัดที่สอง — ข้อความเจ้าของเขียนเอง 2026-11-17 ห้ามแก้ถ้อยคำ */}
            <br />
            จัดทำโดยทีมรุ่นพี่วิศวะจุฬา
          </p>

          <div className="mt-9 flex flex-wrap gap-3.5 md:mt-11">
            {/* ปุ่มหลักคือ "เข้าห้องสอบ" — คนยังไม่ซื้อกดได้เหมือนกัน แล้วไปเจอหน้ายืนยันตัวตน
                (ไม่มีสิทธิ์จะมีลิงก์พาไปซื้อชุดของวิชานั้น) ถ้าเคยสอบแล้ว ปุ่มเปลี่ยนเป็นทำต่อ/ดูผลอัตโนมัติ */}
            {/* TPAT3 = ปุ่มทึบสีเลือดหมู · A-Level ฟิสิกส์ = ปุ่มขาวขอบเลือดหมู (เจ้าของสั่งให้กลับเป็นแบบเดิม 2026-11-16) */}
            <ExamCta exam={tpat3Exam} state={examStates[tpat3Exam.id]} primary />
            <ExamCta exam={physExam} state={examStates[physExam.id]} />
          </div>

          {anyNotSubmitted && <p className="mt-4 text-sm text-ink/60">แนะนำทำในคอมพิวเตอร์หรือ iPad</p>}
        </div>
      </section>

      {/* ===== สินค้า (พื้นขาวเฉพาะส่วนนี้ — เจ้าของขอ) ===== */}
      <section id="products" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <SectionHead title="My Product" />

          {claimError && (
            <p className="mb-6 border border-maroon/40 bg-maroon/[0.06] px-4 py-3 text-sm text-maroon">
              คอร์สนี้ไม่ได้แจกฟรี — กดรับจากการ์ดด้านล่าง
            </p>
          )}

          {/* ----- TPAT3 ----- */}
          {/* คำอธิบายเทาข้างชื่อกลุ่ม (ชื่อเต็มวิชา / "A-Level Physics") เจ้าของสั่งเอาออก 2026-11-16 */}
          <GroupHead id="tpat3" title="TPAT3" />
          <div className="grid gap-5">
            <ProductCard
              id="mock"
              cover={<MockStack />}
              courseHref={courseHref(PRODUCTS.mock1)}
              title="ข้อสอบ Mock TPAT3"
              desc="สอบออนไลน์ 70 ข้อ จับเวลา 3 ชม. รู้คะแนน อันดับ และจุดที่ต้องซ่อมทันที พร้อมเฉลยละเอียด"
              product={PRODUCTS.mock1}
              unit="/ ชุด"
              onBuy={buy}
              // ไฟล์เดียว = โจทย์ 4 ข้อ + เฉลยละเอียด (สร้างด้วย Desktop/Project/MOCK/_build-sarabun/demo/make_sample.py)
              sample={{ href: "/samples/tpat3-mock-sample.pdf", downloadName: "TPat3 Mock Sample.pdf", label: "ตัวอย่างข้อสอบฟรี (PDF)" }}
            />
            <ProductCard
              cover={<SingleCover src="/covers/drill-tpat3.png" alt="ปกหนังสือตะลุยโจทย์ TPAT3" />}
              courseHref={courseHref(PRODUCTS["drill-tpat3"])}
              title="หนังสือตะลุยโจทย์ TPAT3"
              desc="ข้อสอบเสมือนจริง 4 ชุด ชุดละ 70 ข้อ พร้อมเฉลยละเอียดทุกข้อ (PDF 525 หน้า)"
              product={PRODUCTS["drill-tpat3"]}
              unit="/ เล่ม"
              onBuy={buy}
            />
            {/* การ์ดเนื้อหา (แจกฟรี) */}
            <ProductCard
              id="content"
              cover={<SingleCover src="/covers/tpat3-content.png" alt="ปกเนื้อหาทั้งหมดสำหรับสอบ TPAT3" />}
              courseHref={courseHref(PRODUCTS.sum4)}
              title="เนื้อหาทั้งหมดสำหรับสอบ TPAT3"
              product={PRODUCTS.sum4}
              onBuy={buy}
            />
          </div>

          {/* ----- A-Level ฟิสิกส์ ----- */}
          <GroupHead id="physics" title="A-Level ฟิสิกส์" className="mt-16 md:mt-20" />
          <div className="grid gap-5">
            <ProductCard
              cover={
                <MockStack
                  sheet={{ src: "/covers/answersheet-physics.png", alt: "กระดาษคำตอบ Mock A-Level ฟิสิกส์" }}
                  cover={{ src: "/covers/mock-physics.png", alt: "ปกข้อสอบ Mock A-Level ฟิสิกส์" }}
                />
              }
              courseHref={courseHref(PRODUCTS["mock-phys1"])}
              title="ข้อสอบ Mock A-Level ฟิสิกส์"
              desc="สอบออนไลน์ 30 ข้อ จับเวลา 90 นาที รู้คะแนน อันดับ และจุดที่ต้องซ่อมทันที พร้อมเฉลยละเอียด"
              product={PRODUCTS["mock-phys1"]}
              unit="/ ชุด"
              onBuy={buy}
            />
            <ProductCard
              cover={<SingleCover src="/covers/drill-physics.png" alt="ปกหนังสือตะลุยโจทย์ A-Level ฟิสิกส์" />}
              courseHref={courseHref(PRODUCTS["drill-phys"])}
              title="หนังสือตะลุยโจทย์ A-Level ฟิสิกส์"
              desc="ข้อสอบเสมือนจริง 4 ชุด ชุดละ 30 ข้อ พร้อมเฉลยละเอียดทุกข้อ (PDF 331 หน้า)"
              product={PRODUCTS["drill-phys"]}
              unit="/ เล่ม"
              onBuy={buy}
            />
          </div>
        </div>
      </section>

      {/* ===== Bundle 3 แบบ (ราคาตามที่เจ้าของกำหนด 2026-11-16) ===== */}
      <section id="bundles" className="grid-paper scroll-mt-20 border-y border-grid">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          {/* คำโปรยข้างหัวข้อ Bundle เจ้าของสั่งเอาออก 2026-11-16 */}
          <SectionHead title="Bundle" />
          <div className="grid gap-5 lg:grid-cols-3">
            <BundleCard product={PRODUCTS["bundle-tpat3"]} onBuy={buy} />
            <BundleCard product={PRODUCTS["bundle-phys"]} onBuy={buy} />
            <BundleCard product={PRODUCTS["bundle-engineer"]} onBuy={buy} best />
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto max-w-3xl px-5 py-14 md:py-24">
          <h2 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-snug tracking-tight text-ink">ข้อสงสัย</h2>

          <div className="mt-8 divide-y divide-grid border-y border-grid">
            <FaqItem
              q="เนื้อหา TPAT3 ฟรีจริงไหม?"
              a="ฟรีจริง กด “รับฟรี” แล้วเข้าสู่ระบบ ไฟล์จะอยู่ที่ “คอร์สของฉัน” ทันที"
            />
            <FaqItem
              q="ซื้อชุด Mock แล้วทำอะไรต่อ?"
              a="ชำระเงินแล้วกด “เริ่มสอบ” ได้ทันที ไฟล์เฉลยอยู่ที่ “คอร์สของฉัน” แนะนำเปิดเฉลยหลังสอบเสร็จ"
            />
            <FaqItem
              q="ทำข้อสอบออนไลน์ยังไง?"
              a="เข้าห้องสอบด้วยอีเมลที่ใช้ซื้อ แล้วกดเริ่ม ระบบจับเวลา (TPAT3 3 ชั่วโมง / A-Level ฟิสิกส์ 90 นาที) และบันทึกคำตอบให้อัตโนมัติ แนะนำทำในคอมพิวเตอร์หรือ iPad"
            />
            <FaqItem
              q="A-Level ฟิสิกส์ ข้อที่ตอบเป็นตัวเลขทำยังไง?"
              a="ข้อ 26–30 พิมพ์ตัวเลขลงช่องในกระดาษคำตอบ ตามหน่วยที่โจทย์กำหนด"
            />
            <FaqItem
              q="สอบได้กี่รอบ? ได้ผลอะไรบ้าง?"
              a="1 บัญชีสอบได้ 1 รอบต่อวิชา ส่งแล้วรู้ผลทันที: คะแนนเต็ม 100 อันดับ ค่าเฉลี่ย กราฟการแจกแจง คะแนนรายตอน และวิเคราะห์รายข้อพร้อมคำแนะนำ"
            />
            <FaqItem
              q="หนังสือตะลุยโจทย์ต่างจาก Mock ยังไง?"
              a="Mock คือสอบออนไลน์จับเวลา 1 ชุด รู้ผลและอันดับทันที / หนังสือตะลุยโจทย์คือข้อสอบเสมือนจริงอีก 4 ชุด (โจทย์ไม่ซ้ำกับ Mock) เป็น PDF พร้อมเฉลยละเอียด ไว้ฝึกเอง"
            />
            <FaqItem
              q="Bundle คืออะไร?"
              a={`ซื้อหลายอย่างรวมกันในราคาถูกกว่าซื้อแยก ได้ของครบเหมือนซื้อทีละอย่าง: TPAT3 Bundle ฿${PRODUCTS["bundle-tpat3"].price.toLocaleString()} / A-Level Physics Bundle ฿${PRODUCTS["bundle-phys"].price.toLocaleString()} / แพ็คสอบติดวิศวะ ฿${PRODUCTS["bundle-engineer"].price.toLocaleString()} (ครบทุกอย่าง)`}
            />
            <FaqItem
              q="มีตัวอย่างข้อสอบให้ดูก่อนไหม?"
              a="มี โหลดตัวอย่างโจทย์ + เฉลยของชุด Mock TPAT3 ได้ฟรี ไม่ต้องกรอกอะไร"
            />
            <FaqItem
              q="ซื้อแล้วแต่ไม่เห็นคอร์ส?"
              a="เช็คว่าเข้าสู่ระบบด้วยอีเมลเดียวกับตอนซื้อ ถ้ายังไม่เห็น ติดต่อ mr.tpat3@gmail.com พร้อมแจ้งอีเมลที่ใช้ซื้อ"
            />
            <FaqItem
              q="จ่ายเงินยังไง?"
              a="สแกน QR PromptPay ผ่าน Stripe"
            />
            <FaqItem
              q="ซื้อแล้วได้อะไร?"
              a={`Mock TPAT3 (฿${PRODUCTS.mock1.price.toLocaleString()}) และ Mock A-Level ฟิสิกส์ (฿${PRODUCTS["mock-phys1"].price.toLocaleString()}): ห้องสอบออนไลน์ 1 ครั้ง + ผลวิเคราะห์ + เฉลยละเอียด (PDF) / หนังสือตะลุยโจทย์ TPAT3 (฿${PRODUCTS["drill-tpat3"].price.toLocaleString()}) และ A-Level ฟิสิกส์ (฿${PRODUCTS["drill-phys"].price.toLocaleString()}): PDF ข้อสอบ 4 ชุดพร้อมเฉลย / เนื้อหา TPAT3 (ฟรี): PDF 174 หน้า ทุกอย่างอยู่ในบัญชีถาวร ไม่มีวันหมดอายุ`}
            />
            <FaqItem
              q="ขอคืนเงินได้ไหม?"
              a="ไม่ได้ เป็นสินค้าดิจิทัลที่ได้รับทันที กรุณาดูตัวอย่างก่อนสั่งซื้อ"
            />
          </div>

          <p className="mt-8 text-center font-label text-sm text-ink/55">
            ติดต่อ{" "}
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

/* ---------- เมนูบน: เลื่อนไปยังส่วนของหน้าแบบเร็ว ๆ (ไม่กระโดด) ----------
   ระยะเวลาตามระยะทาง 300–650 ms แบบเร่งแล้วผ่อน · เผื่อแถบเมนูที่ติดด้านบนด้วย scroll-margin-top ของปลายทาง
   (scroll-mt-* ในแต่ละส่วน) · คนที่ตั้งเครื่องให้ลดการเคลื่อนไหวจะไปถึงทันที · กดปุ่มกลาง/Ctrl เปิดแท็บใหม่ได้ตามปกติ */
let scrollAnimation = 0;

function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = e.currentTarget.getAttribute("href")?.replace(/^#/, "") ?? "";
  const el = id ? document.getElementById(id) : null;
  if (!el) return; // ไม่เจอส่วนนั้น — ปล่อยให้เบราว์เซอร์ทำตามปกติ
  e.preventDefault();
  history.replaceState(null, "", `#${id}`); // คง URL แบบเดิม (แชร์ลิงก์ส่วนนั้นได้) โดยไม่เพิ่มประวัติย้อนกลับ

  const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const maxY = document.documentElement.scrollHeight - window.innerHeight;
  const target = Math.min(maxY, Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset));
  const start = window.scrollY;
  const distance = target - start;
  cancelAnimationFrame(scrollAnimation);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(distance) < 2) {
    window.scrollTo(0, target);
    return;
  }
  const duration = Math.min(650, Math.max(300, Math.abs(distance) * 0.25));
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + distance * ease(t));
    if (t < 1) scrollAnimation = requestAnimationFrame(step);
  };
  scrollAnimation = requestAnimationFrame(step);
}

/* ---------- ลิงก์ไปหน้ารายละเอียดคอร์สของสินค้า ---------- */
function courseHref(product: Product) {
  return `/courses/${courseForProduct(product.id)?.slug ?? ""}`;
}

/* ---------- ปุ่มเข้าห้องสอบของแต่ละวิชา (ข้อความเปลี่ยนตามสถานะการสอบของบัญชี/เครื่องนี้) ---------- */
function ExamCta({ exam, state, primary = false }: { exam: ExamDef; state?: ExamState; primary?: boolean }) {
  const label =
    state === "in_progress"
      ? `ทำข้อสอบ ${exam.shortName} ต่อ — เวลากำลังเดิน`
      : state === "submitted"
        ? `ดูผลสอบ ${exam.shortName} และเฉลย`
        : `เข้าห้องสอบ ${exam.shortName}`;
  return (
    <a
      href={state === "submitted" ? examResultsPath(exam) : examPath(exam)}
      onClick={() => trackEvent("click_exam_cta", { state: state ?? "visitor", exam_id: exam.id })}
      className={`group inline-flex items-center justify-center gap-2.5 px-7 py-4 text-[1.1rem] font-semibold transition max-sm:w-full ${
        primary
          ? "bg-maroon text-white hover:bg-maroon-dark"
          : "border border-maroon text-maroon hover:bg-maroon hover:text-white"
      }`}
    >
      {label}
      <Arrow />
    </a>
  );
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

/* ---------- หัวกลุ่มวิชาในส่วนสินค้า (เส้นแดงสั้น + ชื่อวิชา) ---------- */
function GroupHead({ id, title, note, className = "" }: { id: string; title: string; note?: string; className?: string }) {
  return (
    <div id={id} className={`mb-5 flex scroll-mt-24 flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-grid pb-3 ${className}`}>
      <span className="h-[3px] w-8 self-center bg-maroon" aria-hidden />
      <h3 className="font-display text-[clamp(1.35rem,2.4vw,1.7rem)] font-bold text-maroon">{title}</h3>
      {note && <p className="text-[0.95rem] text-ink/55">{note}</p>}
    </div>
  );
}

/* ---------- การ์ดสินค้า: ปกซ้าย รายละเอียด + ราคา (หรือ "ฟรี") + ปุ่มขวา ---------- */
function ProductCard({
  id, cover, courseHref, kicker, badge, title, desc, includes, product, unit = "", claimLabel = "รับฟรี", onBuy, sample,
}: {
  id?: string;
  cover: React.ReactNode;
  courseHref: string;
  /** ป้ายเล็กเหนือชื่อ (ไม่ใส่ = ไม่โชว์ — การ์ด Mock เจ้าของสั่งเอาออก 2026-09-27) */
  kicker?: string;
  /** ป้ายมุมบนซ้ายของการ์ด (ไม่ใส่ = ไม่โชว์) — เคยใส่ "ขายดี" ที่ Mock TPAT3 แล้วเจ้าของสั่งเอาออก 2026-11-17 */
  badge?: string;
  title: string;
  /** คำอธิบาย/รายการ ✓ — ไม่ใส่ = ไม่โชว์ (การ์ดเนื้อหาเจ้าของสั่งให้เหลือแค่ชื่อ + "ฟรี" 2026-09-27) */
  desc?: string;
  includes?: string[];
  product: Product;
  unit?: string;
  /** ข้อความปุ่มของสินค้าแจกฟรี (price 0) */
  claimLabel?: string;
  onBuy: (p: Product) => void;
  sample?: { href: string; label: string; downloadName: string };
}) {
  const free = product.price === 0;
  return (
    // คลิกตรงไหนของการ์ดก็ได้ = ไปหน้ารายละเอียดคอร์ส (เจ้าของขอ 2026-09-16)
    // ทำด้วยลิงก์ "ดูรายละเอียดคอร์ส" ที่ขยาย ::after คลุมทั้งการ์ด — ปุ่มสั่งซื้อ/รับฟรี/โหลดตัวอย่างลอยอยู่บน (z-10) เลยยังกดของตัวเองได้
    <article
      id={id}
      className="group relative grid scroll-mt-20 items-center gap-7 border border-grid bg-white p-7 transition hover:border-maroon sm:grid-cols-[220px_1fr] md:grid-cols-[300px_1fr] md:gap-12 md:p-11"
    >
      {badge && (
        <span className="absolute -top-3.5 left-6 z-10 bg-maroon px-3 py-1 font-label text-xs font-bold tracking-wide text-white md:left-11">
          {badge}
        </span>
      )}
      <div>{cover}</div>
      <div>
        {kicker && <p className="font-label text-xs font-semibold uppercase tracking-[0.22em] text-maroon">{kicker}</p>}
        <h3 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold leading-snug text-ink">{title}</h3>
        {desc && <p className="mt-3 max-w-[52ch] text-[1.1rem] leading-relaxed text-ink">{desc}</p>}
        {includes && includes.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.95rem] text-ink/60">
            {includes.map((item) => (
              <li key={item}>
                <span className="mr-1.5 font-bold text-maroon">✓</span>
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 h-1 w-10 bg-maroon" />
        <p className="mt-4 font-display text-[2rem] font-bold leading-none tracking-tight text-maroon">
          {free ? (
            <>ฟรี</>
          ) : (
            <>
              ฿{product.price.toLocaleString()} <span className="text-[0.95rem] font-medium tracking-normal text-ink/50">{unit}</span>
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {free ? (
            <ClaimButton productId={product.id} label={claimLabel} source="home" className="relative z-10" />
          ) : (
            <button
              onClick={() => onBuy(product)}
              className="relative z-10 bg-maroon px-5 py-3.5 font-semibold text-white transition hover:bg-maroon-dark"
            >
              สั่งซื้อ ฿{product.price.toLocaleString()}
            </button>
          )}
          {sample && <SampleButton href={sample.href} downloadName={sample.downloadName} label={sample.label} />}
          <a
            href={courseHref}
            aria-label={`รายละเอียด ${title}`}
            className="ml-1 inline-flex items-center gap-1.5 font-semibold text-maroon underline-offset-4 after:absolute after:inset-0 after:z-[1] after:content-[''] group-hover:underline"
          >
            รายละเอียด
            <Arrow className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* ---------- การ์ด Bundle: ปกสินค้าในชุดซ้อนกัน + รายการในชุด (ราคาซื้อแยก) + ราคาขีดฆ่า + ส่วนลด ----------
   best = แพ็คสอบติดวิศวะ: กรอบแดง 2px + ป้าย "คุ้มที่สุด" (กรอบแบบเดิมที่เจ้าของเลือก ไม่มีเงาเรือง) */
const BUNDLE_COVERS: Partial<Record<ProductId, string>> = {
  mock1: "/covers/mock.png",
  "drill-tpat3": "/covers/drill-tpat3.png",
  "mock-phys1": "/covers/mock-physics.png",
  "drill-phys": "/covers/drill-physics.png",
};

function BundleCard({ product, onBuy, best = false }: { product: Product; onBuy: (p: Product) => void; best?: boolean }) {
  const parts = (product.bundleOf ?? []).map((id) => PRODUCTS[id]);
  const covers = parts.map((p) => ({ src: BUNDLE_COVERS[p.id] ?? "", alt: `ปก ${displayName(p)}` })).filter((c) => c.src);
  return (
    <article
      className={`group relative flex flex-col bg-white p-6 transition md:p-7 ${
        best ? "border-2 border-maroon" : "border border-grid hover:border-maroon"
      }`}
    >
      {best && (
        <span className="absolute -top-3.5 left-6 bg-maroon px-3 py-1 font-label text-xs font-bold tracking-wide text-white">
          คุ้มที่สุด
        </span>
      )}
      <BundleStack covers={covers} />
      <h3 className="mt-6 font-display text-[1.45rem] font-bold leading-snug text-ink">{displayName(product)}</h3>
      <ul className="mt-3 space-y-1.5 text-[0.95rem] text-ink/75">
        {parts.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-3">
            <span>
              <span className="mr-1.5 font-bold text-maroon">✓</span>
              {displayName(p)}
            </span>
            <span className="shrink-0 font-label text-xs text-ink/45">฿{p.price.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <div className="h-1 w-10 bg-maroon" />
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-[2rem] font-bold leading-none tracking-tight text-maroon">
            ฿{product.price.toLocaleString()}
          </span>
          {product.compareAt && (
            <span className="font-display text-lg text-ink/45 line-through">฿{product.compareAt.toLocaleString()}</span>
          )}
        </div>
        {/* ป้าย "ประหยัด ฿.. (..%)" ใต้ราคา เจ้าของสั่งเอาออก 2026-11-16 — เหลือราคาเต็มขีดฆ่า */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onBuy(product)}
            className="relative z-10 bg-maroon px-5 py-3.5 font-semibold text-white transition hover:bg-maroon-dark"
          >
            สั่งซื้อ ฿{product.price.toLocaleString()}
          </button>
          <a
            href={courseHref(product)}
            aria-label={`รายละเอียด ${displayName(product)}`}
            className="ml-1 inline-flex items-center gap-1.5 font-semibold text-maroon underline-offset-4 after:absolute after:inset-0 after:z-[1] after:content-[''] group-hover:underline"
          >
            รายละเอียด
            <Arrow className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* ---------- ปกของในชุดวางเหลื่อมกัน (2 หรือ 4 เล่ม) ---------- */
function BundleStack({ covers }: { covers: { src: string; alt: string }[] }) {
  const n = covers.length;
  const width = n > 2 ? "w-[34%]" : "w-[46%]";
  return (
    <div className="relative mx-auto flex h-[190px] w-full max-w-[300px] items-end justify-center">
      {covers.map((c, i) => {
        const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * (n > 2 ? 66 : 40); // % จากกลาง
        const rotate = n === 1 ? 0 : (i / (n - 1) - 0.5) * (n > 2 ? 16 : 10);
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.src}
            src={c.src}
            alt={c.alt}
            loading="lazy"
            className={`absolute bottom-0 ${width} border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.5)]`}
            style={{
              aspectRatio: "1792 / 2400",
              objectFit: "cover",
              left: `calc(50% + ${offset}% )`,
              transform: `translateX(-50%) rotate(${rotate}deg)`,
              zIndex: i,
            }}
          />
        );
      })}
    </div>
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

/* ---------- ปกหนังสือเล่มเดียว (กว้างเท่าการ์ดเนื้อหาเดิม) ---------- */
function SingleCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-full max-w-[232px]">
      <Cover src={src} alt={alt} />
    </div>
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

/* ---------- สแตกปก Mock + กระดาษคำตอบ (วางเหลื่อมซ้อนกัน) — ค่าเริ่มต้น = ชุด TPAT3 ---------- */
function MockStack({
  sheet = { src: "/covers/answersheet.png", alt: "กระดาษคำตอบ Mock TPAT3" },
  cover = { src: "/covers/mock.png", alt: "ปกข้อสอบ Mock TPAT3" },
}: {
  sheet?: { src: string; alt: string };
  cover?: { src: string; alt: string };
}) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]" style={{ aspectRatio: "1 / 1.12" }}>
      {/* กระดาษคำตอบ — เหลื่อมอยู่ด้านหลังขวา เอียงเล็กน้อย (แสดงเต็มสัดส่วนจริง ไม่ครอบ) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sheet.src}
        alt={sheet.alt}
        loading="lazy"
        className="absolute right-0 top-0 h-auto w-[64%] rotate-[6deg] border border-grid bg-white shadow-[0_14px_30px_-16px_rgba(36,16,22,0.45)]"
      />
      {/* ปก Mock — อยู่ด้านหน้าซ้าย เอียงสวนทาง */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cover.src}
        alt={cover.alt}
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
      className="relative z-10 inline-flex items-center gap-2.5 bg-[#3D4854] px-5 py-3.5 font-semibold text-white transition hover:bg-[#2E3742]"
    >
      <DownloadIcon className="h-[17px] w-[17px]" />
      {label}
    </a>
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
