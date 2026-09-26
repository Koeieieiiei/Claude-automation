import type { Metadata } from "next";
import { cookies } from "next/headers";
import LegalLayout, { H2, List } from "@/components/LegalLayout";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | Mr.tpat3",
  description: "Mr.tpat3 เก็บ ใช้ และดูแลข้อมูลส่วนบุคคลของผู้ใช้อย่างไร รวมถึงบัญชีอีเมล+รหัสผ่าน คำสั่งซื้อ และผลสอบ",
  alternates: { canonical: "/privacy" },
};

/**
 * นโยบายความเป็นส่วนตัว
 * ⚠️ เนื้อหาต้องตรงกับที่ระบบทำจริง — เพิ่ม/เลิกใช้บริการภายนอก หรือเก็บข้อมูลใหม่เมื่อไหร่ ต้องแก้หน้านี้ด้วย
 * (ข้อมูลที่อ้างถึง: lib/user-store.ts + lib/password.ts (บัญชีอีเมล+รหัสผ่าน ตั้งแต่ 2026-09-27), lib/user-session.ts,
 *  app/api/checkout, lib/exam-store.ts, lib/sheets.ts, lib/email.ts (Resend), components/Analytics.tsx, lib/watermark.ts)
 */
export default async function PrivacyPage() {
  const user = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
  const mail = (
    <a href="mailto:mr.tpat3@gmail.com" className="font-semibold text-maroon underline underline-offset-2">
      mr.tpat3@gmail.com
    </a>
  );

  return (
    <LegalLayout user={user} path="/privacy" title="นโยบายความเป็นส่วนตัว" updated="27 กันยายน 2569">
      <p>
        นโยบายนี้อธิบายว่า <strong className="text-ink">tpat3mock.com</strong> (“Mr.tpat3”, “เรา”) เก็บข้อมูลอะไร ใช้ทำอะไร
        และผู้ใช้มีสิทธิ์อะไรบ้าง ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
      </p>

      <H2>1. ข้อมูลที่เราเก็บ</H2>
      <List
        items={[
          <>
            <strong className="text-ink">ข้อมูลบัญชี</strong> — อีเมลและรหัสผ่าน (เก็บเป็นค่าแฮช scrypt เท่านั้น แม้เราก็อ่านรหัสผ่านจริงไม่ได้)
          </>,
          <>
            <strong className="text-ink">ข้อมูลการสั่งซื้อ</strong> — สินค้า ราคา วันเวลา สถานะ และรหัสอ้างอิงจาก Stripe
          </>,
          <>
            <strong className="text-ink">ข้อมูลการสอบ</strong> — คำตอบ เวลาเริ่ม/ส่ง และคะแนน
          </>,
          <>
            <strong className="text-ink">ข้อมูลการใช้งาน</strong> — หน้าที่เข้าชม เว็บที่ลิงก์มา และชนิดเบราว์เซอร์/อุปกรณ์ (Google Analytics)
          </>,
        ]}
      />
      <p>
        เรา<strong className="text-ink">ไม่เก็บข้อมูลบัตรหรือบัญชีธนาคาร</strong> การชำระเงินอยู่บนระบบของ Stripe ทั้งหมด
      </p>

      <H2>2. เราใช้ข้อมูลทำอะไร</H2>
      <List
        items={[
          "เข้าสู่ระบบ และผูกคอร์สที่ซื้อกับอีเมลของผู้ใช้",
          "ตรวจสอบสิทธิ์เข้าห้องสอบและดาวน์โหลดไฟล์ที่ซื้อ",
          "ส่งลิงก์ตั้งรหัสผ่านเมื่อผู้ใช้ขอ ไม่ส่งอีเมลโฆษณา",
          "ตรวจคะแนนและคำนวณสถิติภาพรวม โดยไม่เปิดเผยชื่อผู้สอบคนอื่น",
          "ฝังชื่อและอีเมลผู้ซื้อในไฟล์ PDF เพื่อป้องกันการเผยแพร่โดยไม่ได้รับอนุญาต",
          "บันทึกบัญชีรายรับ และติดต่อผู้ใช้เมื่อคำสั่งซื้อมีปัญหา",
          "ปรับปรุงเว็บไซต์จากสถิติภาพรวม",
        ]}
      />
      <p>เราไม่ขาย ไม่ให้เช่า และไม่ใช้ข้อมูลของผู้ใช้เพื่อโฆษณา</p>

      <H2>3. รหัสผ่านและความปลอดภัยของบัญชี</H2>
      <List
        items={[
          "รหัสผ่านถูกแฮชทางเดียวก่อนบันทึก กู้คืนไม่ได้ ทำได้แค่ตั้งใหม่",
          "ลิงก์ตั้งรหัสผ่านส่งไปที่อีเมลของบัญชีเท่านั้น ใช้ได้ 30 นาที ครั้งเดียว",
          "ผู้ใช้ต้องเก็บรหัสผ่านเป็นความลับ เราไม่มีวันขอรหัสผ่านทางอีเมลหรือช่องทางอื่น",
          "ระบบจำกัดจำนวนครั้งที่ล็อกอินผิด เพื่อป้องกันการเดารหัสผ่าน",
        ]}
      />

      <H2>4. ผู้ให้บริการที่ประมวลผลข้อมูลแทนเรา</H2>
      <List
        items={[
          <><strong className="text-ink">Supabase</strong> — ฐานข้อมูล ไฟล์ และบัญชีผู้ใช้</>,
          <><strong className="text-ink">Stripe</strong> — รับชำระเงิน</>,
          <><strong className="text-ink">Vercel</strong> — โฮสต์เว็บไซต์</>,
          <><strong className="text-ink">Resend</strong> — ส่งอีเมลลิงก์ตั้งรหัสผ่าน</>,
          <><strong className="text-ink">Google</strong> — Analytics (สถิติเข้าชม) และ Sheets (บันทึกยอดขาย)</>,
        ]}
      />
      <p>ผู้ให้บริการเหล่านี้อาจเก็บข้อมูลบนเซิร์ฟเวอร์นอกประเทศไทย</p>

      <H2>5. คุกกี้และการจัดเก็บในเบราว์เซอร์</H2>
      <List
        items={[
          "คุกกี้เข้าสู่ระบบ (จำเป็น) อายุไม่เกิน 180 วัน ลบได้ด้วยการออกจากระบบ",
          "localStorage สำหรับกลับไปทำข้อสอบที่ค้างไว้",
          "คุกกี้ของ Google Analytics สำหรับสถิติการเข้าชม",
        ]}
      />

      <H2>6. ระยะเวลาเก็บและความปลอดภัย</H2>
      <p>
        เราเก็บข้อมูลบัญชีและคำสั่งซื้อตลอดที่ผู้ใช้ยังมีสิทธิ์เข้าคอร์ส และตามที่กฎหมายภาษี/บัญชีกำหนด
        ข้อมูลส่งผ่าน HTTPS ฐานข้อมูลและไฟล์เข้าถึงได้เฉพาะเซิร์ฟเวอร์ของเรา
      </p>

      <H2>7. สิทธิ์ของผู้ใช้</H2>
      <p>
        ขอเข้าถึง แก้ไข หรือลบข้อมูลของตนได้ทาง {mail} (ลบบัญชีแล้วจะเข้าคอร์สไม่ได้อีก)
        และเปลี่ยนรหัสผ่านได้ผ่าน “ลืมรหัสผ่าน”
      </p>

      <H2>8. การเปลี่ยนแปลงนโยบายและการติดต่อ</H2>
      <p>
        หากนโยบายเปลี่ยน เราจะปรับวันที่ “ปรับปรุงล่าสุด” ด้านบน สอบถามได้ที่ {mail}
      </p>

      <div className="mt-14 border-t border-grid pt-8 text-[0.95rem] text-ink/75" lang="en">
        <H2>Summary (English)</H2>
        <p>
          tpat3mock.com (“Mr.tpat3”) sells TPAT3 mock exams, an online exam room and study materials. You sign in
          with an email and password; we store only a one-way scrypt hash of the password. We use your email to
          authenticate you, link purchases to your account, check access to the exam room and files, and send
          password-reset links on request. We do not sell or share your data, use it for advertising, or train AI
          models with it. Processors: Supabase (database, storage, accounts), Stripe (payments), Vercel (hosting),
          Resend (email) and Google (Analytics, Sheets). To access or delete your data, email {mail}.
        </p>
      </div>
    </LegalLayout>
  );
}
