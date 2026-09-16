"use client";

import { useEffect, useState } from "react";

const SITE = "https://tpat3mock.com";

export default function OpenInBrowser({ next, app }: { next: string; app: string }) {
  const url = `${SITE}${next}`;
  const [copied, setCopied] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // เบราว์เซอร์ในแอปบางตัวไม่ให้ใช้ clipboard API — ใช้วิธีเลือกข้อความแทน
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {}
      el.remove();
    }
    setCopied(true);
  };

  // Android: เปิด Chrome ตรง ๆ ผ่าน intent URL (ถ้าไม่มี Chrome ระบบจะถามให้เลือกเบราว์เซอร์เอง)
  const intent = `intent://${url.replace(/^https:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;

  return (
    <main className="grid-paper flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
        <div className="border-b border-ink px-6 py-3">
          <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">
            เข้าสู่ระบบด้วย Google
          </span>
        </div>
        <div className="px-6 py-8">
          <h1 className="font-display text-2xl font-bold leading-snug text-ink">
            เปิดเว็บใน{isAndroid ? " Chrome" : " Safari / Chrome"} ก่อนนะ
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">
            ตอนนี้เปิดเว็บอยู่ในแอป <strong>{app}</strong> ซึ่ง Google ไม่อนุญาตให้ล็อกอินในนั้น
            เปิดในเบราว์เซอร์ของเครื่องแล้วกดเข้าสู่ระบบอีกครั้งได้เลย
          </p>

          {isAndroid && (
            <a
              href={intent}
              className="mt-5 flex w-full items-center justify-center bg-maroon py-3.5 font-bold text-paper transition hover:bg-maroon-dark"
            >
              เปิดใน Chrome
            </a>
          )}

          <button
            type="button"
            onClick={copy}
            className={`mt-3 flex w-full items-center justify-center border border-ink py-3 font-semibold transition ${
              copied ? "bg-ink text-paper" : "bg-white text-ink hover:bg-ink hover:text-paper"
            }`}
          >
            {copied ? "คัดลอกลิงก์แล้ว ✓ ไปวางใน Safari / Chrome" : "คัดลอกลิงก์"}
          </button>

          <div className="mt-6 border-t border-dashed border-grid pt-4 text-sm leading-relaxed text-ink/75">
            <p className="font-semibold text-ink">หรือเปิดเองจากเมนูของแอป</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                กดปุ่ม <strong>⋯</strong> หรือ <strong>⋮</strong> มุมบนขวาของหน้าจอ
              </li>
              <li>
                เลือก <strong>“เปิดในเบราว์เซอร์”</strong> / <strong>“Open in browser”</strong>
                {!isAndroid && <> / <strong>“เปิดใน Safari”</strong></>}
              </li>
              <li>กดเข้าสู่ระบบด้วย Google อีกครั้ง</li>
            </ol>
          </div>

          <p className="mt-5 break-all rounded-none bg-white px-3 py-2 font-label text-xs text-ink/60">{url}</p>
        </div>
      </div>
    </main>
  );
}
