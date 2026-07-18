import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { config, ready } from "@/lib/config";
import { getProduct } from "@/lib/catalog";
import { createOrder, updateOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { fulfillOrder } from "@/lib/fulfillment";

const schema = z.object({
  productId: z.string().trim().min(1).max(50),
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
  const { productId, firstName, lastName, email } = parsed.data;

  // ราคาและชื่อสินค้าอ่านจากแคตตาล็อกฝั่ง server เสมอ — client ส่งมาแค่ id
  // (กันการแก้ราคาจากหน้าเว็บ)
  const product = getProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "ไม่พบสินค้าที่เลือก กรุณารีเฟรชหน้าเว็บแล้วลองใหม่" }, { status: 400 });
  }

  try {
    // 1) สร้าง order (สถานะ pending)
    const order = await createOrder({ firstName, lastName, email, amount: product.price });

    const stripe = getStripe();

    // โหมดทดสอบ: ยังไม่ได้ตั้งค่า Stripe → ข้ามการจ่ายเงินจริง แล้วส่งของเลย
    // ⚠️ อนุญาตเฉพาะตอน dev เท่านั้น — ถ้าเผลอ deploy ขึ้น production โดยลืมตั้ง
    // STRIPE_SECRET_KEY ต้อง fail closed ไม่งั้นใครก็กดรับไฟล์ฟรีได้โดยไม่ต้องจ่ายเงิน
    if (!stripe) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "STRIPE_SECRET_KEY ยังไม่ถูกตั้งค่าใน production — ปฏิเสธคำสั่งซื้อเพื่อกันการแจกไฟล์ฟรี"
        );
        return NextResponse.json(
          { error: "ระบบชำระเงินยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ขาย" },
          { status: 503 }
        );
      }
      await updateOrder(order.id, { status: "paid" });
      await fulfillOrder({
        id: order.id,
        firstName,
        lastName,
        email,
        amount: order.amount,
        productId: product.id,
      });
      await updateOrder(order.id, { status: "delivered" });
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
            unit_amount: Math.round(product.price * 100), // สตางค์
            product_data: { name: product.name },
          },
        },
      ],
      // เก็บข้อมูลผู้ซื้อ + สินค้า ไว้ใน metadata เพื่อให้ webhook นำไปส่งของ/ใส่ลายน้ำ
      metadata: { orderId: order.id, productId: product.id, firstName, lastName, email },
      success_url: `${config.baseUrl}/success?order=${order.id}`,
      cancel_url: `${config.baseUrl}/?canceled=1`,
    });

    await updateOrder(order.id, { stripe_session_id: session.id });

    // Stripe ระบุชนิด session.url เป็น string | null — ถ้า null อย่าส่งต่อให้หน้าเว็บ
    // (ไม่งั้น browser จะพาลูกค้าไปหน้า /null ทั้งที่สร้าง order ค้างไว้แล้ว)
    if (!session.url) {
      console.error(`Stripe ไม่คืน URL หน้าชำระเงิน (session ${session.id}, order ${order.id})`);
      return NextResponse.json(
        { error: "สร้างหน้าชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
        { status: 500 }
      );
    }

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
