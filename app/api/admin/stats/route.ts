import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminReady, verifyAdminSession } from "@/lib/admin-auth";
import { summarizeSales, type OrderRow } from "@/lib/admin-stats";
import { EXAMS } from "@/lib/exams";
import { LEDGER_START, summarizeFinance } from "@/lib/finance";
import { fetchGaSummary } from "@/lib/ga";
import { listLedger, EXPENSE_CATEGORIES, INCOME_CATEGORIES, type LedgerEntry } from "@/lib/ledger";
import { listOrders } from "@/lib/orders";
import { fetchStripeFees } from "@/lib/stripe-fees";
import { getSupabase } from "@/lib/supabase";
import { config, ready } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** จำนวนคนที่ทำข้อสอบออนไลน์จริง (อ่านจากไฟล์ผลรวมของแต่ละสนาม) */
async function examStats() {
  const supabase = getSupabase();
  if (!supabase) return [];
  const out: { id: string; title: string; attempts: number; avgScore: number; maxScore: number }[] = [];
  for (const exam of Object.values(EXAMS)) {
    try {
      const { data } = await supabase.storage
        .from(config.supabase.bucket)
        .download(`exam/${exam.id}/aggregate.json`);
      if (!data) continue;
      const agg = JSON.parse(await data.text()) as { scores?: number[] };
      const scores = agg.scores ?? [];
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
      /* ยังไม่มีคนสอบสนามนี้ = ไม่มีไฟล์ ข้ามไป */
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
    const orders = (await listOrders()) as OrderRow[];
    // ดึงของนอกฐานข้อมูลพร้อมกัน — ตัวไหนล่ม/ยังไม่ตั้งค่า ก็แค่เป็น null ไม่ล้มทั้งหน้า
    const [ga, exams, stripeFees, ledger] = await Promise.all([
      fetchGaSummary(30).catch(() => null),
      examStats().catch(() => []),
      fetchStripeFees(LEDGER_START).catch(() => null),
      // ยังไม่ได้สร้างตาราง ledger = ถือว่ายังไม่มีรายการ (หน้าเว็บจะบอกให้รัน SQL)
      listLedger().then(
        (rows) => ({ rows, ready: true }),
        () => ({ rows: [] as LedgerEntry[], ready: false })
      ),
    ]);

    return NextResponse.json({
      sales: summarizeSales(orders),
      finance: summarizeFinance({
        orders,
        entries: ledger.rows,
        stripeFees: stripeFees ? stripeFees.fees : null,
      }),
      exams,
      ga,
      meta: {
        gaConfigured: ready.ga,
        // คอลัมน์ product_id มีจริงหรือยัง (ถ้ายัง หน้าเว็บจะเตือนให้รันคำสั่ง SQL)
        productColumnReady: orders.length === 0 || orders.some((o) => "product_id" in o),
        ledgerReady: ledger.ready,
        orderCount: orders.length,
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
