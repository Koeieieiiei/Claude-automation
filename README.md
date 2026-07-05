# ร้านขาย Ebook ข้อสอบ Mock TPAT3 (อัตโนมัติเต็มรูปแบบ)

เว็บขายข้อสอบ Mock TPAT3 แบบ ebook ที่ทำงานอัตโนมัติทุกขั้นตอน — ลูกค้าจ่ายเงินผ่าน
**PromptPay** แล้วระบบจะ **ฝังลายน้ำชื่อ-อีเมลผู้ซื้อลง PDF + ส่งอีเมลลิงก์ดาวน์โหลด** ให้เอง
โดยที่เจ้าของร้านไม่ต้องแตะอะไรเลย

- **เว็บจริง:** https://tpat3mock.com
- **สถานะ:** 🟢 เปิดใช้งานจริง (production) — Stripe โหมด Live, รับเงินจริงได้แล้ว
- **สแตก:** Next.js 15 (App Router) · Stripe · Supabase · Resend · pdf-lib · Vercel

> 📄 รายละเอียดบริการแต่ละตัว (ราคา/เมื่อไหร่ควรอัปเกรด) ดูที่ [SERVICES.md](SERVICES.md)

---

## 🔄 ระบบทำงานยังไง — ตั้งแต่ลูกค้ากดซื้อ จนได้ไฟล์

### ภาพรวม
```
[1] ลูกค้ากดซื้อ + กรอกชื่อ/นามสกุล/อีเมล
        │  (BuyModal.tsx → POST /api/checkout)
        ▼
[2] สร้าง order สถานะ "pending" ในฐานข้อมูล + สร้าง Stripe Checkout Session
        │  เก็บชื่อ/อีเมลผู้ซื้อไว้ใน metadata ของ session
        ▼
[3] ลูกค้าถูกพาไปหน้า Stripe → สแกน QR PromptPay จ่ายเงิน
        │
        ├──(จ่ายสำเร็จ)──► Stripe ยิง webhook กลับมาที่ /api/stripe/webhook
        │
        ▼
[4] webhook ตรวจลายเซ็น Stripe → เช็คว่าจ่ายจริง (payment_status = paid)
        │  กันส่งซ้ำ: ถ้า order = "delivered" แล้ว → ข้าม
        ▼
[5] fulfillOrder() ทำงานอัตโนมัติ:
        ├─ สร้าง "download token" เซ็นด้วย HMAC (ฝังชื่อ/อีเมล + วันหมดอายุ)
        ├─ ส่งอีเมลพร้อมลิงก์ดาวน์โหลด 2 ไฟล์ (โจทย์ + เฉลย) ผ่าน Resend
        └─ อัปเดต order เป็น "delivered"
        ▼
[6] ลูกค้าเปิดอีเมล → กดลิงก์ → GET /api/download/{file}/{token}
        │  ตรวจ token (ลายเซ็น + วันหมดอายุ) ถ้าไม่ผ่าน → 403
        ▼
[7] โหลด PDF ต้นฉบับจาก Supabase Storage → ฝังลายน้ำ (ชื่อ+อีเมล) แบบ on-the-fly
        ▼
[8] ส่งไฟล์ PDF ที่มีลายน้ำกลับให้ลูกค้าดาวน์โหลด ✅
```

### รายละเอียดทีละขั้น

**[1] ลูกค้ากดซื้อ + กรอกข้อมูล** — [components/BuyModal.tsx](components/BuyModal.tsx)
ลูกค้ากดปุ่ม "สั่งซื้อ" บนหน้าหลัก ([app/page.tsx](app/page.tsx)) → popup เด้งขึ้นให้กรอก ชื่อ/นามสกุล/อีเมล
ฝั่ง client เช็ครูปแบบอีเมลและฟิลด์ครบก่อน แล้วยิง `POST /api/checkout`
มีคำเตือนชัดเจนให้ตรวจอีเมลให้ถูก (เพราะไฟล์จะถูกส่งไปอีเมลนี้ และไม่มีการคืนเงิน)

**[2] สร้าง order + Stripe session** — [app/api/checkout/route.ts](app/api/checkout/route.ts)
- validate ข้อมูลด้วย `zod` (ชื่อ ≤100 ตัว, อีเมลถูกรูปแบบ)
- `createOrder()` บันทึก order สถานะ `pending` ([lib/orders.ts](lib/orders.ts))
- สร้าง Stripe Checkout Session โดยรับ **PromptPay เท่านั้น** (`payment_method_types: ["promptpay"]`)
- ฝังข้อมูลผู้ซื้อไว้ใน `metadata` เพื่อให้ webhook ใช้สร้างลายน้ำภายหลัง
- คืน URL หน้าจ่ายเงินกลับไป → BuyModal พาลูกค้าไปต่อ
- ครอบ `try/catch` ทั้งหมด — ถ้า Stripe ล่ม จะคืน error เป็น JSON ที่หน้าเว็บอ่านได้

**[3] ลูกค้าจ่ายเงิน** — บนหน้า Stripe Checkout (hosted)
ลูกค้าสแกน QR PromptPay ด้วยแอปธนาคาร เมื่อจ่ายสำเร็จ Stripe จะส่ง event กลับมา
(PromptPay ยืนยันแบบ async จึงมาทาง `checkout.session.async_payment_succeeded`)

**[4] webhook รับสัญญาณจ่ายเงิน** — [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts)
- ตรวจ **ลายเซ็น Stripe** (`constructEvent`) ด้วย raw body — กันคนปลอม event
- รับ 2 event: `checkout.session.completed` (กรณีจ่ายทันที) และ `async_payment_succeeded` (PromptPay)
- **กันส่งซ้ำ (idempotency) แบบ atomic:** ใช้ `claimDelivery()` จองสิทธิ์ส่งของในคำสั่งเดียว — webhook ที่มาซ้ำ/พร้อมกันจะถูกข้าม

**[5] ส่งของอัตโนมัติ** — [lib/fulfillment.ts](lib/fulfillment.ts)
- เช็คก่อนว่าไฟล์ต้นฉบับ (โจทย์+เฉลย) มีจริง — ถ้าไม่มีจะล้มก่อนส่งอีเมล ไม่หลอกลูกค้าด้วยลิงก์เสีย
- `createDownloadToken()` สร้าง token เซ็น HMAC ([lib/download-token.ts](lib/download-token.ts)) — ฝังชื่อ/อีเมล + วันหมดอายุ (ดีฟอลต์ 72 ชม.)
- ส่งอีเมล HTML พร้อมปุ่มดาวน์โหลด 2 ไฟล์ผ่าน Resend ([lib/email.ts](lib/email.ts))

**[6]-[8] ลูกค้าโหลดไฟล์** — [app/api/download/[file]/[token]/route.ts](app/api/download/%5Bfile%5D/%5Btoken%5D/route.ts)
- `verifyDownloadToken()` ตรวจลายเซ็น (timing-safe) + วันหมดอายุ → ไม่ผ่านคืน 403
- โหลด PDF ต้นฉบับจาก Supabase Storage (มี cache ระดับ instance) ([lib/watermark.ts](lib/watermark.ts))
- ฝังลายน้ำ **ตอนกดดาวน์โหลด** (on-the-fly): ชื่อ+อีเมลทแยงกลางหน้า + แถบล่างทุกหน้า
- ส่ง PDF กลับเป็นไฟล์ดาวน์โหลด

> 🔐 **ทำไมฝังลายน้ำตอนดาวน์โหลด ไม่ใช่ตอนซื้อ?** เพื่อไม่ต้องเก็บไฟล์ราย-ลูกค้า และผูกตัวตนผู้ซื้อกับไฟล์ทุกครั้ง

---

## 🔒 ความปลอดภัย

- **ลิงก์ดาวน์โหลดเซ็นด้วย HMAC-SHA256** + มีวันหมดอายุ — ปลอมไม่ได้ ([lib/download-token.ts](lib/download-token.ts))
- **Guard กันคีย์ลับอ่อน:** ถ้า `DOWNLOAD_SECRET` ไม่ปลอดภัย (ว่าง/สั้น/เป็นค่า placeholder) ระบบจะ **หยุดทำงานทันที** ทุกที่ที่ไม่ใช่ dev แทนที่จะปล่อยให้ปลอมลิงก์ได้ ([lib/config.ts](lib/config.ts))
- **ตรวจลายเซ็น Stripe webhook** ทุกครั้ง กัน event ปลอม
- **กัน formula injection** ใน Google Sheets — เขียนแบบ RAW + neutralize อักขระอันตราย ([lib/sheets.ts](lib/sheets.ts))
- **escapeHtml** ชื่อผู้ซื้อก่อนใส่ในอีเมล กัน HTML injection ([lib/email.ts](lib/email.ts))
- ใช้ **service role key ฝั่ง server เท่านั้น** + เปิด RLS บนตาราง orders

---

## 🧪 รันทดสอบบนเครื่อง

### โหมด mock (ยังไม่ต้องมี API key)
ระบบเข้า "โหมด mock" อัตโนมัติเมื่อยังไม่มี key — ข้ามการเรียก service จริง
```bash
npm install
node scripts/make-sample-pdf.mjs   # สร้าง PDF ตัวอย่าง 2 ไฟล์ (โจทย์+เฉลย)
npm run dev                        # เปิด http://localhost:3000
```
กดซื้อ → กรอกข้อมูล → เด้งไปหน้า success และ **ลิงก์ดาวน์โหลดจะถูก print ใน console**

### ทดสอบเต็มวงจรกับ Stripe (โหมด Test — ไม่เสียเงินจริง)
เปิด 2 Terminal ในโฟลเดอร์โปรเจกต์:
1. `npm run dev`
2. `npm run stripe:listen` (ครั้งแรกรัน `npm run stripe:login` ก่อน 1 ครั้ง)

แล้วเปิด http://localhost:3000 → กดซื้อ → ที่หน้าจ่ายเงินเลือก PromptPay (โหมด test จะมี QR จำลอง)
จ่ายเสร็จ → ดู console จะเห็น "✅ ส่งของสำเร็จ" พร้อมลิงก์ดาวน์โหลด

### รัน unit test
```bash
npm test                           # vitest — 32 เคส (token, config guard, track route, idempotency, sheets sanitize)
```

---

## 🚀 Deploy ขึ้น production

โปรเจกต์นี้ deploy ผ่าน **Vercel CLI** (ไม่ได้เชื่อม Git):
```bash
npx vercel --prod --yes
```
- ถ้า token หมดอายุ ให้ `npx vercel login` ก่อน (ครั้งเดียว)
- บน Windows PowerShell ถ้าเจอ error "running scripts is disabled" ให้รัน
  `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` ก่อน
- Environment variables ทั้งหมดตั้งไว้ใน **Vercel > Settings > Environment Variables** (โหมด Live)
  ดูได้ด้วย `npx vercel env ls production`

> ⚠️ ไฟล์ `.env.local` ในเครื่องใช้คีย์ **Test** เพื่อทดสอบโดยไม่ตัดเงินจริง
> ส่วน production บน Vercel ใช้คีย์ **Live** — แยกกันแบบนี้ถูกต้องแล้ว ห้ามเอาคีย์ Live มาใส่ในเครื่อง

---

## ✅ เช็กลิสต์พร้อมขายจริง
- [x] Stripe โหมด Live + ผูกบัญชีธนาคาร + เปิด PromptPay
- [x] Webhook โหมด Live ตั้งแล้ว (events: `checkout.session.completed`, `async_payment_succeeded`)
- [x] Resend verify โดเมนครบ (DKIM/SPF/DMARC) — อีเมลส่งถึงทุกค่าย
- [x] โดเมน + DNS ชี้มา Vercel
- [x] `DOWNLOAD_SECRET` บน production ปลอดภัย (สุ่ม 64 ตัว)
- [x] Deploy + unit test ผ่าน
- [ ] **ทดสอบกดดาวน์โหลดจากอีเมลจริง** ว่าได้ไฟล์ที่มีลายน้ำ (ขั้นสุดท้ายที่ควรยืนยัน)
- [ ] อัปเกรด Vercel เป็น Pro (เว็บเชิงพาณิชย์ ไม่ควรอยู่บนแพ็ก Hobby)
- [ ] เปิด Auto-Renew โดเมนใน Namecheap

---

## 📁 โครงสร้างโค้ดสำคัญ
| ไฟล์ | หน้าที่ |
|------|--------|
| [app/page.tsx](app/page.tsx) | หน้าขาย + FAQ |
| [components/BuyModal.tsx](components/BuyModal.tsx) | ฟอร์มกรอกชื่อ/อีเมล |
| [app/api/checkout/route.ts](app/api/checkout/route.ts) | สร้าง order + Stripe Checkout Session |
| [app/api/stripe/webhook/route.ts](app/api/stripe/webhook/route.ts) | รับสัญญาณจ่ายเงิน → สั่งส่งของ |
| [app/api/download/[file]/[token]/route.ts](app/api/download/%5Bfile%5D/%5Btoken%5D/route.ts) | ตรวจ token → ฝังลายน้ำ → ส่งไฟล์ |
| [lib/fulfillment.ts](lib/fulfillment.ts) | ออเคสเตรชัน: สร้างลิงก์ + ส่งอีเมล |
| [lib/watermark.ts](lib/watermark.ts) | ฝังลายน้ำ PDF |
| [lib/download-token.ts](lib/download-token.ts) | ลิงก์ดาวน์โหลดเซ็น HMAC + หมดอายุ + guard |
| [lib/config.ts](lib/config.ts) | อ่าน env + ตรวจความพร้อม/ความปลอดภัยของแต่ละ service |
| [app/success/page.tsx](app/success/page.tsx) | หน้าหลังจ่ายเงิน + เตือนเช็ก Junk/Spam |

---

## ⚠️ ข้อจำกัดที่ควรรู้
- **ลายน้ำกันแชร์ได้ระดับหนึ่ง ไม่ 100%** — ช่วยสืบหาต้นตอคนแชร์ แต่กันแคป/ส่งต่อไม่ได้ทั้งหมด
- **ไม่รับคืนเงิน** — เป็นสินค้าดิจิทัลที่ส่งทันที (ระบุใน FAQ บนเว็บแล้ว)
- **ความเสี่ยงคงเหลือ (volume ต่ำยอมรับได้):** webhook ยังไม่มี idempotency ด้วย `event.id`, และยังไม่มี timeout บนการเรียก service ภายนอก
- **ลิขสิทธิ์เนื้อหา** — ข้อสอบที่ขายต้องเป็นผลงานของคุณเอง
