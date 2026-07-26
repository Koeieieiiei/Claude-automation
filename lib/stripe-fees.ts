import { getStripe } from "./stripe";

/**
 * ดึง "ค่าธรรมเนียมที่ Stripe หักไปจริง" มาลงเป็นรายจ่ายอัตโนมัติในสมุดบัญชี
 *
 * อ่านจาก Balance Transactions (รายการเคลื่อนไหวยอดเงินจริงในบัญชี Stripe)
 * ซึ่งเป็นตัวเลขที่หักจริง ไม่ใช่การประมาณจาก % — ครอบทั้งค่าธรรมเนียมรับเงิน
 * ค่าธรรมเนียมคืนเงิน และค่าธรรมเนียมโอนเข้าบัญชีธนาคาร
 */

export interface StripeFeeSummary {
  /** ค่าธรรมเนียมรวม (บาท) */
  fees: number;
  /** ยอดเงินสุทธิที่เข้าบัญชี Stripe (บาท) */
  net: number;
  /** จำนวนรายการที่นับ */
  count: number;
}

// กันกรณีบัญชีมีรายการเยอะผิดปกติ (ร้านนี้หลักร้อย) ไม่ให้ไล่ไม่รู้จบ
const MAX_TRANSACTIONS = 2000;

export async function fetchStripeFees(sinceIsoDate: string): Promise<StripeFeeSummary | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  // ตีความวันที่เป็นเวลาไทย (เที่ยงคืนของวันนั้น = 17:00 UTC ของวันก่อนหน้า)
  const gte = Math.floor(new Date(`${sinceIsoDate}T00:00:00+07:00`).getTime() / 1000);

  try {
    let fees = 0;
    let net = 0;
    let count = 0;
    for await (const tx of stripe.balanceTransactions.list({ created: { gte }, limit: 100 })) {
      fees += tx.fee;
      net += tx.net;
      count += 1;
      if (count >= MAX_TRANSACTIONS) break;
    }
    // Stripe คืนค่าเป็นสตางค์
    return { fees: fees / 100, net: net / 100, count };
  } catch (err) {
    // ดึงไม่ได้ = ไม่นับเป็นรายจ่าย (หน้าเว็บจะบอกว่ายังไม่รวมค่าธรรมเนียม) ห้ามล้มทั้งหน้า
    console.error("ดึงค่าธรรมเนียม Stripe ไม่สำเร็จ:", err);
    return null;
  }
}
