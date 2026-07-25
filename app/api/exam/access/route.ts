import { NextRequest, NextResponse } from "next/server";
import { createExamToken, verifyExamToken } from "@/lib/exam-token";
import { findEntitlement, getAttemptState, examDeadline, isUnlimitedEmail } from "@/lib/exam-store";

export const runtime = "nodejs";

/** เทียบชื่อแบบหลวมพอดี ๆ: ตัดช่องว่างหัวท้าย/ซ้ำ + ไม่สนตัวเล็กใหญ่ (ชื่ออังกฤษ) */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b) && norm(a).length > 0;
}

/**
 * เช็คสิทธิ์เข้าห้องสอบ — รับ { email, firstName, lastName } (พิมพ์เอง)
 * หรือ { token } (จากลิงก์/localStorage)
 *
 * กติกาตามสเปกเจ้าของร้าน: กดปุ่มทำข้อสอบแล้วต้องกรอก "ชื่อ + นามสกุล + อีเมล" ก่อน
 * ตรงกับข้อมูลตอนซื้อทั้งหมดถึงเข้าสอบได้ — ไม่ตรงอย่างใดอย่างหนึ่ง = เข้าไม่ได้
 * (โทเค็นที่เคยผ่านการเช็คแล้วฝังตัวตนไว้ในลายเซ็น จึงไม่ต้องกรอกซ้ำ)
 *
 * ตอบ state อย่างใดอย่างหนึ่ง:
 *   none        ไม่พบสิทธิ์ (ยังไม่ซื้อ / ชื่อ-นามสกุล-อีเมลไม่ตรงกับที่ซื้อ)
 *   eligible    มีสิทธิ์ ยังไม่เริ่มทำ
 *   in_progress เริ่มทำแล้ว ยังไม่หมดเวลา (ทำต่อได้)
 *   submitted   ส่งข้อสอบแล้ว (ดูผลได้ ทำซ้ำไม่ได้ — 1 อีเมลทำได้ 1 รอบ)
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; firstName?: string; lastName?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  let email = "";
  let name: { firstName: string; lastName: string } | null = null;
  let orderId = "";
  // ชื่อ-นามสกุลที่ผู้ใช้พิมพ์เอง — ต้องเทียบกับข้อมูลตอนซื้อ (null = เข้าด้วยโทเค็น ไม่ต้องเทียบ)
  let typed: { firstName: string; lastName: string } | null = null;

  if (typeof body.token === "string" && body.token) {
    const payload = verifyExamToken(body.token);
    if (!payload) {
      return NextResponse.json(
        { error: "ลิงก์เข้าห้องสอบหมดอายุแล้ว — กรอกชื่อ นามสกุล และอีเมลที่ใช้ซื้อเพื่อเข้าใหม่ได้เลย" },
        { status: 403 }
      );
    }
    email = payload.email;
    name = { firstName: payload.firstName, lastName: payload.lastName };
    orderId = payload.orderId;
  } else if (typeof body.email === "string" && body.email.trim()) {
    email = body.email.trim().toLowerCase();
    typed = {
      firstName: typeof body.firstName === "string" ? body.firstName : "",
      lastName: typeof body.lastName === "string" ? body.lastName : "",
    };
    if (!typed.firstName.trim() || !typed.lastName.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกทั้งชื่อและนามสกุล (ตามที่กรอกตอนสั่งซื้อ)" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "กรุณากรอกชื่อ นามสกุล และอีเมล" }, { status: 400 });
  }

  const buyer = findEntitlement(email);
  const { state, attempt } = getAttemptState(email);
  const unlimited = isUnlimitedEmail(email); // อีเมลเจ้าของร้าน — เข้าได้เสมอ ทำซ้ำได้

  // ไม่มีสิทธิ์และไม่เคยมีการสอบค้างอยู่ → none (ไม่บอกรายละเอียดมากกว่านี้)
  if (!buyer && state === "none" && !unlimited) {
    return NextResponse.json({ state: "none" });
  }

  // กรอกเอง: ชื่อ-นามสกุลต้องตรงกับข้อมูลตอนซื้อด้วย ไม่ใช่แค่อีเมล
  // (อีเมลเจ้าของร้านไม่ต้องเช็ค — ไว้ทดสอบระบบ)
  if (typed && !unlimited) {
    const expectedFirst = attempt?.firstName ?? buyer?.firstName ?? "";
    const expectedLast = attempt?.lastName ?? buyer?.lastName ?? "";
    if (!sameName(typed.firstName, expectedFirst) || !sameName(typed.lastName, expectedLast)) {
      return NextResponse.json({ state: "none" });
    }
  }

  const firstName =
    attempt?.firstName ?? buyer?.firstName ?? name?.firstName ?? typed?.firstName.trim() ?? "";
  const lastName =
    attempt?.lastName ?? buyer?.lastName ?? name?.lastName ?? typed?.lastName.trim() ?? "";
  const token = createExamToken({
    email,
    firstName,
    lastName,
    orderId: attempt?.orderId ?? buyer?.orderId ?? orderId,
  });

  return NextResponse.json({
    state: state === "none" ? "eligible" : state,
    token,
    email,
    firstName,
    // ส่งแล้วแต่เป็นอีเมลยกเว้น → หน้าเว็บเปิดให้เริ่มรอบใหม่ได้ (ผลรอบเก่าจะถูกแทนที่)
    ...(state === "submitted" && unlimited ? { retake: true } : {}),
    ...(state === "in_progress" && attempt
      ? { deadline: examDeadline(attempt), serverNow: Date.now() }
      : {}),
  });
}
