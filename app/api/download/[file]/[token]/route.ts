import { NextRequest, NextResponse } from "next/server";
import { verifyDownloadToken } from "@/lib/download-token";
import { FILE_INFO, isFileId } from "@/lib/catalog";
import { getMasterPdfBytes, watermarkPdf } from "@/lib/watermark";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string; token: string }> }
) {
  const { file, token } = await params;

  if (!isFileId(file)) {
    return NextResponse.json({ error: "ไฟล์ไม่ถูกต้อง" }, { status: 404 });
  }

  const payload = verifyDownloadToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "ลิงก์ดาวน์โหลดไม่ถูกต้องหรือหมดอายุแล้ว" },
      { status: 403 }
    );
  }

  // โทเค็นแต่ละใบดาวน์โหลดได้เฉพาะไฟล์ของสินค้าที่ซื้อเท่านั้น
  // (โทเค็นรุ่นเก่าไม่มีรายการไฟล์ — ออกก่อนระบบหลายสินค้า จึงเป็นชุด Mock เดิมเสมอ)
  const allowedFiles = payload.files ?? ["questions", "answers"];
  if (!allowedFiles.includes(file)) {
    return NextResponse.json(
      { error: "ลิงก์นี้ไม่มีสิทธิ์ดาวน์โหลดไฟล์ดังกล่าว" },
      { status: 403 }
    );
  }

  let pdfBytes: Uint8Array;
  try {
    const master = await getMasterPdfBytes(file);
    pdfBytes = await watermarkPdf(master, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
    });
  } catch (err) {
    console.error("สร้างไฟล์ลายน้ำไม่สำเร็จ:", err);
    return NextResponse.json(
      { error: "ไม่สามารถเตรียมไฟล์ได้ในขณะนี้ กรุณาติดต่อผู้ขาย" },
      { status: 500 }
    );
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${FILE_INFO[file].downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}
