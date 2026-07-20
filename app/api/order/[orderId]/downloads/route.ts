import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getProduct, PRODUCTS } from "@/lib/catalog";
import { getOrder } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { buildDownloadLinks } from "@/lib/downloads";

// การสร้างลิงก์เกี่ยวข้องกับ crypto (เซ็นโทเค็น) + เรียก Stripe — ต้องรันบน Node
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ให้ลิงก์ดาวน์โหลดแก่ "หน้า success" หลังลูกค้าจ่ายเงินเสร็จ (ดาวน์โหลดในหน้าเว็บได้เลย
 * ไม่ต้องรออีเมล)
 *
 * ความปลอดภัย: จะคืนลิงก์ก็ต่อเมื่อยืนยันกับ Stripe แล้วว่า session ของ order นี้
 * "จ่ายเงินจริง" (payment_status === "paid") เท่านั้น — คนที่สุ่ม orderId เข้ามา
 * โดยไม่ได้จ่ายจะได้แค่สถานะ pending ไม่ได้ไฟล์ และ orderId เป็น UUID สุ่มเดายาก
 *
 * productId อ่านจาก metadata ฝั่ง Stripe (เชื่อถือได้) ไม่ใช่จาก client — กันการแก้ URL
 * เพื่อขอไฟล์ที่ไม่ได้ซื้อ ส่วนพารามิเตอร์ ?product= จะถูกใช้เฉพาะโหมด dev (ไม่มี Stripe)
 * ที่ข้ามการจ่ายเงินอยู่แล้วเท่านั้น
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const stripe = getStripe();
  let paid = false;
  let productId = "mock1";

  if (stripe) {
    // production/มี Stripe: ถามสถานะจ่ายเงินจาก Stripe โดยตรง (เชื่อถือได้ที่สุด
    // และไม่ต้องรอ webhook ของเราทำงานก่อน — สำคัญมากกับ PromptPay ที่ยืนยันช้า)
    if (!order.stripe_session_id) {
      return pending(); // เพิ่งสร้าง order ยังไม่ทันได้ session id
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      paid = session.payment_status === "paid";
      productId = session.metadata?.productId ?? "mock1";
    } catch (err) {
      console.error(`ตรวจสถานะ session ของ order ${orderId} ไม่สำเร็จ:`, err);
      return pending();
    }
  } else {
    // โหมด dev (ยังไม่ได้ตั้งค่า Stripe): checkout ข้ามการจ่ายเงินและตั้งสถานะให้แล้ว
    paid = order.status === "paid" || order.status === "delivered";
    const q = req.nextUrl.searchParams.get("product");
    if (q && getProduct(q)) productId = q;
  }

  if (!paid) return pending();

  const product = getProduct(productId) ?? PRODUCTS.mock1;
  const links = buildDownloadLinks({
    id: order.id,
    firstName: order.first_name,
    lastName: order.last_name,
    email: order.email,
    product,
  });

  return NextResponse.json(
    {
      status: "ready",
      productName: product.name,
      expiryHours: config.download.expiryHours,
      email: order.email,
      links: links.map((l) => ({ label: l.label, downloadName: l.downloadName, url: l.url })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function pending() {
  return NextResponse.json(
    { status: "pending" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
