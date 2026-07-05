import Stripe from "stripe";
import { config, ready } from "./config";

/** Stripe client (ฝั่ง server เท่านั้น) — คืน null ถ้ายังไม่ได้ตั้งค่า key */
let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!ready.stripe) return null;
  if (!cached) {
    cached = new Stripe(config.stripe.secretKey);
  }
  return cached;
}
