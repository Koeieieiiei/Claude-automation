import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminReady, verifyAdminSession } from "@/lib/admin-auth";
import { addLedgerEntry, deleteLedgerEntry, LedgerTableMissingError } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง"),
  kind: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(60),
  note: z.string().trim().max(300).optional(),
  // จำนวนเงินต้องเป็นบวกและไม่เกินหลักล้าน (กันพิมพ์พลาดจนตัวเลขเพี้ยนทั้งบัญชี)
  amount: z.number().finite().min(0).max(10_000_000),
});

function guard(req: NextRequest): NextResponse | null {
  if (!adminReady()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD" }, { status: 503 });
  }
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "กรอกข้อมูลไม่ครบ" },
      { status: 400 }
    );
  }

  try {
    const entry = await addLedgerEntry(parsed.data);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    if (err instanceof LedgerTableMissingError) {
      return NextResponse.json(
        { error: "ยังไม่ได้สร้างตารางบัญชี — รันไฟล์ supabase/migration-admin.sql ใน Supabase ก่อน" },
        { status: 503 }
      );
    }
    console.error("บันทึกรายการบัญชีไม่สำเร็จ:", err);
    return NextResponse.json({ error: "บันทึกรายการไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ไม่ได้ระบุรายการที่จะลบ" }, { status: 400 });

  try {
    await deleteLedgerEntry(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ลบรายการบัญชีไม่สำเร็จ:", err);
    return NextResponse.json({ error: "ลบรายการไม่สำเร็จ" }, { status: 500 });
  }
}
