import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { getStripe } from "@/lib/stripe";
import { getOrder, updateOrder } from "@/lib/orders";
import { fulfillOrder } from "@/lib/fulfillment";

// Stripe ต้องการ raw body เพื่อตรวจลายเซ็น — ปิด body parser ด้วย runtime nodejs + อ่าน text เอง
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !config.stripe.webhookSecret) {
    return NextResponse.json({ error: "Stripe ยังไม่ถูกตั้งค่า" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "ไม่มีลายเซ็น" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, config.stripe.webhookSecret);
  } catch (err) {
    console.error("ตรวจลายเซ็น webhook ไม่ผ่าน:", err);
    return NextResponse.json({ error: "ลายเซ็นไม่ถูกต้อง" }, { status: 400 });
  }

  // จ่ายเงินสำเร็จ (รวมกรณี PromptPay ที่ยืนยันแบบ async)
  // ครอบ try/catch: ถ้า fulfillment ล้ม (เช่น ส่งอีเมล/สร้างโทเค็นไม่สำเร็จ) อย่าให้ throw
  // หลุดออกไปดิบ ๆ — log ให้ชัดแล้วคืน 500 เพื่อให้ Stripe retry (idempotency กันส่งซ้ำ)
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await handlePaid(session);
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await handlePaid(event.data.object as Stripe.Checkout.Session);
    }
  } catch (err) {
    console.error(`จัดการ event ${event.type} (${event.id}) ไม่สำเร็จ:`, err);
    return NextResponse.json({ error: "ประมวลผล event ไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaid(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};
  const orderId = meta.orderId;
  if (!orderId) {
    console.error("webhook: ไม่พบ orderId ใน metadata");
    return;
  }

  // กันส่งซ้ำ: ถ้า order ถูกส่งของไปแล้วให้ข้าม (idempotency)
  const order = await getOrder(orderId);
  if (order && order.status === "delivered") return;

  await updateOrder(orderId, { status: "paid" });

  await fulfillOrder({
    id: orderId,
    firstName: meta.firstName ?? order?.first_name ?? "",
    lastName: meta.lastName ?? order?.last_name ?? "",
    email: meta.email ?? session.customer_email ?? order?.email ?? "",
    amount: order?.amount ?? (session.amount_total ? session.amount_total / 100 : config.product.price),
  });

  console.log(`✅ ส่งของสำเร็จสำหรับ order ${orderId}`);
}
