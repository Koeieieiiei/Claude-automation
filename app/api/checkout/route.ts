import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config, ready } from "@/lib/config";
import { createOrder, updateOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { fulfillOrder } from "@/lib/fulfillment";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "กรุณากรอกชื่อ นามสกุล และอีเมลให้ครบถูกต้อง" }, { status: 400 });
  }
  const { firstName, lastName, email } = parsed.data;

  try {
    // 1) สร้าง order (สถานะ pending)
    const order = await createOrder({ firstName, lastName, email, amount: config.product.price });

    const stripe = getStripe();

    // โหมดทดสอบ: ยังไม่ได้ตั้งค่า Stripe → ข้ามการจ่ายเงินจริง แล้วส่งของเลย
    if (!stripe) {
      await updateOrder(order.id, { status: "paid" });
      await fulfillOrder({ id: order.id, firstName, lastName, email, amount: order.amount });
      return NextResponse.json({
        url: `${config.baseUrl}/success?order=${order.id}&mock=1`,
      });
    }

    // 2) สร้าง Stripe Checkout Session (รับชำระด้วย PromptPay เท่านั้น)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["promptpay"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.stripe.currency,
            unit_amount: Math.round(config.product.price * 100), // สตางค์
            product_data: { name: config.product.name },
          },
        },
      ],
      // เก็บข้อมูลผู้ซื้อไว้ใน metadata เพื่อให้ webhook นำไปใส่ลายน้ำ
      metadata: { orderId: order.id, firstName, lastName, email },
      success_url: `${config.baseUrl}/success?order=${order.id}`,
      cancel_url: `${config.baseUrl}/?canceled=1`,
    });

    await updateOrder(order.id, { stripe_session_id: session.id });

    if (!ready.stripeWebhook) {
      console.warn(
        "⚠️ ยังไม่ได้ตั้งค่า STRIPE_WEBHOOK_SECRET — เมื่อจ่ายเงินสำเร็จ ระบบจะยังไม่ส่งไฟล์อัตโนมัติ จนกว่าจะตั้ง webhook"
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("สร้างรายการชำระเงินไม่สำเร็จ:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างรายการชำระเงิน กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
