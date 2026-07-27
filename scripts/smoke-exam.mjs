/**
 * ตรวจสุขภาพ "ห้องสอบ" แบบครบวงจรกับเซิร์ฟเวอร์ที่รันอยู่จริง
 *
 *   node scripts/smoke-exam.mjs            (ต้องเปิดเว็บไว้ที่ localhost:3000 ก่อน)
 *   ROUNDS=20 BASE=http://localhost:3000 node scripts/smoke-exam.mjs
 *
 * ทำซ้ำหลายรอบ: ยืนยันตัวตน → เริ่มสอบ → autosave → กดส่ง → เปิดหน้าผล
 * และจงใจให้ autosave "ยิงชนกับการกดส่ง" ในรอบคู่ เพื่อจับบั๊กที่เคยเกิดจริง:
 *   - หน้าผลขึ้น "ยังไม่มีผลสอบของอีเมลนี้" ทั้งที่ส่งไปแล้ว (2026-07-26)
 *   - คำขอ autosave ที่มาช้าเขียนทับผลที่ตรวจแล้ว
 *
 * ใช้อีเมลเจ้าของร้าน (ทำซ้ำได้ไม่จำกัด) — การเริ่มรอบใหม่จะถอนผลรอบก่อน
 * ออกจากสถิติรวมให้เอง จึงไม่ทิ้งขยะไว้ในข้อมูลจริง
 */
const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.EXAM_SMOKE_EMAIL || "marcoco9no.1@gmail.com";
const ROUNDS = Number(process.env.ROUNDS || 6);

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const randomAnswers = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 5));

let failures = 0;

for (let round = 1; round <= ROUNDS; round++) {
  const access = await post("/api/exam/access", {
    examId: "tpat3-1",
    email: EMAIL,
    firstName: "เจ้าของ",
    lastName: "ร้าน",
  });
  const token = access.data?.token;
  if (!token) {
    console.log(`รอบ ${round}: ❌ ขอสิทธิ์เข้าห้องสอบไม่ได้ (${access.status})`, access.data);
    failures++;
    continue;
  }

  const start = await post("/api/exam/start", { token });
  if (start.status !== 200) {
    console.log(`รอบ ${round}: ❌ เริ่มสอบไม่ได้ (${start.status})`, start.data);
    failures++;
    continue;
  }

  const answers = randomAnswers(Array.isArray(start.data?.answers) ? start.data.answers.length : 70);
  await post("/api/exam/save", { token, answers });

  // รอบคู่: จำลอง autosave ที่ค้างอยู่ ยิงพร้อมกับตอนกดส่ง
  const race = round % 2 === 0;
  const [submit, lateSave] = await Promise.all([
    post("/api/exam/submit", { token, answers }),
    race ? post("/api/exam/save", { token, answers }) : Promise.resolve({ status: 0 }),
  ]);

  const results = await get(`/api/exam/results?token=${encodeURIComponent(token)}`);
  const ok = submit.status === 200 && results.status === 200;
  if (!ok) failures++;

  console.log(
    `รอบ ${round}${race ? " [autosave ชนตอนกดส่ง]" : ""}: ` +
      `ส่ง=${submit.status} autosaveช้า=${lateSave.status} หน้าผล=${results.status} ` +
      (ok
        ? `✅ ${results.data?.score?.correctCount}/${results.data?.score?.totalQuestions} ข้อ`
        : `❌ ${JSON.stringify(results.data)}`)
  );
}

// เก็บกวาด: ถอนผลรอบสุดท้ายออกจากสถิติรวม ไม่ให้คะแนนทดสอบไปปนกับผู้สอบจริง
// (ใช้ช่องทางโหมดทดสอบ ซึ่งเปิดเฉพาะเครื่องที่ตั้ง EXAM_DEMO=1 — เว็บจริงตอบ 404)
const cleanup = await post("/api/exam/demo", { action: "reset", examId: "tpat3-1", email: EMAIL });
console.log(
  cleanup.status === 200
    ? "เก็บกวาดข้อมูลทดสอบเรียบร้อย (ถอนผลรอบสุดท้ายออกจากสถิติแล้ว)"
    : `⚠️ ยังเก็บกวาดไม่ได้ (${cleanup.status}) — ผลรอบสุดท้ายของ ${EMAIL} ยังค้างอยู่ในสถิติ`
);

console.log(`\nสรุป: ล้มเหลว ${failures}/${ROUNDS} รอบ`);
process.exit(failures ? 1 : 0);
