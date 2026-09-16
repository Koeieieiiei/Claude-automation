import type { Metadata } from "next";
import { cookies } from "next/headers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Gear from "@/components/Gear";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";
import { PRODUCTS } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "เกี่ยวกับพี่ — The best or nothing | Mr.tpat3",
  description:
    "เรื่องราวสั้น ๆ ของคนทำ Mock TPAT3 — จากเด็กที่เล่นเกมทั้งวัน สอบไม่ติดสวนกุหลาบและเตรียมอุดม สู่วิศวกรรมคอมพิวเตอร์ จุฬาฯ ทำไมถึงเลือกทำ TPAT3 และคติ “The best or nothing”",
  alternates: { canonical: "/about" },
};

/**
 * บทความ "เกี่ยวกับพี่" — เจ้าของเล่าเรื่องมาให้เรียบเรียง (2026-09-16) แบ่ง 2 หัวข้อ:
 * ประวัติของพี่ / ทำไมถึงเลือก TPAT3 — แก้ข้อความได้ที่ไฟล์นี้ที่เดียว
 */
export default async function AboutPage() {
  const user = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} next="/about" />

      <main className="flex-1">
        <section className="grid-paper relative overflow-hidden border-b border-grid">
          <Gear teeth={16} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-maroon/[0.07]" spin="cw" />
          <Gear teeth={12} className="pointer-events-none absolute -bottom-12 left-[-2rem] h-44 w-44 text-steel/20" spin="ccw" />
          <div className="relative mx-auto grid max-w-4xl items-center gap-8 px-5 py-14 md:grid-cols-[1fr_auto] md:py-20">
            <div>
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-maroon">เกี่ยวกับพี่</p>
            <h1 className="mt-3 font-display text-[2.4rem] font-bold leading-[1.1] tracking-tight text-ink md:text-[3.2rem]">
              The best <span className="text-maroon">or nothing</span>
            </h1>
            <p className="mt-4 max-w-xl text-[1.1rem] leading-relaxed text-ink/70">
              เรื่องราวสั้น ๆ ของคนทำ Mock TPAT3 — และเหตุผลว่าทำไมต้องเป็น TPAT3
            </p>
            <nav className="mt-6 flex flex-wrap gap-2 font-label text-sm" aria-label="หัวข้อในบทความ">
              <a href="#story" className="border border-ink/25 bg-white px-3.5 py-1.5 font-semibold text-ink transition hover:border-maroon hover:text-maroon">
                1 · ประวัติของพี่
              </a>
              <a href="#why-tpat3" className="border border-ink/25 bg-white px-3.5 py-1.5 font-semibold text-ink transition hover:border-maroon hover:text-maroon">
                2 · ทำไมถึงเลือก TPAT3
              </a>
            </nav>
            </div>
            <figure className="mx-auto w-[220px] md:w-[260px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/about/mako.jpg"
                alt="พี่มาโก้ ศุภวัฒน์"
                width={900}
                height={1200}
                className="w-full rotate-[2deg] border-[6px] border-white object-cover shadow-[0_28px_60px_-24px_rgba(36,16,22,0.7)]"
                style={{ aspectRatio: "3 / 4" }}
              />
              <figcaption className="mt-3 text-center font-label text-xs text-ink/55">มาโก้ ศุภวัฒน์ · วิศวคอม จุฬาฯ</figcaption>
            </figure>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-5 py-14 md:py-16">
          {/* ===== 1. ประวัติของพี่ ===== */}
          <section id="story" className="scroll-mt-24">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-maroon">01</p>
            <h2 className="mt-1 font-display text-[1.75rem] font-bold leading-snug text-ink md:text-[2rem]">ประวัติของพี่</h2>
            <div className="mt-6 space-y-6 text-[1.08rem] leading-[1.9] text-ink/85 md:text-[1.15rem]">
              <p>
                สวัสดีครับน้อง ๆ พี่ชื่อ <strong className="text-ink">มาโก้ ศุภวัฒน์</strong> นิสิตวิศวกรรมคอมพิวเตอร์
                จุฬาลงกรณ์มหาวิทยาลัย
              </p>
              <p>
                พี่ไม่ใช่เด็กเรียนเก่ง และไม่ใช่เด็กขยันมาตั้งแต่แรก วัยเด็กของพี่เหมือนเด็กทั่วไป — เล่นเกมทั้งวัน
                เตะบอลทั้งวัน ม.1 พี่สอบไม่ติดสวนกุหลาบ ม.4 พี่สอบไม่ติดเตรียมอุดม
              </p>
              <p>
                จุดเปลี่ยนมาถึงตอน ม.5 พี่ฟลุกสอบติด สอวน. รอบหนึ่ง และที่นั่นพี่ได้เห็นสังคมที่ต่างออกไปโดยสิ้นเชิง
                ทุกคนขยัน ทุกคนพากันเรียน และไม่มีใครมองว่าการตั้งใจเรียนเป็นเรื่องแปลก พี่กลับออกมาพร้อมไฟที่ไม่เคยมี
                — <strong className="text-ink">อยากกลับเข้าไปอยู่ในสังคมแบบนั้นอีกครั้ง</strong>
              </p>
              <p>
                ไฟนั้นพาพี่มาถึงคณะวิศวกรรมศาสตร์ จุฬาฯ และพาพี่มาเจอเพื่อน ๆ ที่คิดเหมือนกัน
                พวกพี่จึงรวมหัวกันออกแบบ Mock TPAT3 และเล่มเนื้อหาชุดนี้ขึ้นมา —
                ให้เป็นข้อสอบแบบที่พวกพี่เองอยากมีตอนเตรียมสอบ
              </p>
            </div>

            <blockquote className="my-10 border-l-4 border-maroon bg-white px-6 py-6 shadow-[0_16px_40px_-28px_rgba(36,16,22,0.6)] md:px-8">
              <p className="font-display text-2xl font-bold leading-snug text-maroon md:text-[1.9rem]">“The best or nothing”</p>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-ink/75">
                ถ้าไม่ทำให้ดีที่สุด ก็อย่าทำเลยดีกว่า — คติที่พี่ยึดมาตลอด และเป็นมาตรฐานเดียวที่ทุกข้อในชุดนี้
                ทุกหน้าในเล่มเนื้อหา ต้องผ่าน
              </p>
            </blockquote>
          </section>

          {/* ===== 2. ทำไมถึงเลือก TPAT3 ===== */}
          <section id="why-tpat3" className="mt-14 scroll-mt-24 border-t border-grid pt-12">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-maroon">02</p>
            <h2 className="mt-1 font-display text-[1.75rem] font-bold leading-snug text-ink md:text-[2rem]">ทำไมถึงเลือก TPAT3</h2>
            <div className="mt-6 space-y-6 text-[1.08rem] leading-[1.9] text-ink/85 md:text-[1.15rem]">
              <p>
                ปีที่พี่เตรียมตัวสอบ TPAT3 เป็นปีที่หลักสูตรนี้เพิ่งประกาศออกมา ยังไม่มีใครรู้แนวข้อสอบที่แน่ชัด
                และยังไม่มีติวเตอร์ที่ไหนออกมาทำเรื่อง TPAT3 อย่างจริงจัง
              </p>
              <p>
                พี่จึงต้องขวนขวายหาข้อมูลเกือบทั้งหมดด้วยตัวเอง — เรียนหลายที่ ซื้อหนังสือหลายเล่ม
                แล้วเอามาประกบกันเองว่า TPAT3 น่าจะออกแนวไหน
              </p>
              <p>
                แต่ในวันสอบจริง พี่พบว่าข้อสอบ TPAT3{" "}
                <strong className="text-ink">ยากกว่าที่พี่เตรียมมาไว้เยอะมาก</strong> — ส่วนหนึ่งอาจเพราะพี่ตื่นเต้นและหลงทาง
                แต่อีกส่วนคือไม่มีใครบอกพี่ได้เลยว่าของจริงหน้าตาเป็นอย่างไร
              </p>
              <p>
                พี่จึงตัดสินใจเป็นติวเตอร์ด้าน TPAT3 และออกข้อสอบที่มี
                <strong className="text-ink">ความยากใกล้เคียงของจริง หรือยากกว่าเล็กน้อย</strong>{" "}
                เพื่อให้น้อง ๆ เตรียมตัวได้ถูกทาง รู้ว่าแนวข้อสอบจะเป็นแบบไหน
                และไม่ต้องไปเจอความรู้สึกแบบที่พี่เจอในห้องสอบวันนั้น
              </p>
              <p>
                ถ้าตอนนี้น้องยังไม่ใช่เด็กเก่ง ไม่เป็นไรครับ พี่ก็เคยเป็นแบบนั้น สิ่งเดียวที่ต้องมีคือไฟ —
                ส่วนเครื่องมือ พี่เตรียมไว้ให้แล้ว
              </p>
            </div>

            <div className="mt-10 border border-maroon bg-maroon px-6 py-7 text-center text-paper shadow-[0_22px_50px_-28px_rgba(110,20,35,0.8)] md:px-8">
              <p className="font-display text-[1.6rem] font-bold leading-snug md:text-[1.9rem]">สู้ ๆ นะครับ 💪</p>
              <p className="mt-1.5 font-display text-[1.25rem] font-semibold md:text-[1.4rem]">เราจะสอบติดไปด้วยกัน</p>
            </div>
          </section>

          <p className="mt-10 font-display text-lg font-bold text-ink">
            มาโก้ ศุภวัฒน์
            <span className="mt-1 block font-label text-xs font-semibold uppercase tracking-[0.2em] text-maroon">
              วิศวกรรมคอมพิวเตอร์ จุฬาฯ · Mr.tpat3
            </span>
          </p>

          <div className="mt-12 grid gap-3 border-t border-grid pt-8 sm:grid-cols-2">
            <a
              href="/courses/mock-tpat3"
              className="flex items-center justify-between gap-3 border border-ink bg-maroon px-5 py-4 font-bold text-paper transition hover:bg-maroon-dark"
            >
              ดู Mock TPAT3 · ฿{PRODUCTS.mock1.price}
              <span aria-hidden>→</span>
            </a>
            <a
              href="/courses/tpat3-content"
              className="flex items-center justify-between gap-3 border border-ink px-5 py-4 font-bold text-ink transition hover:bg-ink hover:text-paper"
            >
              ดูเนื้อหาทั้งหมดสำหรับสอบ TPAT3 · ฿{PRODUCTS.sum4.price}
              <span aria-hidden>→</span>
            </a>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
