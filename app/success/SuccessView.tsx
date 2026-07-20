"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface DownloadLink {
  label: string;
  downloadName: string;
  url: string;
}

type Status = "loading" | "pending" | "ready" | "not_found" | "error";

// หยุด poll หลังราว 5 นาที — ถ้ายังไม่ยืนยัน ปล่อยให้ลูกค้าพึ่งลิงก์ในอีเมลแทน
const MAX_PENDING_POLLS = 100;

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
  const [links, setLinks] = useState<DownloadLink[]>([]);
  const [email, setEmail] = useState("");
  const [expiryHours, setExpiryHours] = useState(168);

  useEffect(() => {
    if (!order) {
      setStatus("not_found");
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;

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
          setLinks(Array.isArray(data.links) ? data.links : []);
          setEmail(typeof data.email === "string" ? data.email : "");
          if (typeof data.expiryHours === "number") setExpiryHours(data.expiryHours);
          setStatus("ready");
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
            ระบบจะแสดง <strong>ปุ่มดาวน์โหลด</strong> ให้อัตโนมัติทันทีที่ยืนยันสำเร็จ — ไม่ต้องรีเฟรชหน้านี้
          </p>
          <p className="mt-4 font-label text-sm text-ink/50">
            หากชำระเรียบร้อยแล้ว เราได้ส่งลิงก์ดาวน์โหลดไปที่อีเมลของคุณไว้ด้วยเช่นกัน
          </p>
        </div>
      </Frame>
    );
  }

  if (status === "ready") {
    const expiryText = expiryHours % 24 === 0 ? `${expiryHours / 24} วัน` : `${expiryHours} ชั่วโมง`;
    return (
      <Frame badge="ชำระแล้ว ✓">
        <div className="px-8 py-10">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white text-2xl">🎉</div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">ชำระเงินสำเร็จ</h1>
            <p className="mt-2 text-ink/70">ดาวน์โหลดไฟล์ของคุณได้เลยด้านล่าง</p>
          </div>

          <div className="mt-7 space-y-3">
            {links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                download={l.downloadName}
                className="flex w-full items-center justify-between gap-3 border border-ink bg-maroon px-5 py-3.5 font-semibold text-paper transition hover:bg-maroon-dark"
              >
                <span className="text-left text-[0.95rem] leading-snug">{l.label}</span>
                <DownloadIcon className="h-5 w-5 shrink-0" />
              </a>
            ))}
          </div>

          <p className="mt-4 font-label text-[12px] leading-snug text-ink/50">
            แต่ละไฟล์ฝังลายน้ำระบุชื่อและอีเมลของคุณตอนกดดาวน์โหลด จึงอาจใช้เวลา 2–3 วินาทีต่อไฟล์ · โปรดอย่าเผยแพร่ต่อ
          </p>

          <div className="mt-6 border border-maroon/40 bg-maroon/[0.04] px-5 py-4">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">
              เปิดย้อนหลังได้
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
              เราส่งลิงก์ชุดเดียวกันนี้ไปที่อีเมล{email ? <> <strong>{email}</strong></> : ""} ไว้ด้วย
              เปิดดาวน์โหลดย้อนหลังได้ภายใน {expiryText} — หากไม่พบ ลองเช็กกล่อง Junk / Spam แล้วค้นคำว่า{" "}
              <strong>tpat3mock</strong>
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
    <Frame badge={status === "error" ? "ลองใหม่อีกครั้ง" : "ตรวจอีเมล"}>
      <div className="px-8 py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white text-2xl">📩</div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">
          {status === "error" ? "เชื่อมต่อไม่สำเร็จชั่วคราว" : "ตรวจลิงก์ดาวน์โหลดในอีเมล"}
        </h1>
        <p className="mt-3 leading-relaxed text-ink/70">
          หากคุณชำระเงินเรียบร้อยแล้ว เราได้ส่ง <strong>ลิงก์ดาวน์โหลด</strong> ไปที่อีเมลของคุณแล้ว
          ลองเช็กกล่องจดหมายได้เลย
        </p>
        <div className="mt-6 border border-maroon/40 bg-maroon/[0.04] px-5 py-4 text-left">
          <p className="font-label text-[11px] font-semibold uppercase tracking-[0.18em] text-maroon">โปรดทราบ</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
            ⚠️ หากไม่พบอีเมล กรุณาเช็กกล่อง <strong>Junk / Spam</strong> ด้วย
            (โดยเฉพาะผู้ใช้ Hotmail / Outlook) — ลองค้นคำว่า <strong>tpat3mock</strong> ในอีเมลของคุณ
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
