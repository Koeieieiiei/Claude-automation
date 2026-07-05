// ทดสอบส่งอีเมลผ่าน Resend
// รัน: node --env-file=.env.local scripts/test-email.mjs you@email.com
import { Resend } from "resend";

const to = process.argv[2];
if (!to) {
  console.error("ใส่อีเมลปลายทาง: node --env-file=.env.local scripts/test-email.mjs you@email.com");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: process.env.EMAIL_FROM || "onboarding@resend.dev",
  to,
  subject: "ทดสอบระบบส่งอีเมล (Mock TPAT3 Shop)",
  html: "<p>ถ้าคุณเห็นอีเมลนี้ แปลว่าระบบส่งอีเมล (Resend) ทำงานได้แล้ว ✅</p>",
});

if (error) {
  console.error("❌ ส่งไม่สำเร็จ:", JSON.stringify(error));
  process.exit(1);
}
console.log("✅ ส่งสำเร็จ! id =", data?.id, "-> ตรวจกล่องอีเมล (รวมโฟลเดอร์ Spam)");
