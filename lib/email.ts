import { Resend } from "resend";
import { config, ready } from "./config";
import { formatExpiry } from "./format-expiry";

/**
 * ส่งอีเมลพร้อมลิงก์ดาวน์โหลดให้ลูกค้า
 * ถ้ายังไม่ได้ตั้งค่า Resend จะแค่ log ออก console (โหมดทดสอบ) ไม่ส่งจริง
 */
export async function sendDownloadEmail(input: {
  to: string;
  firstName: string;
  productName: string;
  links: { label: string; url: string }[];
  /** อายุลิงก์ (ชั่วโมง) — 0 = ไม่มีวันหมดอายุ */
  expiryHours: number;
  /** ชุดนี้มีสิทธิ์ทำข้อสอบออนไลน์ไหม (ชุดที่มีไฟล์โจทย์) */
  hasExam?: boolean;
}): Promise<void> {
  const subject = `ดาวน์โหลด ${input.productName} ของคุณ`;
  const fileCount = input.links.length;
  const expiryText = formatExpiry(input.expiryHours);
  const footerNote = expiryText
    ? `เก็บอีเมลฉบับนี้ไว้ได้เลย — ลิงก์ดาวน์โหลดใช้ได้อีก ${expiryText}`
    : "เก็บอีเมลฉบับนี้ไว้ได้เลย — ลิงก์ดาวน์โหลดไม่มีวันหมดอายุ";
  const buttons = input.links
    .map(
      (l) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:#6E1423;border-radius:8px"><a href="${l.url}" style="display:inline-block;color:#ffffff;padding:14px 30px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,sans-serif">ดาวน์โหลด${escapeHtml(l.label)} &rarr;</a></td></tr></table>`
    )
    .join("");
  // ชุดที่มีข้อสอบ: ชวนเข้าห้องสอบก่อน แล้วค่อยเป็นไฟล์ พร้อมเตือนเรื่องเปิดเฉลย
  const examBlock = input.hasExam
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="background:#6E1423;border-radius:8px"><a href="${config.baseUrl}/exam" style="display:inline-block;color:#ffffff;padding:16px 34px;text-decoration:none;font-weight:700;font-size:16px;font-family:Arial,sans-serif">เริ่มสอบ TPAT3 &middot; 70 ข้อ &middot; จับเวลา 3 ชม. &rarr;</a></td></tr></table>` +
      `<p style="color:#666;font-size:13px;margin:0 0 22px">กรอกชื่อ นามสกุล และอีเมลให้ตรงกับที่สั่งซื้อเพื่อเข้าห้องสอบ &middot; 1 อีเมลมีสิทธิ์สอบ 1 รอบ &middot; แนะนำให้ทำในคอมพิวเตอร์หรือ iPad</p>` +
      `<p style="font-size:14px;margin:0 0 10px"><strong>ไฟล์ของคุณ ${fileCount} ไฟล์</strong> — แนะนำให้เปิดไฟล์เฉลยหลังทำข้อสอบเสร็จ ผลวิเคราะห์จะได้ตรงกับฝีมือจริง</p>`
    : `<p>การชำระเงินสำหรับ <strong>${escapeHtml(input.productName)}</strong> สำเร็จแล้ว คุณจะได้รับ <strong>${fileCount} ไฟล์</strong> กดปุ่มด้านล่างเพื่อดาวน์โหลดแต่ละไฟล์</p>`;

  const html =
    `<div style="font-family:Arial,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#241016">` +
    `<h2 style="color:#6E1423">ขอบคุณสำหรับการสั่งซื้อ 🎉</h2>` +
    `<p>สวัสดีคุณ <strong>${escapeHtml(input.firstName)}</strong></p>` +
    (input.hasExam
      ? `<p>การชำระเงินสำหรับ <strong>${escapeHtml(input.productName)}</strong> สำเร็จแล้ว เข้าห้องสอบออนไลน์ได้เลย</p>`
      : "") +
    examBlock +
    `<div style="margin-top:8px">${buttons}</div>` +
    `<p style="color:#666;font-size:13px;border-top:1px solid #eeeeee;padding-top:14px;margin-top:18px">${escapeHtml(footerNote)}</p>` +
    `</div>`;

  if (!ready.resend) {
    console.log("📧 [MOCK EMAIL] (ยังไม่ได้ตั้งค่า Resend) ส่งถึง:", input.to);
    input.links.forEach((l) => console.log(`    ${l.label}:`, l.url));
    return;
  }

  const resend = new Resend(config.resend.apiKey);
  const { error } = await resend.emails.send({
    from: config.resend.from,
    to: input.to,
    subject,
    html,
  });
  if (error) throw new Error(`ส่งอีเมลไม่สำเร็จ: ${JSON.stringify(error)}`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
