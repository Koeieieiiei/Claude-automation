import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { config } from "@/lib/config";
import { getProduct } from "@/lib/catalog";
import { getStripe } from "@/lib/stripe";
import { getOrder, updateOrder, claimDelivery } from "@/lib/orders";
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

  const order = await getOrder(orderId);

  // กันส่งซ้ำแบบ atomic: "จองสิทธิ์ส่งของ" (เปลี่ยนสถานะเป็น delivered ในคำสั่งเดียว)
  // ก่อนเริ่มส่งจริง — webhook ที่มาซ้ำ/พร้อมกันจะ claim ไม่สำเร็จและถูกข้ามไป
  const claim = await claimDelivery(orderId);
  if (claim === "already-delivered") return;
  if (claim === "not-found") {
    // เกิดได้เมื่อยังไม่ได้ตั้ง Supabase (order อยู่ใน memory ของอีก instance)
    // — ส่งของจาก metadata ให้ลูกค้าได้ แต่กันซ้ำไม่ได้ จึงเตือนไว้
    console.warn(
      `webhook: ไม่พบ order ${orderId} ในฐานข้อมูล — ส่งของจาก metadata (กันส่งซ้ำไม่ได้ ควรตั้งค่า Supabase)`
    );
  }

  // order เก่าที่จ่ายเงินก่อนอัปเดตระบบหลายสินค้า ไม่มี productId ใน metadata
  // — fulfillOrder จะ fallback เป็นชุด Mock เดิมให้เอง
  const productId = meta.productId ?? "mock1";

  // อีเมลปลายทาง = อีเมลที่ลูกค้ากรอก/ยืนยันบนหน้า Stripe (customer_details.email)
  // เป็นแหล่งความจริงหลัก แล้วค่อย fallback ตามลำดับสำหรับ order เก่า/เคสพิเศษ
  const buyerEmail =
    session.customer_details?.email ??
    session.customer_email ??
    meta.email ??
    order?.email ??
    "";

  if (!buyerEmail) {
    // ไม่ควรเกิด เพราะ Stripe บังคับกรอกอีเมลเสมอ — แต่ถ้าเกิด อย่าส่งอีเมลไป "" (Resend จะ error)
    console.error(`webhook: ไม่พบอีเมลผู้ซื้อสำหรับ order ${orderId} — ข้ามการส่งของ`);
    throw new Error("ไม่พบอีเมลผู้ซื้อ");
  }

  // เก็บอีเมลที่ยืนยันแล้วลง order (เผื่อ order สร้างไว้ตอนแรกยังไม่มีอีเมล) — best effort
  if (order && order.email !== buyerEmail) {
    await updateOrder(orderId, { email: buyerEmail }).catch((e) =>
      console.error(`บันทึกอีเมลลง order ${orderId} ไม่สำเร็จ:`, e)
    );
  }

  try {
    await fulfillOrder({
      id: orderId,
      firstName: meta.firstName ?? order?.first_name ?? "",
      lastName: meta.lastName ?? order?.last_name ?? "",
      email: buyerEmail,
      // ใช้ != null (ไม่ใช่ truthy) — ยอด 0 บาท (เช่น คูปองลด 100%) ต้องบันทึกเป็น 0 จริง
      amount:
        order?.amount ??
        (session.amount_total != null
          ? session.amount_total / 100
          : getProduct(productId)?.price ?? 0),
      productId,
    });
  } catch (err) {
    // ส่งของไม่สำเร็จ → คืนสถานะกลับเป็น paid เพื่อให้ Stripe retry รอบหน้า claim ได้ใหม่
    if (claim === "claimed") {
      await updateOrder(orderId, { status: "paid" }).catch((e) =>
        console.error(`คืนสถานะ paid ไม่สำเร็จ (order ${orderId}):`, e)
      );
    }
    throw err;
  }

  console.log(`✅ ส่งของสำเร็จสำหรับ order ${orderId}`);
}
