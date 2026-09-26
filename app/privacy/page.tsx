import type { Metadata } from "next";
import { cookies } from "next/headers";
import LegalLayout, { H2, List } from "@/components/LegalLayout";
import { USER_COOKIE, verifyUserSession } from "@/lib/user-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | Mr.tpat3",
  description: "Mr.tpat3 เก็บ ใช้ และดูแลข้อมูลส่วนบุคคลของผู้ใช้อย่างไร รวมถึงข้อมูลจากการเข้าสู่ระบบด้วย Google",
  alternates: { canonical: "/privacy" },
};

/**
 * นโยบายความเป็นส่วนตัว — ใช้ประกอบการยืนยันแบรนด์กับ Google (OAuth consent screen)
 * ⚠️ เนื้อหาต้องตรงกับที่ระบบทำจริง — เพิ่ม/เลิกใช้บริการภายนอก หรือเก็บข้อมูลใหม่เมื่อไหร่ ต้องแก้หน้านี้ด้วย
 * (ข้อมูลที่อ้างถึง: lib/user-session.ts, lib/supabase-auth.ts, app/api/checkout, lib/exam-store.ts,
 *  lib/sheets.ts, components/Analytics.tsx, lib/watermark.ts)
 */
export default async function PrivacyPage() {
  const user = verifyUserSession((await cookies()).get(USER_COOKIE)?.value);
  const mail = (
    <a href="mailto:mr.tpat3@gmail.com" className="font-semibold text-maroon underline underline-offset-2">
      mr.tpat3@gmail.com
    </a>
  );

  return (
    <LegalLayout user={user} path="/privacy" title="นโยบายความเป็นส่วนตัว" updated="16 กันยายน 2569">
      <p>
        เว็บไซต์ <strong className="text-ink">tpat3mock.com</strong> (“Mr.tpat3”, “เรา”) ให้บริการข้อสอบ Mock TPAT3
        ห้องสอบออนไลน์ และไฟล์เนื้อหาสำหรับเตรียมสอบ TPAT3 นโยบายนี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร
        และผู้ใช้มีสิทธิ์อะไรบ้าง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
      </p>

      <H2>1. ข้อมูลที่เราเก็บ</H2>
      <List
        items={[
          <>
            <strong className="text-ink">ข้อมูลจากบัญชี Google</strong> เมื่อเข้าสู่ระบบด้วย Google — ชื่อ อีเมล
            และรูปโปรไฟล์ เท่านั้น (สิทธิ์ openid, email, profile) เราไม่เข้าถึง Gmail, Google Drive, รายชื่อติดต่อ
            หรือข้อมูลอื่นในบัญชี Google
          </>,
          <>
            <strong className="text-ink">ข้อมูลการสั่งซื้อ</strong> — สินค้าที่ซื้อ ราคา วันเวลา สถานะการชำระเงิน
            และรหัสอ้างอิงการชำระเงินจาก Stripe
          </>,
          <>
            <strong className="text-ink">ข้อมูลการทำข้อสอบออนไลน์</strong> — คำตอบ เวลาเริ่ม/ส่ง และคะแนน
          </>,
          <>
            <strong className="text-ink">ข้อมูลการใช้งานเว็บไซต์</strong> — หน้าที่เข้าชม เว็บที่ลิงก์มา
            และชนิดเบราว์เซอร์/อุปกรณ์ (ผ่าน Google Analytics และบันทึกการเข้าชมของเรา)
          </>,
        ]}
      />
      <p>
        เรา<strong className="text-ink">ไม่เก็บข้อมูลบัตรหรือบัญชีธนาคาร</strong> — การชำระเงิน (PromptPay)
        ดำเนินการบนระบบของ Stripe ทั้งหมด
      </p>

      <H2>2. เราใช้ข้อมูลทำอะไร</H2>
      <List
        items={[
          "ยืนยันตัวตนเพื่อเข้าสู่ระบบ และผูกคอร์สที่ซื้อไว้กับบัญชีของผู้ใช้ (หน้า “คอร์สของฉัน”)",
          "ตรวจสอบสิทธิ์เข้าห้องสอบและดาวน์โหลดไฟล์ที่ซื้อ",
          "ตรวจคะแนน วิเคราะห์ผลสอบ และคำนวณสถิติภาพรวม (อันดับ ค่าเฉลี่ย) โดยไม่เปิดเผยชื่อผู้สอบคนอื่น",
          "ฝังชื่อและอีเมลของผู้ซื้อไว้ในข้อมูลกำกับไฟล์ PDF (metadata) เพื่อป้องกันและตรวจสอบการเผยแพร่ไฟล์โดยไม่ได้รับอนุญาต",
          "บันทึกบัญชีรายรับ ออกหลักฐาน และติดต่อผู้ใช้เมื่อมีปัญหาเกี่ยวกับคำสั่งซื้อ",
          "ปรับปรุงเว็บไซต์จากสถิติการใช้งานแบบภาพรวม",
        ]}
      />
      <p>เราไม่ขาย ไม่ให้เช่า และไม่ใช้ข้อมูลของผู้ใช้เพื่อโฆษณา</p>

      <H2>3. ข้อมูลจาก Google (Google user data)</H2>
      <p>
        ข้อมูลที่ได้รับจากการเข้าสู่ระบบด้วย Google (ชื่อ อีเมล รูปโปรไฟล์) ใช้เพื่อยืนยันตัวตน
        และแสดงบัญชีที่เข้าสู่ระบบอยู่เท่านั้น ไม่นำไปใช้ฝึกโมเดล AI ไม่ขายหรือส่งต่อให้บุคคลภายนอกเพื่อวัตถุประสงค์อื่น
        การใช้ข้อมูลที่ได้รับจาก Google APIs เป็นไปตาม{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-maroon underline underline-offset-2"
        >
          Google API Services User Data Policy
        </a>{" "}
        รวมถึงข้อกำหนด Limited Use
      </p>

      <H2>4. ผู้ให้บริการที่ประมวลผลข้อมูลแทนเรา</H2>
      <List
        items={[
          <><strong className="text-ink">Supabase</strong> — ระบบเข้าสู่ระบบ ฐานข้อมูลคำสั่งซื้อ/ผลสอบ และที่เก็บไฟล์</>,
          <><strong className="text-ink">Stripe</strong> — รับชำระเงิน</>,
          <><strong className="text-ink">Vercel</strong> — โฮสต์เว็บไซต์</>,
          <><strong className="text-ink">Google</strong> — เข้าสู่ระบบ (Google Sign-In), Google Analytics และ Google Sheets (บันทึกยอดขาย/การเข้าชม)</>,
        ]}
      />
      <p>ผู้ให้บริการเหล่านี้อาจจัดเก็บข้อมูลบนเซิร์ฟเวอร์นอกประเทศไทย ภายใต้มาตรการรักษาความปลอดภัยของแต่ละราย</p>

      <H2>5. คุกกี้และการจัดเก็บในเบราว์เซอร์</H2>
      <List
        items={[
          "คุกกี้เข้าสู่ระบบ (จำเป็น) — จำว่าเข้าสู่ระบบอยู่ อายุไม่เกิน 180 วัน ลบได้ด้วยการกด “ออกจากระบบ”",
          "คุกกี้ชั่วคราวระหว่างเข้าสู่ระบบด้วย Google (หมดอายุภายใน 15 นาที)",
          "ข้อมูลในเบราว์เซอร์ (localStorage) สำหรับกลับไปทำข้อสอบที่ค้างไว้ต่อ",
          "คุกกี้ของ Google Analytics สำหรับสถิติการเข้าชม",
        ]}
      />

      <H2>6. ระยะเวลาเก็บและความปลอดภัย</H2>
      <p>
        เราเก็บข้อมูลบัญชีและคำสั่งซื้อไว้ตลอดระยะเวลาที่ผู้ใช้ยังมีสิทธิ์เข้าถึงคอร์ส
        และตามระยะเวลาที่กฎหมายภาษี/บัญชีกำหนด ข้อมูลถูกส่งผ่านการเชื่อมต่อที่เข้ารหัส (HTTPS)
        ฐานข้อมูลและที่เก็บไฟล์ไม่เปิดให้เข้าถึงจากภายนอก และเข้าถึงได้เฉพาะระบบฝั่งเซิร์ฟเวอร์ของเรา
      </p>

      <H2>7. สิทธิ์ของผู้ใช้</H2>
      <p>
        ผู้ใช้ขอเข้าถึง ขอสำเนา ขอแก้ไข หรือขอลบข้อมูลส่วนบุคคลของตนได้ทางอีเมล {mail} (การลบบัญชีจะทำให้เข้าคอร์สที่ซื้อไว้ไม่ได้อีก)
        และยกเลิกสิทธิ์ที่ให้เว็บไซต์เข้าถึงบัญชี Google ได้ทุกเมื่อที่{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-maroon underline underline-offset-2"
        >
          myaccount.google.com/permissions
        </a>
      </p>

      <H2>8. การเปลี่ยนแปลงนโยบายและการติดต่อ</H2>
      <p>
        หากมีการเปลี่ยนแปลงนโยบายนี้ เราจะปรับวันที่ “ปรับปรุงล่าสุด” ด้านบน สอบถามเรื่องข้อมูลส่วนบุคคลได้ที่ {mail}
      </p>

      <div className="mt-14 border-t border-grid pt-8 text-[0.95rem] text-ink/75" lang="en">
        <H2>Summary (English)</H2>
        <p>
          tpat3mock.com (“Mr.tpat3”) sells TPAT3 mock exams, an online exam room and study materials. When you sign in
          with Google we receive only your name, email address and profile picture (scopes: openid, email, profile). We
          use them solely to authenticate you, link your purchases to your account, check access to the exam room and
          purchased files, and display the signed-in account. We do not access Gmail, Drive, contacts or any other
          Google data, we do not sell or share Google user data, and we do not use it for advertising or to train AI
          models. Mr.tpat3’s use and transfer of information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-maroon underline underline-offset-2"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Data is processed by Supabase (auth, database, storage), Stripe
          (payments), Vercel (hosting) and Google (Sign-In, Analytics, Sheets). To access or delete your data, email{" "}
          {mail}; you can revoke access at myaccount.google.com/permissions.
        </p>
      </div>
    </LegalLayout>
  );
}
