// ส่งอีเมลตัวอย่าง (หน้าตาเดียวกับอีเมลส่งไฟล์จริง) เพื่อดู layout
// รัน: node --env-file=.env.local scripts/preview-email.mjs you@email.com
import { Resend } from "resend";

const to = process.argv[2];
if (!to) { console.error("ใส่อีเมลปลายทาง"); process.exit(1); }

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const firstName = "ศุภวัฒน์";
const productName = "ข้อสอบ Mock TPAT3 (Ebook)";
const expiryHours = 72;
// ลิงก์ตัวอย่าง (ของจริงจะเป็นลิงก์ดาวน์โหลดเฉพาะของลูกค้า)
const links = [
  { label: "ไฟล์โจทย์", url: "https://tpat3mock.com" },
  { label: "ไฟล์เฉลย", url: "https://tpat3mock.com" },
];

const buttons = links
  .map((l) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td style="background:#6E1423;border-radius:8px"><a href="${l.url}" style="display:inline-block;color:#ffffff;padding:14px 30px;text-decoration:none;font-weight:600;font-size:15px;font-family:Arial,sans-serif">ดาวน์โหลด${esc(l.label)} &rarr;</a></td></tr></table>`)
  .join("");

const html =
  `<div style="font-family:Arial,'Helvetica Neue',sans-serif;max-width:560px;margin:0 auto;color:#241016">` +
  `<h2 style="color:#6E1423">ขอบคุณสำหรับการสั่งซื้อ 🎉</h2>` +
  `<p>สวัสดีคุณ <strong>${esc(firstName)}</strong></p>` +
  `<p>การชำระเงินสำหรับ <strong>${esc(productName)}</strong> สำเร็จแล้ว คุณจะได้รับ <strong>2 ไฟล์</strong> กดปุ่มด้านล่างเพื่อดาวน์โหลดแต่ละไฟล์</p>` +
  `<div style="margin-top:20px">${buttons}</div>` +
  `<p style="color:#666;font-size:13px;border-top:1px solid #eeeeee;padding-top:14px;margin-top:18px">ลิงก์เหล่านี้จะหมดอายุใน ${expiryHours} ชั่วโมง</p>` +
  `</div>`;

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_FROM,
  to,
  subject: "[ตัวอย่าง] ดาวน์โหลด " + productName,
  html,
});
if (error) { console.error("❌", JSON.stringify(error)); process.exit(1); }
console.log("✅ ส่งอีเมลตัวอย่างแล้ว id =", data?.id);
