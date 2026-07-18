export default function SuccessPage() {
  return (
    <main className="grid-paper flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg border border-ink bg-paper shadow-[0_25px_60px_-20px_rgba(14,26,43,0.5)]">
        <div className="flex items-center justify-between border-b border-ink px-6 py-3">
          <span className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-maroon">สถานะคำสั่งซื้อ</span>
          <span className="font-label text-xs text-ink/60">ชำระแล้ว ✓</span>
        </div>
        <div className="px-8 py-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center border border-ink bg-white text-2xl">🎉</div>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink">ชำระเงินสำเร็จ</h1>
          <p className="mt-3 leading-relaxed text-ink/70">
            เราส่ง <strong>ลิงก์ดาวน์โหลด</strong> ไปที่อีเมลของคุณแล้ว
            ลองเช็คกล่องจดหมายได้เลย
          </p>
          <p className="mt-2 font-label text-sm text-ink/50">ลิงก์ดาวน์โหลดครบทุกไฟล์ของชุดที่ซื้อ อยู่ในอีเมลฉบับเดียว</p>
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
      </div>
    </main>
  );
}
