import { NextRequest, NextResponse } from "next/server";
import { verifyDownloadToken } from "@/lib/download-token";
import { getMasterPdfBytes, watermarkPdf, PRODUCTS, ProductFile } from "@/lib/watermark";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string; token: string }> }
) {
  const { file, token } = await params;

  if (file !== "questions" && file !== "answers") {
    return NextResponse.json({ error: "ไฟล์ไม่ถูกต้อง" }, { status: 404 });
  }
  const which = file as ProductFile;

  const payload = verifyDownloadToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "ลิงก์ดาวน์โหลดไม่ถูกต้องหรือหมดอายุแล้ว" },
      { status: 403 }
    );
  }

  let pdfBytes: Uint8Array;
  try {
    const master = await getMasterPdfBytes(which);
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

  const filename = which === "questions" ? "mock-tpat3-questions.pdf" : "mock-tpat3-answers.pdf";

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
