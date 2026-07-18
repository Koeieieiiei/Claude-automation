"use client";

import { useEffect, useState } from "react";
import BuyModal from "@/components/BuyModal";
import { PRODUCTS, Product } from "@/lib/catalog";

/* ---------- เฟืองเกียร์ (SVG) ---------- */
function gearPath(teeth: number, rOut: number, rIn: number, rHub: number, c = 50) {
  const step = (Math.PI * 2) / teeth;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [rIn, a],
      [rOut, a + step * 0.14],
      [rOut, a + step * 0.36],
      [rIn, a + step * 0.5],
      [rIn, a + step],
    ];
    pts.forEach(([r, ang], j) => {
      const x = c + r * Math.cos(ang);
      const y = c + r * Math.sin(ang);
      d += `${i === 0 && j === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
    });
  }
  d += "Z ";
  // เจาะรูดุมตรงกลาง (fill-rule evenodd)
  d += `M ${c + rHub} ${c} A ${rHub} ${rHub} 0 1 0 ${c - rHub} ${c} A ${rHub} ${rHub} 0 1 0 ${c + rHub} ${c} Z`;
  return d;
}

function Gear({ teeth = 12, className = "", spin }: { teeth?: number; className?: string; spin?: "cw" | "ccw" }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path
        d={gearPath(teeth, 48, 38, 17)}
        fill="currentColor"
        fillRule="evenodd"
        className={spin === "cw" ? "gear-spin" : spin === "ccw" ? "gear-spin-rev" : ""}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}

export default function Home() {
  const [buying, setBuying] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", referrer: document.referrer }),
    }).catch(() => {});
  }, []);

  const buy = (p: Product) => setBuying(p);

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
            <a href="#summaries" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">สรุป 3 เล่ม</a>
            <a href="#bundles" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">ชุดสุดคุ้ม</a>
            <a href="#faq" className="text-sm font-semibold text-ink/60 transition hover:text-maroon">คำถามที่พบบ่อย</a>
          </nav>
          <button
            onClick={() => buy(PRODUCTS["bundle-all"])}
            className="border border-maroon bg-maroon px-5 py-1.5 text-sm font-semibold text-paper transition hover:bg-maroon-dark"
          >
            สั่งซื้อ
          </button>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="grid-paper relative overflow-hidden border-b border-grid">
        {/* เฟืองตกแต่งพื้นหลัง */}
        <Gear teeth={16} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-maroon/[0.07]" spin="cw" />
        <Gear teeth={12} className="pointer-events-none absolute right-28 top-40 h-36 w-36 text-steel/20" spin="ccw" />
        <Gear teeth={14} className="pointer-events-none absolute -bottom-16 left-[-3rem] h-56 w-56 text-maroon/[0.06]" spin="ccw" />

        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-24">
          <p className="eyebrow">ความถนัดวิทยาศาสตร์ เทคโนโลยี วิศวกรรม</p>
          <h1 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.15] tracking-tight text-ink md:text-[3.4rem]">
            อ่านให้ตรงจุด<br />
            <span className="text-maroon">ซ้อมให้เหมือนจริง</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
            สรุปฟิสิกส์ 3 เล่มแบ่งตามหมวด อ่านจบเป็นภาพเดียว
            แล้วลงสนามซ้อมด้วยข้อสอบ Mock TPAT3 พร้อมเฉลยที่พาคิดทีละขั้น
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <a
              href="#bundles"
              className="group inline-flex items-center gap-3 bg-maroon px-[42px] py-[23px] text-[19px] font-bold text-white transition hover:bg-maroon-dark"
            >
              ดูชุดสุดคุ้ม · เริ่ม ฿{PRODUCTS.mock1.price.toLocaleString()}
              <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <span className="font-label text-sm text-ink/55">ได้ไฟล์ทางอีเมลทันที</span>
          </div>

          <a
            href="#mock"
            className="mt-5 inline-flex w-fit items-center gap-2 border-b border-dashed border-maroon/45 pb-0.5 text-[0.95rem] font-semibold text-maroon transition hover:border-solid"
          >
            <DownloadIcon className="h-4 w-4" />
            โหลดตัวอย่างฟรีก่อนตัดสินใจ
          </a>
        </div>
      </section>

      {/* ===== Spec strip ===== */}
      <section className="border-b border-maroon-dark bg-maroon text-paper">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/15 md:grid-cols-4">
          {[
            ["รูปแบบ", "PDF เปิดได้ทุกเครื่อง"],
            ["การส่งมอบ", "อีเมลอัตโนมัติทันที"],
            ["ชำระเงิน", "PromptPay ผ่าน Stripe"],
            ["ความปลอดภัย", "ลายน้ำระบุผู้ซื้อ"],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-5">
              <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{k}</p>
              <p className="mt-1.5 font-display text-base font-medium">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Mock ===== */}
      <section id="mock" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 pt-20">
        <p className="eyebrow">สนามซ้อม · Mock Exam</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
          ข้อสอบ Mock TPAT3 เสมือนสนามจริง
        </h2>
        <p className="mt-3 max-w-xl text-ink/60">
          โจทย์ล้วนไว้จับเวลา แยกกับเฉลยละเอียดที่อธิบายวิธีคิดทุกข้อ —
          ลองโหลดตัวอย่างทั้งสองไฟล์ไปดูได้ฟรี ไม่ต้องกรอกอะไร
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-[1.1fr_1fr]">
          {/* การ์ดสินค้า Mock */}
          <div className="flex flex-col border border-grid bg-white p-7 transition hover:border-maroon">
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl font-bold text-maroon">ชุดที่ ๑</span>
              <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">
                โจทย์ + เฉลย · PDF 2 ไฟล์
              </span>
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-ink">Mock TPAT3 ครบทุกพาร์ท</h3>
            <p className="mt-2 flex-1 leading-relaxed text-ink/65">
              ข้อสอบปรนัย 5 ตัวเลือก ระดับความยากอิงสนามจริง พร้อมเฉลยที่ไม่ใช่แค่บอกข้อถูก
              แต่พาคิดจนทำข้อถัดไปเองได้
            </p>
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
            <span className="w-fit border border-maroon/40 px-2.5 py-1 font-label text-[11px] font-bold uppercase tracking-[0.16em] text-maroon">
              Demo · โหลดฟรี
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold text-ink">ลองก่อนซื้อ ทั้งโจทย์และเฉลย</h3>
            <p className="mt-2 flex-1 leading-relaxed text-ink/65">
              ไฟล์ตัวอย่างเป็น PDF แบบเดียวกับไฟล์จริง โหลดได้เลยไม่ต้องกรอกอีเมล
            </p>
            <SampleButton href="/samples/tpat3-sample-questions.pdf" label="โหลดตัวอย่างโจทย์ฟรี (PDF)" />
            <SampleButton href="/samples/tpat3-sample-answers.pdf" label="โหลดตัวอย่างเฉลยฟรี (PDF)" />
          </div>
        </div>
      </section>

      {/* ===== สรุป 3 เล่ม ===== */}
      <section id="summaries" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16">
        <p className="eyebrow">คลังความรู้ · สรุปฟิสิกส์</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
          สรุป 3 เล่ม แบ่งตามหมวด อ่านจบเป็นภาพเดียว
        </h2>
        <p className="mt-3 max-w-xl text-ink/60">
          เลือกซื้อเฉพาะหมวดที่ยังไม่แน่น หรือเก็บครบทั้งชุดในราคาพิเศษด้านล่าง — เล่มแรกมีตัวอย่างให้โหลดฟรี
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <SummaryCard
            no="เล่ม ๑"
            tag={<span className="border border-maroon/40 px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] text-maroon">มีตัวอย่างฟรี</span>}
            product={PRODUCTS.sum1}
            title="บทนำ + กลศาสตร์"
            desc="พื้นฐานที่ทุกบทต่อยอด: หน่วยและเวกเตอร์ การเคลื่อนที่ แรงและกฎนิวตัน งาน–พลังงาน โมเมนตัม การหมุน"
            bar="bg-maroon"
            onBuy={buy}
            sample={{ href: "/samples/tpat3-summary1-sample.pdf", label: "โหลดตัวอย่างฟรี: บทนำ + พลศาสตร์" }}
          />
          <SummaryCard
            no="เล่ม ๒"
            tag={<span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">4 หมวด</span>}
            product={PRODUCTS.sum2}
            title="สสาร + ความร้อน + คลื่น + แสง"
            desc="สมบัติสสารและของไหล เทอร์โมไดนามิกส์ คลื่นกลและเสียง แสงเชิงเรขาคณิตและเชิงกายภาพ"
            bar="bg-[#3D4854]"
            onBuy={buy}
          />
          <SummaryCard
            no="เล่ม ๓"
            tag={<span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">4 หมวด</span>}
            product={PRODUCTS.sum3}
            title="ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์"
            desc="ไฟฟ้าสถิตและวงจร แม่เหล็กไฟฟ้า ฟิสิกส์อะตอม ฟิสิกส์นิวเคลียร์ — หมวดที่ออกสอบถี่และพลาดง่ายที่สุด"
            bar="bg-maroon-dark"
            onBuy={buy}
          />
        </div>
      </section>

      {/* ===== ชุดสุดคุ้ม ===== */}
      <section id="bundles" className="grid-paper scroll-mt-20 border-y border-grid">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <p className="eyebrow">ชุดสุดคุ้ม</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
              จับคู่ให้แล้ว จ่ายน้อยกว่าซื้อแยก
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-ink/60">
              อ่านสรุปให้แน่นก่อน แล้วจับเวลาลง Mock — ครบทั้งความรู้และสนามซ้อมในเซ็ตเดียว
            </p>
          </div>

          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-[1fr_1fr_1.12fr]">
            <BundleCard
              eyebrow="เริ่มต้น"
              product={PRODUCTS.mock1}
              displayName="Mock เดี่ยว"
              forWho="เหมาะกับคนที่อ่านเนื้อหาแน่นแล้ว อยากลองสนามเลย"
              items={["Mock TPAT3 ชุดที่ 1 (โจทย์ + เฉลยละเอียด)"]}
              dimItems={["สรุปฟิสิกส์ 3 เล่ม"]}
              onBuy={buy}
            />
            <BundleCard
              eyebrow="เก็บเนื้อหา"
              product={PRODUCTS["bundle-sum"]}
              displayName="สรุปครบ 3 เล่ม"
              forWho="เหมาะกับคนที่เพิ่งเริ่ม อยากปูพื้นให้ครบทุกหมวดก่อน"
              items={[
                "สรุปเล่ม 1: บทนำ + กลศาสตร์",
                "สรุปเล่ม 2: สสาร + ความร้อน + คลื่น + แสง",
                "สรุปเล่ม 3: ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์",
              ]}
              dimItems={["Mock TPAT3"]}
              onBuy={buy}
            />
            <BundleCard
              hot
              eyebrow="ครบจบในเซ็ตเดียว"
              product={PRODUCTS["bundle-all"]}
              displayName="ครบเซ็ตพร้อมสอบ"
              forWho="สรุปครบทุกหมวด + สนามซ้อมจับเวลา ในราคาต่ำกว่าซื้อแยกทุกแบบ"
              items={[
                "Mock TPAT3 ชุดที่ 1 (โจทย์ + เฉลยละเอียด)",
                "สรุปเล่ม 1: บทนำ + กลศาสตร์",
                "สรุปเล่ม 2: สสาร + ความร้อน + คลื่น + แสง",
                "สรุปเล่ม 3: ไฟฟ้า + แม่เหล็ก + อะตอม + นิวเคลียร์",
              ]}
              onBuy={buy}
            />
          </div>

          <p className="mt-8 text-center font-label text-sm text-ink/60">
            ทุกแบบจ่ายครั้งเดียว ได้ไฟล์ PDF ทางอีเมลทันที · ชำระปลอดภัยผ่าน Stripe (PromptPay)
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="scroll-mt-20 bg-paper">
        <div className="mx-auto max-w-2xl px-5 py-14">
          <p className="eyebrow">คำถามที่พบบ่อย</p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-snug text-ink md:text-[1.75rem]">
            สงสัยอะไร ดูตรงนี้ก่อนได้
          </h2>

          <div className="mt-7 divide-y divide-grid border-y border-grid">
            <FaqItem
              q="ซื้อแล้วได้ไฟล์ยังไง เมื่อไหร่?"
              a="หลังชำระเงินสำเร็จ ระบบจะส่งลิงก์ดาวน์โหลดไปที่อีเมลที่คุณกรอกไว้โดยอัตโนมัติทันที"
            />
            <FaqItem
              q="มีตัวอย่างให้ดูก่อนไหม?"
              a="มี! กดปุ่ม “โหลดตัวอย่างโจทย์” หรือ “โหลดตัวอย่างเฉลย” ในหัวข้อข้อสอบ Mock และตัวอย่างสรุปเล่ม 1 ในหัวข้อสรุป ได้เลย ฟรี ไม่ต้องกรอกอะไร — ไฟล์ตัวอย่างเป็น PDF แบบเดียวกับไฟล์จริง"
            />
            <FaqItem
              q="ไม่ได้รับอีเมล ทำยังไงดี?"
              a="กรุณาเช็กกล่อง Junk / Spam ก่อน โดยเฉพาะผู้ใช้ Hotmail / Outlook ที่มักกรองอีเมลใหม่เข้าโฟลเดอร์นี้ — ลองค้นคำว่า “tpat3mock” ในอีเมลของคุณ หากยังไม่พบ ติดต่อ mr.tpat3@gmail.com ได้เลย"
            />
            <FaqItem
              q="จ่ายเงินยังไงได้บ้าง?"
              a="ชำระผ่าน PromptPay โดยสแกน QR ด้วยแอปธนาคารของคุณ ระบบชำระเงินดำเนินการอย่างปลอดภัยผ่าน Stripe"
            />
            <FaqItem
              q="ได้ไฟล์เป็นรูปแบบอะไร?"
              a="เป็นไฟล์ PDF ทั้งหมด — ชุดข้อสอบ Mock ได้ 2 ไฟล์ (ไฟล์โจทย์ และไฟล์เฉลยละเอียด) ส่วนสรุปได้เล่มละ 1 ไฟล์"
            />
            <FaqItem
              q="ซื้อแล้วแชร์ต่อให้เพื่อนได้ไหม?"
              a="ทุกไฟล์ฝังลายน้ำระบุตัวผู้ซื้อไว้ ห้ามเผยแพร่หรือส่งต่อ การแชร์ไฟล์ถือเป็นการละเมิดและสามารถตรวจสอบย้อนกลับได้"
            />
            <FaqItem
              q="ขอคืนเงินได้ไหม?"
              a="เนื่องจากเป็นสินค้าดิจิทัลที่ได้รับไฟล์ทันที จึงขอสงวนสิทธิ์ไม่รับคืนเงินทุกกรณี กรุณาพิจารณาก่อนสั่งซื้อ"
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

      {/* ===== Footer ===== */}
      <footer className="border-t border-grid">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-center font-label text-xs text-ink/50 sm:flex-row sm:text-left">
          <span className="flex items-center gap-2">
            <Gear teeth={9} className="h-4 w-4 text-maroon/60" />
            ทุกไฟล์ฝังลายน้ำระบุผู้ซื้อ เพื่อป้องกันการเผยแพร่ต่อ
          </span>
          <span>
            © {new Date().getFullYear()} Mr.tpat3 ·{" "}
            <a href="mailto:mr.tpat3@gmail.com" className="font-medium text-maroon underline-offset-2 hover:underline">
              mr.tpat3@gmail.com
            </a>
          </span>
        </div>
      </footer>

      {buying && <BuyModal product={buying} onClose={() => setBuying(null)} />}
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

/* ---------- ปุ่มโหลดไฟล์ตัวอย่าง ---------- */
function SampleButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="mt-4 inline-flex w-full items-center justify-center gap-2.5 bg-[#3D4854] px-4 py-3.5 text-[0.95rem] font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#2E3742]"
    >
      <DownloadIcon className="h-[17px] w-[17px]" />
      {label}
    </a>
  );
}

/* ---------- การ์ดหนังสือสรุป ---------- */
function SummaryCard({
  no, tag, product, title, desc, bar, onBuy, sample,
}: {
  no: string;
  tag: React.ReactNode;
  product: Product;
  title: string;
  desc: string;
  bar: string;
  onBuy: (p: Product) => void;
  sample?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col border border-grid bg-white p-7 transition hover:border-maroon">
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-maroon">{no}</span>
        {tag}
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 flex-1 leading-relaxed text-ink/65">{desc}</p>
      <div className={`mt-6 h-1.5 w-full ${bar}`} />
      <p className="mt-4 font-display text-3xl font-bold text-maroon">฿{product.price.toLocaleString()}</p>
      <button
        onClick={() => onBuy(product)}
        className="mt-4 w-full bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
      >
        สั่งซื้อเล่มนี้ · ฿{product.price.toLocaleString()}
      </button>
      {sample && <SampleButton href={sample.href} label={sample.label} />}
    </div>
  );
}

/* ---------- การ์ดชุดสุดคุ้ม ---------- */
function BundleCard({
  eyebrow, product, displayName, forWho, items, dimItems = [], onBuy, hot = false,
}: {
  eyebrow: string;
  product: Product;
  displayName: string;
  forWho: string;
  items: string[];
  dimItems?: string[];
  onBuy: (p: Product) => void;
  hot?: boolean;
}) {
  const save = product.compareAt ? product.compareAt - product.price : 0;
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
          คุ้มที่สุด
        </span>
      )}
      <p className="eyebrow tracking-[0.18em]">{eyebrow}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-ink">{displayName}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/60">{forWho}</p>
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
      <button
        onClick={() => onBuy(product)}
        className={`mt-5 w-full py-3.5 font-bold transition ${
          hot
            ? "bg-maroon text-paper hover:bg-maroon-dark"
            : "border border-maroon/40 text-maroon hover:border-maroon"
        }`}
      >
        {hot ? `สั่งซื้อครบเซ็ต · ฿${product.price.toLocaleString()}` : "เลือกชุดนี้"}
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
