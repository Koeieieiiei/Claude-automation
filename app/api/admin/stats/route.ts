import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminReady, verifyAdminSession } from "@/lib/admin-auth";
import { ADMIN_STATS_START, sinceAdminReset } from "@/lib/admin-reset";
import { bkkDayKey, summarizeSales, type OrderRow } from "@/lib/admin-stats";
import { EXAMS } from "@/lib/exams";
import { getSubmittedScores } from "@/lib/exam-store";
import { LEDGER_START, summarizeFinance } from "@/lib/finance";
import { fetchGaSummary } from "@/lib/ga";
import { listLedger, EXPENSE_CATEGORIES, INCOME_CATEGORIES, type LedgerEntry } from "@/lib/ledger";
import { listOrders } from "@/lib/orders";
import { fetchStripeFees } from "@/lib/stripe-fees";
import { ready } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * จำนวนคนที่ทำข้อสอบออนไลน์จริง — แหล่งเดียวกับหน้าผลสอบ (lib/exam-store)
 * เดิมอ่านไฟล์ aggregate.json ตรง ๆ ซึ่งเลิกอัปเดตตั้งแต่ย้ายผลสอบไปเก็บในฐานข้อมูล ตัวเลขจึงค้าง
 */
async function examStats() {
  const out: { id: string; title: string; attempts: number; avgScore: number; maxScore: number }[] = [];
  for (const exam of Object.values(EXAMS)) {
    try {
      const scores = await getSubmittedScores(exam, ADMIN_STATS_START);
      out.push({
        id: exam.id,
        title: exam.title,
        attempts: scores.length,
        avgScore: scores.length
          ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
          : 0,
        maxScore: scores.length ? Math.max(...scores) : 0,
      });
    } catch {
      /* อ่านผลสอบของสนามนี้ไม่ได้ = ข้ามไป ไม่ให้ล้มทั้งหน้าหลังร้าน */
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" }, { status: 503 });
  }
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  try {
    const allOrders = (await listOrders()) as OrderRow[];
    // ทุกตัวเลขบนหน้านี้นับตั้งแต่จุดเริ่มนับ (lib/admin-reset.ts) — ของเก่ากว่านั้นยังอยู่ในฐานข้อมูล แค่ไม่ถูกนับ
    const orders = allOrders.filter((o) => sinceAdminReset(o.created_at));
    const resetDay = bkkDayKey(ADMIN_STATS_START);
    const financeStart = resetDay > LEDGER_START ? resetDay : LEDGER_START;
    const feesSince = resetDay > LEDGER_START ? new Date(ADMIN_STATS_START).toISOString() : LEDGER_START;

    // ดึงของนอกฐานข้อมูลพร้อมกัน — ตัวไหนล่ม/ยังไม่ตั้งค่า ก็แค่เป็น null ไม่ล้มทั้งหน้า
    const [ga, exams, stripeFees, ledger] = await Promise.all([
      fetchGaSummary(30, ADMIN_STATS_START).catch(() => null),
      examStats().catch(() => []),
      fetchStripeFees(feesSince).catch(() => null),
      // ยังไม่ได้สร้างตาราง ledger = ถือว่ายังไม่มีรายการ (หน้าเว็บจะบอกให้รัน SQL)
      listLedger().then(
        (rows) => ({ rows: rows.filter((e) => sinceAdminReset(e.created_at)), ready: true }),
        () => ({ rows: [] as LedgerEntry[], ready: false })
      ),
    ]);

    return NextResponse.json({
      sales: summarizeSales(orders),
      finance: summarizeFinance({
        orders,
        entries: ledger.rows,
        stripeFees: stripeFees ? stripeFees.fees : null,
        startDate: financeStart,
      }),
      exams,
      ga,
      meta: {
        gaConfigured: ready.ga,
        // คอลัมน์ product_id มีจริงหรือยัง (ถ้ายัง หน้าเว็บจะเตือนให้รันคำสั่ง SQL)
        productColumnReady: allOrders.length === 0 || allOrders.some((o) => "product_id" in o),
        ledgerReady: ledger.ready,
        orderCount: orders.length,
        /** จุดเริ่มนับ (ISO) — null = ไม่ได้รีเซ็ต นับทุกอย่างตั้งแต่เปิดร้าน */
        since: ADMIN_STATS_START ? new Date(ADMIN_STATS_START).toISOString() : null,
        // ตัวเลขฝั่ง Stripe ไว้กระทบยอดกับที่บันทึกในเว็บ (ควรใกล้เคียงกัน)
        stripe: stripeFees
          ? {
              gross: stripeFees.grossFromSales,
              net: stripeFees.netFromSales,
              saleCount: stripeFees.saleCount,
            }
          : null,
        categories: { expense: EXPENSE_CATEGORIES, income: INCOME_CATEGORIES },
      },
    });
  } catch (err) {
    console.error("สรุปยอดขายไม่สำเร็จ:", err);
    return NextResponse.json({ error: "อ่านข้อมูลยอดขายไม่สำเร็จ" }, { status: 500 });
  }
}
