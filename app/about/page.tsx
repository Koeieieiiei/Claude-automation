import type { Metadata } from "next";
import { cookies } from "next/headers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Gear from "@/components/Gear";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "บทความเกี่ยวกับฉัน | Mr.tpat3",
  description:
    "เรื่องราวสั้น ๆ ของคนทำ Mock TPAT3 — จากเด็กที่เล่นเกมทั้งวัน สอบไม่ติดสวนกุหลาบและเตรียมอุดม สู่วิศวกรรมคอมพิวเตอร์ จุฬาฯ ทำไมถึงเลือกทำ TPAT3 และคติ “The best or nothing”",
  alternates: { canonical: "/about" },
};

/**
 * บทความ "เกี่ยวกับพี่" — เจ้าของเล่าเรื่องมาให้เรียบเรียง (2026-09-16) แบ่ง 2 หัวข้อ:
 * ประวัติของพี่ / ทำไมต้อง TPAT3 — แก้ข้อความได้ที่ไฟล์นี้ที่เดียว
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
            <h1 className="font-display text-[2.4rem] font-bold leading-[1.1] tracking-tight text-ink md:text-[3.2rem]">
              บทความ<span className="text-maroon">เกี่ยวกับฉัน</span>
            </h1>
            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 border border-ink/25 bg-white px-4 py-2 font-label text-sm font-semibold text-ink transition hover:border-maroon hover:text-maroon"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              กลับหน้าหลัก
            </a>
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
                พี่ไม่ใช่เด็กเรียนเก่ง และไม่ใช่เด็กขยันมาตั้งแต่แรก วัยเด็กของพี่เหมือนเด็กทั่วไปเลย เล่นเกมทั้งวัน
                เตะบอลทั้งวัน ไม่ใช่เด็กแข่งขันหรือเด็กเรียนเลย ม.1 พี่สอบไม่ติดสวนกุหลาบ ม.4 ก็เช่นเดียวกัน
                พี่สอบไม่ติดเตรียมอุดม แต่พี่ก็ไม่ได้เสียใจอะไร เพราะในช่วงนั้น การใช้ชีวิตไปวัน ๆ
                นั่นแหละคือความฝันของพี่
              </p>
              <p>
                จุดเปลี่ยนมาถึงตอน ม.5 พี่ฟลุกสอบติด สอวน. รอบหนึ่ง ตอนแรกพี่ก็ไม่ได้อยากเข้าค่ายด้วยซ้ำ
                เพราะไม่รู้จะเข้าค่ายไปทำไม และคิดแค่อยากเล่นเกมกับอยากเตะบอล แต่สุดท้ายก็ต้องไปเพราะแม่บังคับ
                และที่นั่นทำให้พี่ได้เห็นสังคมที่ต่างออกไปโดยสิ้นเชิง ทุกคนขยัน ทุกคนพากันเรียน
                และไม่มีใครมองว่าการตั้งใจเรียนเป็นเรื่องแปลก ถึงพี่จะเต็มที่แล้วและไม่ได้ไปต่อ
                แต่พี่กลับออกมาพร้อมไฟที่<strong className="text-ink">อยากกลับเข้าไปอยู่ในสังคมแบบนั้นอีกครั้ง</strong>
              </p>
              <p>
                ไฟนั้นพาพี่มาถึงคณะวิศวกรรมศาสตร์ จุฬาฯ และพาพี่มาเจอเพื่อน ๆ ที่คิดเหมือนกัน
                พวกพี่จึงรวมหัวกันออกแบบ Mock TPAT3 และเล่มเนื้อหาชุดนี้ขึ้นมา
                ให้เป็นข้อสอบแบบที่พวกพี่เองอยากมีตอนเตรียมสอบ
              </p>
            </div>

            <blockquote className="my-10 border-l-4 border-maroon bg-white px-6 py-6 shadow-[0_16px_40px_-28px_rgba(36,16,22,0.6)] md:px-8">
              <p className="font-display text-2xl font-bold leading-snug text-maroon md:text-[1.9rem]">“The best or nothing”</p>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-ink/75">
                ถ้าไม่ทำให้ดีที่สุด ก็อย่าทำเลยดีกว่า
              </p>
            </blockquote>
          </section>

          {/* ===== 2. ทำไมต้อง TPAT3 ===== */}
          <section id="why-tpat3" className="mt-14 scroll-mt-24 border-t border-grid pt-12">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-maroon">02</p>
            <h2 className="mt-1 font-display text-[1.75rem] font-bold leading-snug text-ink md:text-[2rem]">ทำไมต้อง TPAT3</h2>
            <div className="mt-6 space-y-6 text-[1.08rem] leading-[1.9] text-ink/85 md:text-[1.15rem]">
              <p>
                ปีที่พี่เตรียมตัวสอบ TPAT3 เป็นปีที่หลักสูตรนี้เพิ่งประกาศออกมาไม่นาน ยังไม่มีใครรู้แนวข้อสอบที่แน่ชัด
                และยังไม่มีติวเตอร์ที่ไหนออกมาทำเรื่อง TPAT3 อย่างจริงจัง
              </p>
              <p>
                พี่จึงต้องขวนขวายหาข้อมูลเกือบทั้งหมดด้วยตัวเอง เรียนหลายที่ ซื้อหนังสือหลายเล่ม
                แล้วเอามาประกบกันเองว่า TPAT3 น่าจะออกแนวไหน
              </p>
              <p>
                แต่ในวันสอบจริง พี่พบว่าข้อสอบ TPAT3{" "}
                <strong className="text-ink">ยากกว่าที่พี่เตรียมมาไว้เยอะมาก</strong> ส่วนหนึ่งอาจเพราะพี่ตื่นเต้นและความรน
              </p>
              <p>
                พี่จึงตัดสินใจเป็นติวเตอร์ด้าน TPAT3 และออกข้อสอบที่มี
                <strong className="text-ink">ความยากใกล้เคียงของจริง หรือยากกว่าเล็กน้อย</strong>{" "}
                เพื่อให้น้อง ๆ เตรียมตัวได้ถูกทาง รู้ว่าแนวข้อสอบจะเป็นแบบไหน
                และไม่ต้องไปเจอความรู้สึกแบบที่พี่เจอในห้องสอบวันนั้น
              </p>
              <p>
                ถ้าตอนนี้น้องยังไม่ใช่เด็กเก่ง ไม่เป็นไรครับ พี่ก็เคยเป็นแบบนั้น สิ่งเดียวที่ต้องมีคือไฟ
                ส่วนเครื่องมือ พี่เตรียมไว้ให้แล้ว <strong className="text-ink">สู้ ๆ น้อง เราจะสอบติดไปด้วยกัน</strong>
              </p>
            </div>
          </section>

          <p className="mt-10 font-display text-lg font-bold text-ink">
            มาโก้ ศุภวัฒน์
            <span className="mt-1 block font-label text-xs font-semibold uppercase tracking-[0.2em] text-maroon">
              Mrtpat3
            </span>
          </p>

        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
