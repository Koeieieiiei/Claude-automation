import { Resend } from "resend";
import { config, ready } from "./config";
import { formatExpiry } from "./format-expiry";

/**
 * ที่อยู่ผู้ส่ง — EMAIL_FROM บน Vercel/.env.local ใส่ชื่อผู้ส่งเป็นภาษาไทย ("TPAT3 … <noreply@tpat3mock.com>")
 * ซึ่ง Resend ปฏิเสธ (ตอบ validation_error ว่าที่อยู่ยาวเกิน 320 ตัว — เจอจริง 2026-09-27)
 * จึงดึงเฉพาะอีเมลใน <…> มาใช้กับชื่อผู้ส่งภาษาอังกฤษแทน · ค่าที่เป็น ASCII ล้วนอยู่แล้วใช้ตามเดิม
 */
export function senderAddress(): string {
  const raw = config.resend.from.trim();
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(raw)) return raw;
  const m = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  return m ? `Mr.tpat3 <${m[1]}>` : "Mr.tpat3 <noreply@tpat3mock.com>";
}

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
      `<p style="color:#666;font-size:13px;margin:0 0 22px">เข้าสู่ระบบด้วยอีเมลเดียวกับที่สั่งซื้อเพื่อเข้าห้องสอบ &middot; 1 อีเมลมีสิทธิ์สอบ 1 รอบ &middot; แนะนำให้ทำในคอมพิวเตอร์หรือ iPad</p>` +
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
    `<p style="font-size:14px;margin:18px 0 0">ไฟล์ทั้งหมดกลับมาโหลดซ้ำได้ตลอดที่หน้า <a href="${config.baseUrl}/my-courses" style="color:#6E1423;font-weight:700">คอร์สของฉัน</a> (เข้าสู่ระบบด้วยอีเมลนี้)</p>` +
    `<p style="color:#666;font-size:13px;border-top:1px solid #eeeeee;padding-top:14px;margin-top:18px">${escapeHtml(footerNote)}</p>` +
    `</div>`;

  if (!ready.resend) {
    console.log("📧 [MOCK EMAIL] (ยังไม่ได้ตั้งค่า Resend) ส่งถึง:", input.to);
    input.links.forEach((l) => console.log(`    ${l.label}:`, l.url));
    return;
  }

  const resend = new Resend(config.resend.apiKey);
  const { error } = await resend.emails.send({
    from: senderAddress(),
    to: input.to,
    subject,
    html,
  });
  if (error) throw new Error(`ส่งอีเมลไม่สำเร็จ: ${JSON.stringify(error)}`);
}

/**
 * อีเมลลิงก์ "ตั้งรหัสผ่าน" (ลืมรหัสผ่าน / ลูกค้าเก่าที่ยังไม่มีรหัสผ่าน / อีเมลที่มีคอร์สอยู่แล้วมาสมัคร)
 * ลิงก์ใช้ได้ 30 นาที (lib/password-reset-token.ts) · ไม่ได้ตั้งค่า Resend = log ลิงก์ออก console (dev)
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  link: string;
  reason: "forgot" | "existing-customer";
}): Promise<void> {
  const lead =
    input.reason === "existing-customer"
      ? "อีเมลนี้มีคอร์สของ Mr.tpat3 อยู่แล้ว — กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านและเข้าสู่ระบบ (ยืนยันว่าอีเมลนี้เป็นของคุณ)"
      : "มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ — กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่";
  const html =
    `<div style="font-family:Arial,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#241016">` +
    `<h2 style="color:#6E1423">ตั้งรหัสผ่าน Mr.tpat3</h2>` +
    `<p>${escapeHtml(lead)}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="background:#6E1423;border-radius:8px"><a href="${input.link}" style="display:inline-block;color:#ffffff;padding:14px 30px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,sans-serif">ตั้งรหัสผ่าน &rarr;</a></td></tr></table>` +
    `<p style="font-size:13px;color:#666">ลิงก์ใช้ได้ 30 นาที และใช้ได้ครั้งเดียว ถ้าปุ่มกดไม่ได้ คัดลอกลิงก์นี้ไปเปิด:<br><a href="${input.link}" style="color:#6E1423;word-break:break-all">${input.link}</a></p>` +
    `<p style="color:#666;font-size:13px;border-top:1px solid #eeeeee;padding-top:14px;margin-top:18px">ถ้าไม่ได้เป็นคนขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ ติดต่อ mr.tpat3@gmail.com</p>` +
    `</div>`;

  if (!ready.resend) {
    console.log("📧 [MOCK EMAIL] (ยังไม่ได้ตั้งค่า Resend) ลิงก์ตั้งรหัสผ่านของ", input.to, "→", input.link);
    return;
  }
  const resend = new Resend(config.resend.apiKey);
  const { error } = await resend.emails.send({
    from: senderAddress(),
    to: input.to,
    subject: "ตั้งรหัสผ่านสำหรับ Mr.tpat3 (ลิงก์ใช้ได้ 30 นาที)",
    html,
  });
  if (error) throw new Error(`ส่งอีเมลตั้งรหัสผ่านไม่สำเร็จ: ${JSON.stringify(error)}`);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
