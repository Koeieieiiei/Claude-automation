"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

interface DownloadLink {
  label: string;
  downloadName: string;
  url: string;
  /** ไฟล์ชุด Mock (โจทย์/เฉลย/กระดาษคำตอบ) — ไม่โชว์ปุ่มโหลดก่อนสอบ กันเปิดเฉลยก่อน */
  examFile?: boolean;
}

type Status = "loading" | "pending" | "ready" | "not_found" | "error";

// หยุด poll หลังราว 5 นาที — ถ้ายังไม่ยืนยัน ลูกค้าเปิดคอร์สได้เองที่ "คอร์สของฉัน" เมื่อ webhook ทำงานเสร็จ
const MAX_PENDING_POLLS = 100;
// เน็ต/เซิร์ฟเวอร์สะดุด: ลองซ้ำไม่กี่ครั้งพอ (~25 วิ) แล้วหยุด — ไม่ยิงซ้ำไม่รู้จบ
const MAX_ERROR_RETRIES = 5;

/** กรอบการ์ดสถานะคำสั่งซื้อ — ใช้ร่วมกันทุกสถานะ (และ fallback ของหน้า) */
export function Frame({ badge, children }: { badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid-paper flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
        <div className="flex items-center justify-between border-b border-ink px-6 py-3">
          <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">
            สถานะคำสั่งซื้อ
          </span>
          <span className="font-label text-xs text-ink/60">{badge}</span>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function SuccessView() {
  const params = useSearchParams();
  const order = params.get("order");
  const product = params.get("product");

  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState("");
  const [hasExam, setHasExam] = useState(false); // ชุดที่ซื้อมีข้อสอบให้ทำออนไลน์ไหม

  useEffect(() => {
    if (!order) {
      setStatus("not_found");
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    let errors = 0;

    async function poll() {
      try {
        const qs = product ? `?product=${encodeURIComponent(product)}` : "";
        const res = await fetch(`/api/order/${order}/downloads${qs}`, { cache: "no-store" });
        if (!active) return;

        if (res.status === 404) {
          setStatus("not_found");
          return;
        }

        const data = await res.json();
        if (!active) return;

        if (data.status === "ready") {
          setEmail(typeof data.email === "string" ? data.email : "");
          setHasExam(data.hasExam === true);
          setStatus("ready");
          // ยืนยันแล้วว่าจ่ายเงินสำเร็จจริง — ตัวชี้วัดสำคัญที่สุดของร้าน
          trackEvent("purchase_success", {
            transaction_id: order ?? "",
            item_name: typeof data.productName === "string" ? data.productName : "",
            currency: "THB",
          });
          return; // จบ — ไม่ต้อง poll ต่อ
        }

        // ยังไม่ยืนยัน (PromptPay กำลังตรวจ) — รอแล้วเช็กใหม่
        setStatus("pending");
        tries += 1;
        if (tries >= MAX_PENDING_POLLS) return;
        timer = setTimeout(poll, 3000);
      } catch {
        if (!active) return;
        setStatus("error");
        errors += 1;
        if (errors >= MAX_ERROR_RETRIES) return; // ยอมแพ้ — หน้าจะบอกให้ไปเปิดที่คอร์สของฉัน
        timer = setTimeout(poll, 5000); // เน็ตสะดุด — ลองใหม่
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [order, product]);

  if (status === "loading") {
    return (
      <Frame badge="กำลังตรวจสอบ…">
        <div className="flex flex-col items-center gap-4 px-8 py-14 text-center">
          <Spinner />
          <p className="text-ink/70">กำลังตรวจสอบสถานะคำสั่งซื้อ…</p>
        </div>
      </Frame>
    );
  }

  if (status === "pending") {
    return (
      <Frame badge="กำลังยืนยัน…">
        <div className="px-8 py-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white">
            <Spinner />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">กำลังยืนยันการชำระเงิน</h1>
          <p className="mt-3 leading-relaxed text-ink/70">
            การชำระผ่าน PromptPay อาจใช้เวลายืนยันสักครู่
            <br />
            ระบบจะเปิดคอร์สให้อัตโนมัติทันทีที่ยืนยันสำเร็จ — ไม่ต้องรีเฟรชหน้านี้
          </p>
          <p className="mt-4 font-label text-sm text-ink/50">
            ถ้าปิดหน้านี้ไปก่อน ก็เปิดคอร์สได้ที่ “คอร์สของฉัน” (ล็อกอินด้วยบัญชี Google ที่ใช้ซื้อ)
          </p>
        </div>
      </Frame>
    );
  }

  if (status === "ready") {
    return (
      <Frame badge="ชำระแล้ว ✓">
        <div className="px-8 py-10">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white text-2xl">🎉</div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">ชำระเงินสำเร็จ</h1>
            <p className="mt-2 leading-relaxed text-ink/70">
              เปิดคอร์สให้บัญชี{email ? <> <strong>{email}</strong></> : "ของคุณ"} แล้ว — เข้าเรียนได้เลย
            </p>
          </div>

          {hasExam ? (
            /* ชุดที่มีข้อสอบ: ชูปุ่มเข้าห้องสอบเป็นหลัก ไฟล์เฉลย/เนื้อหาอยู่ที่คอร์สของฉัน
               (เปิดเฉลยก่อนสอบ ผลวิเคราะห์จะไม่ตรงกับฝีมือจริง) */
            <>
              <a
                href="/exam"
                className="mt-7 flex w-full items-center justify-center gap-3 border border-ink bg-maroon px-5 py-4 text-[1.05rem] font-bold text-paper transition hover:bg-maroon-dark"
              >
                เริ่มสอบ TPAT3 · 70 ข้อ · จับเวลา 3 ชม.
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <p className="mt-3 text-center font-label text-xs leading-relaxed text-ink/55">
                💻 แนะนำให้ทำในคอมพิวเตอร์ หรือ iPad · 1 บัญชีมีสิทธิ์สอบ 1 รอบ
              </p>
              <a
                href="/my-courses"
                className="mt-4 flex w-full items-center justify-center gap-3 border border-ink bg-white px-5 py-3.5 font-semibold text-ink transition hover:bg-ink hover:text-paper"
              >
                ไปที่คอร์สของฉัน (ไฟล์เฉลย / เนื้อหา) →
              </a>
            </>
          ) : (
            <a
              href="/my-courses"
              className="mt-7 flex w-full items-center justify-center gap-3 border border-ink bg-maroon px-5 py-4 text-[1.05rem] font-bold text-paper transition hover:bg-maroon-dark"
            >
              ไปที่คอร์สของฉัน — โหลดไฟล์ได้เลย →
            </a>
          )}

          <div className="mt-6 border border-maroon/40 bg-maroon/[0.04] px-5 py-4">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
              เปิดย้อนหลังได้ตลอด
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
              ล็อกอินด้วยบัญชี Google{email ? <> <strong>{email}</strong></> : " ที่ใช้ซื้อ"} ที่หน้า “คอร์สของฉัน”
              จากเครื่องไหนก็ได้ ไฟล์เป็นของบัญชีนี้ตลอด ไม่มีวันหมดอายุ
              {hasExam && <> — <strong>แนะนำให้เปิดเฉลยหลังทำข้อสอบเสร็จ</strong></>}
            </p>
          </div>

          <a
            href="/"
            className="mt-8 inline-block border border-ink px-6 py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper"
          >
            กลับหน้าหลัก
          </a>
        </div>
      </Frame>
    );
  }

  // not_found / error — degrade เป็นข้อความอีเมล (เผื่อเปิด /success ตรง ๆ หรือหา order ไม่พบ)
  return (
    <Frame badge={status === "error" ? "ลองใหม่อีกครั้ง" : "เปิดที่คอร์สของฉัน"}>
      <div className="px-8 py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white text-2xl">📚</div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">
          {status === "error" ? "เชื่อมต่อไม่สำเร็จชั่วคราว" : "เปิดคอร์สได้ที่ “คอร์สของฉัน”"}
        </h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          หากชำระเงินเรียบร้อยแล้ว คอร์สจะอยู่ในบัญชี Google ที่ใช้สั่งซื้อ —
          ล็อกอินที่หน้า <strong>คอร์สของฉัน</strong> ได้เลย
        </p>
        <a
          href="/my-courses"
          className="mt-6 flex w-full items-center justify-center gap-3 border border-ink bg-maroon px-5 py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
        >
          ไปที่คอร์สของฉัน →
        </a>
        <a
          href="/"
          className="mt-4 inline-block border border-ink px-6 py-2.5 font-medium text-ink transition hover:bg-ink hover:text-paper"
        >
          กลับหน้าหลัก
        </a>
      </div>
    </Frame>
  );
}

function Spinner() {
  return (
    <svg className="h-7 w-7 animate-spin text-maroon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16" />
    </svg>
  );
}
