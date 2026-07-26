import { getStripe } from "./stripe";

/**
 * ดึง "ค่าธรรมเนียมที่ Stripe หักไปจริง" มาลงเป็นรายจ่ายอัตโนมัติในสมุดบัญชี
 *
 * อ่านจาก Balance Transactions (รายการเคลื่อนไหวยอดเงินจริงในบัญชี Stripe)
 * ซึ่งเป็นตัวเลขที่หักจริง ไม่ใช่การประมาณจาก % — ครอบทั้งค่าธรรมเนียมรับเงิน
 * ค่าธรรมเนียมคืนเงิน และค่าธรรมเนียมโอนเข้าบัญชีธนาคาร
 */

export interface StripeFeeSummary {
  /** ค่าธรรมเนียมรวมทุกชนิด (บาท) — รวมค่าธรรมเนียมรับเงินและโอนเข้าธนาคาร */
  fees: number;
  /** ยอดที่ลูกค้าจ่ายเข้ามาจริง ก่อนหักค่าธรรมเนียม (บาท) */
  grossFromSales: number;
  /** ยอดสุทธิจากการขายหลังหักค่าธรรมเนียม (บาท) */
  netFromSales: number;
  /** จำนวนรายการขายที่นับได้ */
  saleCount: number;
  /** จำนวนรายการทั้งหมดที่ไล่ดู */
  count: number;
}

// กันกรณีบัญชีมีรายการเยอะผิดปกติ (ร้านนี้หลักร้อย) ไม่ให้ไล่ไม่รู้จบ
const MAX_TRANSACTIONS = 2000;

/**
 * ชนิดรายการที่ถือว่าเป็น "การขาย"
 * (payout = โอนเงินออกเข้าบัญชีธนาคาร ไม่ใช่รายรับ ถ้านับรวมยอดสุทธิจะติดลบ)
 */
const SALE_TYPES = new Set(["charge", "payment"]);

export async function fetchStripeFees(sinceIsoDate: string): Promise<StripeFeeSummary | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  // ตีความวันที่เป็นเวลาไทย (เที่ยงคืนของวันนั้น = 17:00 UTC ของวันก่อนหน้า)
  const gte = Math.floor(new Date(`${sinceIsoDate}T00:00:00+07:00`).getTime() / 1000);

  try {
    let fees = 0;
    let grossFromSales = 0;
    let netFromSales = 0;
    let saleCount = 0;
    let count = 0;
    for await (const tx of stripe.balanceTransactions.list({ created: { gte }, limit: 100 })) {
      fees += tx.fee;
      if (SALE_TYPES.has(tx.type)) {
        grossFromSales += tx.amount;
        netFromSales += tx.net;
        saleCount += 1;
      }
      count += 1;
      if (count >= MAX_TRANSACTIONS) break;
    }
    // Stripe คืนค่าเป็นสตางค์
    return {
      fees: fees / 100,
      grossFromSales: grossFromSales / 100,
      netFromSales: netFromSales / 100,
      saleCount,
      count,
    };
  } catch (err) {
    // ดึงไม่ได้ = ไม่นับเป็นรายจ่าย (หน้าเว็บจะบอกว่ายังไม่รวมค่าธรรมเนียม) ห้ามล้มทั้งหน้า
    console.error("ดึงค่าธรรมเนียม Stripe ไม่สำเร็จ:", err);
    return null;
  }
}
