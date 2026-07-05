import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { PDFDocument, rgb, degrees, StandardFonts, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getSupabase } from "./supabase";
import { config } from "./config";

const ASSETS = join(process.cwd(), "assets");
const THAI_FONT = join(ASSETS, "fonts", "Sarabun-Regular.ttf");

/** ลูกค้าจะได้รับ 2 ไฟล์: โจทย์ และ เฉลย */
export type ProductFile = "questions" | "answers";

export const PRODUCTS: Record<ProductFile, { label: string; local: string; storage: string }> = {
  questions: {
    label: "โจทย์",
    local: join(ASSETS, "master-questions.pdf"),
    storage: "master/questions.pdf",
  },
  answers: {
    label: "เฉลย",
    local: join(ASSETS, "master-answers.pdf"),
    storage: "master/answers.pdf",
  },
};

// cache ไฟล์ต้นฉบับไว้ระดับ module — ลดการโหลดซ้ำ (ดาวน์โหลด 2 ไฟล์/หลายครั้งบน instance เดียวกัน)
const masterCache = new Map<ProductFile, Uint8Array>();

// cache ไบต์ฟอนต์ไทยไว้ครั้งเดียว — เดิมอ่านไฟล์ TTF จากดิสก์ทุกครั้งที่ดาวน์โหลด
// (undefined = ยังไม่โหลด, null = ไม่มีไฟล์ฟอนต์ ใช้ fallback)
let thaiFontBytes: Buffer | null | undefined;

function loadThaiFontBytes(): Buffer | null {
  if (thaiFontBytes === undefined) {
    thaiFontBytes = existsSync(THAI_FONT) ? readFileSync(THAI_FONT) : null;
  }
  return thaiFontBytes;
}

/**
 * ดึงไฟล์ PDF ต้นฉบับของไฟล์ที่ระบุ (questions หรือ answers):
 * - ถ้าตั้งค่า Supabase แล้ว → โหลดจาก Storage (เก็บเป็นไฟล์ private)
 * - ไม่งั้น → อ่านจากไฟล์ local ใน assets/ (สำหรับทดสอบ)
 */
export async function getMasterPdfBytes(which: ProductFile): Promise<Uint8Array> {
  const cached = masterCache.get(which);
  if (cached) return cached;

  const product = PRODUCTS[which];
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucket)
      .download(product.storage);
    if (error || !data) {
      throw new Error(
        `โหลดไฟล์ต้นฉบับจาก Supabase ไม่สำเร็จ (${config.supabase.bucket}/${product.storage}): ${error?.message}`
      );
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    masterCache.set(which, bytes);
    return bytes;
  }

  if (!existsSync(product.local)) {
    throw new Error(
      `ไม่พบไฟล์ต้นฉบับ (${product.label}) — กรุณาวางไฟล์ไว้ที่ ${product.local} (หรืออัปโหลดขึ้น Supabase Storage)`
    );
  }
  const bytes = new Uint8Array(await readFile(product.local));
  masterCache.set(which, bytes);
  return bytes;
}

/**
 * ใส่ลายน้ำชื่อ-นามสกุล-อีเมล ลงทุกหน้าของ PDF
 * - ลายน้ำทแยงมุมจางๆ กลางหน้า (ระบุตัวตนผู้ซื้อ)
 * - แถบข้อมูลเล็กๆ ที่ขอบล่างทุกหน้า
 */
export async function watermarkPdf(
  masterBytes: Uint8Array,
  buyer: { firstName: string; lastName: string; email: string }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(masterBytes);
  pdfDoc.registerFontkit(fontkit);

  let font: PDFFont;
  const fontBytes = loadThaiFontBytes();
  if (fontBytes) {
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  } else {
    // fallback: Helvetica รองรับเฉพาะอักษรละติน (ชื่อภาษาไทยอาจไม่แสดง)
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const fullName = `${buyer.firstName} ${buyer.lastName}`.trim();
  const diagonalText = `${fullName} • ${buyer.email}`;
  const footerText = `เอกสารลิขสิทธิ์เฉพาะ ${fullName} (${buyer.email}) • ห้ามเผยแพร่ต่อ`;

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();

    // ลายน้ำทแยงมุมกลางหน้า
    const diagSize = Math.max(18, Math.min(34, width / 18));
    page.drawText(diagonalText, {
      x: width * 0.08,
      y: height * 0.45,
      size: diagSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.28,
      rotate: degrees(35),
    });

    // แถบข้อมูลที่ขอบล่าง
    page.drawText(footerText, {
      x: 24,
      y: 16,
      size: 9,
      font,
      color: rgb(0.35, 0.35, 0.35),
      opacity: 0.6,
    });
  }

  return pdfDoc.save();
}
