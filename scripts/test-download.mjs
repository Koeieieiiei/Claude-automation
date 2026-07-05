// ทดสอบ pipeline ดาวน์โหลด: สร้าง token แล้วโหลดไฟล์ลายน้ำจาก dev server
// ต้องเปิด `npm run dev` ไว้ก่อน
// รัน: node --env-file=.env.local scripts/test-download.mjs
import { createHmac } from "crypto";
import { writeFile } from "fs/promises";

const secret = process.env.DOWNLOAD_SECRET || "dev-insecure-secret";
const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const payload = {
  orderId: "selftest-001",
  firstName: "สมหญิง",
  lastName: "รักเรียน",
  email: "selftest@example.com",
  exp: Date.now() + 3600 * 1000,
};
const body = b64url(Buffer.from(JSON.stringify(payload)));
const sig = b64url(createHmac("sha256", secret).update(body).digest());
const token = `${body}.${sig}`;

for (const file of ["questions", "answers"]) {
  const res = await fetch(`${base}/api/download/${file}/${token}`);
  if (!res.ok) {
    console.error(`❌ ${file}: HTTP ${res.status} ${await res.text()}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const isPdf = buf.subarray(0, 5).toString() === "%PDF-";
  await writeFile(`verify-${file}.pdf`, buf);
  console.log(`✅ ${file}: ${(buf.length / 1024).toFixed(0)} KB, PDF=${isPdf} -> verify-${file}.pdf`);
}
