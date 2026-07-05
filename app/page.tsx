"use client";

import { useEffect, useState } from "react";
import BuyModal from "@/components/BuyModal";

const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME || "ข้อสอบ Mock TPAT3 (Ebook)";
const PRICE = Number(process.env.NEXT_PUBLIC_PRODUCT_PRICE || "199");

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/", referrer: document.referrer }),
    }).catch(() => {});
  }, []);

  const buy = () => setOpen(true);

  return (
    <div className="min-h-screen">
      {/* ===== Top bar ===== */}
      <header className="sticky top-0 z-40 border-b border-grid bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Gear teeth={10} className="h-6 w-6 text-maroon" spin="cw" />
            <span className="font-display text-lg font-bold tracking-tight text-ink">TPAT3</span>
            <span className="font-label text-xs font-semibold tracking-[0.22em] text-maroon">ฉบับซ้อมสอบ</span>
          </div>
          <button
            onClick={buy}
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

        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">ความถนัดวิทยาศาสตร์ เทคโนโลยี วิศวกรรม</p>
            <h1 className="mt-4 font-display text-[2.4rem] font-bold leading-[1.15] tracking-tight text-ink md:text-[3.4rem]">
              ซ้อมในห้องสอบจำลอง<br />
              <span className="text-maroon">ก่อนเข้าห้องสอบจริง</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
              ชุดข้อสอบ TPAT3 เสมือนสนามจริง พร้อมเฉลยที่อธิบายวิธีคิดทีละขั้น
              ไม่ใช่แค่บอกข้อถูก แต่ทำให้คุณทำข้อถัดไปเองได้
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button
                onClick={buy}
                className="group inline-flex items-center gap-3 bg-maroon px-7 py-4 text-base font-semibold text-white transition hover:bg-maroon-dark"
              >
                สั่งซื้อชุดข้อสอบ · ฿{PRICE.toLocaleString()}
                <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <span className="font-label text-sm text-ink/55">ได้ไฟล์ทางอีเมลทันที</span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <ExamBooklet />
          </div>
        </div>
      </section>

      {/* ===== Spec strip ===== */}
      <section className="border-b border-maroon-dark bg-maroon text-paper">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-white/15 md:grid-cols-4">
          {[
            ["รูปแบบ", "PDF · 2 ไฟล์"],
            ["เนื้อหา", "โจทย์ + เฉลยละเอียด"],
            ["การส่งมอบ", "อีเมลอัตโนมัติ"],
            ["ชำระเงิน", "PromptPay"],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-5">
              <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">{k}</p>
              <p className="mt-1.5 font-display text-base font-medium">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ในชุดนี้มีอะไร ===== */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="eyebrow">ในชุดนี้</p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-bold leading-snug text-ink md:text-4xl">
          สองไฟล์ ที่ทำงานคนละหน้าที่
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <FileCard
            no="๑"
            tag="ไฟล์โจทย์"
            title="ไว้จับเวลา ซ้อมเสมือนจริง"
            desc="โจทย์ล้วนไม่มีเฉลยแทรก เปิดทำตอนจับเวลาเพื่อให้ชินกับรูปแบบและระดับความยากของสนามจริง"
            tone="steel"
          />
          <FileCard
            no="๒"
            tag="ไฟล์เฉลย"
            title="พาคิดทุกข้อ ไม่ใช่แค่ข้อถูก"
            desc="อธิบายที่มาของคำตอบทีละขั้น ชี้จุดที่มักพลาด อ่านแล้วกลับไปทำข้ออื่นได้ด้วยตนเอง"
            tone="maroon"
          />
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-lg border border-maroon bg-paper">
          <div className="flex items-center justify-between border-b border-dashed border-maroon/30 px-7 py-4">
            <span className="font-label text-xs font-semibold uppercase tracking-[0.18em] text-maroon">รายการสั่งซื้อ</span>
            <Gear teeth={10} className="h-5 w-5 text-maroon/50" />
          </div>
          <div className="px-7 py-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{PRODUCT_NAME}</p>
                <p className="mt-1 text-sm text-ink/55">โจทย์ + เฉลยละเอียด · PDF 2 ไฟล์</p>
              </div>
              <div className="text-right">
                <p className="font-display text-4xl font-bold text-maroon">฿{PRICE.toLocaleString()}</p>
                <p className="text-xs text-ink/50">จ่ายครั้งเดียว</p>
              </div>
            </div>
            <button
              onClick={buy}
              className="mt-7 w-full bg-maroon py-4 font-semibold text-paper transition hover:bg-maroon-dark"
            >
              สั่งซื้อแล้วรับไฟล์ทางอีเมล
            </button>
            <p className="mt-3 text-center font-label text-xs text-ink/50">
              ชำระเงินปลอดภัยผ่าน Stripe · PromptPay
            </p>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="border-t border-grid bg-paper">
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
              q="ไม่ได้รับอีเมล ทำยังไงดี?"
              a="กรุณาเช็กกล่อง Junk / Spam ก่อน โดยเฉพาะผู้ใช้ Hotmail / Outlook ที่มักกรองอีเมลใหม่เข้าโฟลเดอร์นี้ — ลองค้นคำว่า “tpat3mock” ในอีเมลของคุณ หากยังไม่พบ ติดต่อ marcoco9no.1@gmail.com ได้เลย"
            />
            <FaqItem
              q="จ่ายเงินยังไงได้บ้าง?"
              a="ชำระผ่าน PromptPay โดยสแกน QR ด้วยแอปธนาคารของคุณ ระบบชำระเงินดำเนินการอย่างปลอดภัยผ่าน Stripe"
            />
            <FaqItem
              q="ได้ไฟล์เป็นรูปแบบอะไร?"
              a="เป็นไฟล์ PDF จำนวน 2 ไฟล์ ได้แก่ ไฟล์โจทย์ และไฟล์เฉลยละเอียด"
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
            <a href="mailto:marcoco9no.1@gmail.com" className="font-medium text-maroon underline-offset-2 hover:underline">
              marcoco9no.1@gmail.com
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
          <span>© {new Date().getFullYear()} TPAT3 · ฉบับซ้อมสอบ</span>
        </div>
      </footer>

      {open && <BuyModal price={PRICE} productName={PRODUCT_NAME} onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ---------- ปกข้อสอบทางการ ---------- */
function ExamBooklet() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="float-soft relative overflow-hidden border border-maroon bg-white shadow-[0_18px_45px_-20px_rgba(110,20,35,0.45)]">
        <div className="border-b border-maroon bg-maroon px-6 py-3 text-paper">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            ข้อสอบความถนัด
          </p>
          <p className="font-display text-lg font-bold">TPAT3 · ฉบับซ้อมสอบ</p>
        </div>

        <div className="px-7 py-8">
          <p className="text-center font-display text-xl font-semibold leading-snug text-ink">
            วิทยาศาสตร์<br />เทคโนโลยี วิศวกรรม
          </p>
          <div className="mx-auto mt-5 h-px w-16 bg-maroon/40" />

          <dl className="mt-6 space-y-3 text-sm">
            {[
              ["ลักษณะข้อสอบ", "ปรนัย ๕ ตัวเลือก"],
              ["ขอบเขตเนื้อหา", "ครบทุกพาร์ท"],
              ["พร้อมด้วย", "เฉลยละเอียดทุกข้อ"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-dashed border-ink/15 pb-2">
                <dt className="font-label text-ink/55">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-7 text-center font-label text-[11px] uppercase tracking-[0.2em] text-ink/45">
            ฉบับ Ebook · PDF
          </p>
        </div>

        {/* ตรา “ตัวอย่าง” */}
        <div className="pointer-events-none absolute -right-2 top-[5.5rem] -rotate-[16deg] select-none">
          <div className="border-[3px] border-maroon/70 px-4 py-1.5">
            <span className="font-display text-xl font-bold tracking-[0.15em] text-maroon/70">ตัวอย่าง</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- การ์ดไฟล์ ---------- */
function FileCard({
  no, tag, title, desc, tone,
}: { no: string; tag: string; title: string; desc: string; tone: "steel" | "maroon" }) {
  const accent = tone === "maroon" ? "text-maroon" : "text-steel";
  const bar = tone === "maroon" ? "bg-maroon" : "bg-steel";
  return (
    <div className="border border-grid bg-white p-7 transition hover:border-maroon">
      <div className="flex items-center justify-between">
        <span className={`font-display text-2xl font-bold ${accent}`}>{no}</span>
        <span className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">{tag}</span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 leading-relaxed text-ink/65">{desc}</p>
      <div className={`mt-6 h-1 w-10 ${bar}`} />
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

