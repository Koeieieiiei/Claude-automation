import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { PDFDocument, rgb, degrees, StandardFonts, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getSupabase } from "./supabase";
import { config } from "./config";
import { FileId, FILE_INFO } from "./catalog";

const ASSETS = join(process.cwd(), "assets");
const THAI_FONT = join(ASSETS, "fonts", "Sarabun-Regular.ttf");

/** ตำแหน่งไฟล์ต้นฉบับของแต่ละไฟล์ในแคตตาล็อก (ดู lib/catalog.ts) */
const MASTER_SOURCES: Record<FileId, { local: string; storage: string }> = {
  questions: { local: join(ASSETS, "master-questions.pdf"), storage: "master/questions.pdf" },
  answers: { local: join(ASSETS, "master-answers.pdf"), storage: "master/answers.pdf" },
  answersheet: { local: join(ASSETS, "master-answersheet.pdf"), storage: "master/answersheet.pdf" },
  sum1content: { local: join(ASSETS, "master-sum1-content.pdf"), storage: "master/sum1-content.pdf" },
  sum1formula: { local: join(ASSETS, "master-sum1-formula.pdf"), storage: "master/sum1-formula.pdf" },
  sum2content: { local: join(ASSETS, "master-sum2-content.pdf"), storage: "master/sum2-content.pdf" },
  sum2formula: { local: join(ASSETS, "master-sum2-formula.pdf"), storage: "master/sum2-formula.pdf" },
  sum3content: { local: join(ASSETS, "master-sum3-content.pdf"), storage: "master/sum3-content.pdf" },
  sum3formula: { local: join(ASSETS, "master-sum3-formula.pdf"), storage: "master/sum3-formula.pdf" },
};

// cache ไฟล์ต้นฉบับไว้ระดับ module — ลดการโหลดซ้ำ (ดาวน์โหลดหลายไฟล์/หลายครั้งบน instance เดียวกัน)
const masterCache = new Map<FileId, Uint8Array>();

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
 * ดึงไฟล์ PDF ต้นฉบับของไฟล์ที่ระบุ:
 * - ถ้าตั้งค่า Supabase แล้ว → โหลดจาก Storage (เก็บเป็นไฟล์ private)
 * - ถ้า Storage ยังไม่มีไฟล์นั้น → ลองไฟล์ local ใน assets/ ก่อนจะยอมแพ้
 *   (กันเคสเพิ่มสินค้าใหม่แล้วยังไม่ได้อัปโหลดไฟล์ขึ้น Storage)
 * - ไม่ได้ตั้ง Supabase → อ่านจากไฟล์ local อย่างเดียว (สำหรับทดสอบ)
 */
export async function getMasterPdfBytes(which: FileId): Promise<Uint8Array> {
  const cached = masterCache.get(which);
  if (cached) return cached;

  const source = MASTER_SOURCES[which];
  const label = FILE_INFO[which].label;
  const supabase = getSupabase();
  let storageError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase.storage
      .from(config.supabase.bucket)
      .download(source.storage);
    if (data && !error) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      masterCache.set(which, bytes);
      return bytes;
    }
    storageError = error?.message ?? "ไม่ทราบสาเหตุ";
    console.warn(
      `โหลด ${config.supabase.bucket}/${source.storage} จาก Supabase ไม่สำเร็จ (${storageError}) — ลองใช้ไฟล์ local แทน`
    );
  }

  if (!existsSync(source.local)) {
    throw new Error(
      `ไม่พบไฟล์ต้นฉบับ (${label}) — กรุณาอัปโหลดขึ้น Supabase Storage ที่ ${config.supabase.bucket}/${source.storage}` +
        ` หรือวางไฟล์ไว้ที่ ${source.local}` +
        (storageError ? ` (Storage ตอบ: ${storageError})` : "")
    );
  }
  const bytes = new Uint8Array(await readFile(source.local));
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
