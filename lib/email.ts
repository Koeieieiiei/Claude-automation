import { Resend } from "resend";
import { config, ready } from "./config";

/**
 * ส่งอีเมลพร้อมลิงก์ดาวน์โหลดให้ลูกค้า
 * ถ้ายังไม่ได้ตั้งค่า Resend จะแค่ log ออก console (โหมดทดสอบ) ไม่ส่งจริง
 */
export async function sendDownloadEmail(input: {
  to: string;
  firstName: string;
  productName: string;
  links: { label: string; url: string }[];
  expiryHours: number;
}): Promise<void> {
  const subject = `ดาวน์โหลด ${input.productName} ของคุณ`;
  const fileCount = input.links.length;
  // โชว์อายุลิงก์เป็น "วัน" ถ้าหารด้วย 24 ลงตัว (เช่น 168 ชม. → 7 วัน) อ่านง่ายกว่า
  const expiryText =
    input.expiryHours % 24 === 0 ? `${input.expiryHours / 24} วัน` : `${input.expiryHours} ชั่วโมง`;
  const buttons = input.links
    .map(
      (l) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:#6E1423;border-radius:8px"><a href="${l.url}" style="display:inline-block;color:#ffffff;padding:14px 30px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,sans-serif">ดาวน์โหลด${escapeHtml(l.label)} &rarr;</a></td></tr></table>`
    )
    .join("");
  const html =
    `<div style="font-family:Arial,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#241016">` +
    `<h2 style="color:#6E1423">ขอบคุณสำหรับการสั่งซื้อ 🎉</h2>` +
    `<p>สวัสดีคุณ <strong>${escapeHtml(input.firstName)}</strong></p>` +
    `<p>การชำระเงินสำหรับ <strong>${escapeHtml(input.productName)}</strong> สำเร็จแล้ว คุณจะได้รับ <strong>${fileCount} ไฟล์</strong> กดปุ่มด้านล่างเพื่อดาวน์โหลดแต่ละไฟล์</p>` +
    `<div style="margin-top:20px">${buttons}</div>` +
    `<p style="color:#666;font-size:13px;border-top:1px solid #eeeeee;padding-top:14px;margin-top:18px">ลิงก์เหล่านี้จะหมดอายุใน ${expiryText}<br/>⚠️ ไฟล์มีลายน้ำระบุชื่อและอีเมลของคุณ โปรดอย่าเผยแพร่ต่อ</p>` +
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
