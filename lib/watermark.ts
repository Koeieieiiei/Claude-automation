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
  sum4content: { local: join(ASSETS, "master-sum4-content.pdf"), storage: "master/sum4-content.pdf" },
  sum4formula: { local: join(ASSETS, "master-sum4-formula.pdf"), storage: "master/sum4-formula.pdf" },
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

/** มุมเอียงของลายน้ำทแยงมุม (องศา) */
const DIAG_ANGLE = 35;
const DIAG_RAD = (DIAG_ANGLE * Math.PI) / 180;
// เวกเตอร์ตามแนวบรรทัด และแนวตั้งฉาก (ชี้ "ลง" ใต้บรรทัด)
// ใช้วางบรรทัดที่ 2 ให้ขนานกับบรรทัดแรก แทนที่จะเลื่อนลงตรงๆ ซึ่งจะเบี้ยวเพราะข้อความเอียง
const ALONG = { x: Math.cos(DIAG_RAD), y: Math.sin(DIAG_RAD) };
const BELOW = { x: Math.sin(DIAG_RAD), y: -Math.cos(DIAG_RAD) };

/** ย่อขนาดตัวอักษรลงจนข้อความยาวไม่เกิน maxWidth (อีเมลยาวๆ จะได้ไม่ล้นขอบหน้า) */
function fitSize(font: PDFFont, text: string, preferred: number, min: number, maxWidth: number) {
  let size = preferred;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

/** ไฟล์ที่ "ไม่ใส่ลายน้ำทั้งไฟล์" — กระดาษคำตอบมีไว้พิมพ์ฝนคำตอบจริง ลายน้ำจะกวนวงกลม OMR */
const NO_WATERMARK: ReadonlySet<FileId> = new Set(["answersheet"]);

/** ไฟล์ที่ "ข้ามลายน้ำเฉพาะหน้าแรก" — หน้าแรกเป็นหน้าปก
 *  · questions  = หน้าปกที่แปะรูปไว้ (scripts/prepend-cover.mjs)
 *  · sum4content = หน้าปก "สรุป TPAT3" ในตัว Mind Map (เจ้าของขอให้ปกสะอาดไม่มีลายน้ำ) */
const SKIP_COVER_PAGE: ReadonlySet<FileId> = new Set(["questions", "sum4content"]);

/**
 * เตรียมไฟล์ PDF พร้อมส่งให้ลูกค้า: โหลดต้นฉบับ + ใส่ลายน้ำตามกติการายไฟล์
 * (กระดาษคำตอบไม่ใส่ลายน้ำ, ไฟล์โจทย์ไม่ใส่ลายน้ำบนหน้าปก)
 */
export async function buildDeliverablePdf(
  file: FileId,
  buyer: { firstName: string; lastName: string; email: string }
): Promise<Uint8Array> {
  const master = await getMasterPdfBytes(file);
  if (NO_WATERMARK.has(file)) return master;
  return watermarkPdf(master, buyer, { skipFirstPage: SKIP_COVER_PAGE.has(file) });
}

/** บรรทัดที่ 2 ของลายน้ำทแยง — ข้อความเตือนสิทธิ์ (แทนอีเมลที่เคยโชว์กลางหน้า) */
const PERMISSION_LINE = "อนุญาตให้ใช้เฉพาะบุคคลนี้";

/**
 * ใส่ลายน้ำระบุตัวผู้ซื้อลงทุกหน้าของ PDF
 * - ลายน้ำทแยงมุมจางๆ กลางหน้า 2 บรรทัด (ชื่อ-นามสกุล / ข้อความเตือนสิทธิ์)
 *   เยื้องซ้าย-ขวาสลับกันทุกหน้า
 * - แถบข้อมูลเล็กๆ ที่ขอบล่างทุกหน้า — ยังมีอีเมลอยู่ เพราะเป็นตัวระบุตัวตนที่ไม่ซ้ำ
 *   (ชื่อซ้ำกันได้ ถ้าไฟล์หลุดต้องสืบย้อนได้ว่าเป็นของใคร)
 * - opts.skipFirstPage = เว้นหน้าแรก (ใช้กับไฟล์ที่หน้าแรกเป็นหน้าปก)
 */
export async function watermarkPdf(
  masterBytes: Uint8Array,
  buyer: { firstName: string; lastName: string; email: string },
  opts: { skipFirstPage?: boolean } = {}
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

  // เจ้าของร้านขอเอาแถบข้อความขอบล่างออก (2026-07-26) — หน้ากระดาษจะได้สะอาด
  // แต่ยังต้องสืบย้อนได้ถ้าไฟล์หลุด จึงฝังตัวตนผู้ซื้อไว้ใน metadata ของ PDF แทน
  // (มองไม่เห็นตอนอ่าน แต่เปิดดูคุณสมบัติไฟล์แล้วรู้ว่าเป็นของใคร — ชื่อซ้ำกันได้ อีเมลไม่ซ้ำ)
  pdfDoc.setSubject(`เอกสารลิขสิทธิ์เฉพาะ ${fullName} (${buyer.email}) • ห้ามเผยแพร่ต่อ`);
  pdfDoc.setKeywords([fullName, buyer.email, "ห้ามเผยแพร่ต่อ"]);

  pdfDoc.getPages().forEach((page, index) => {
    if (opts.skipFirstPage && index === 0) return; // หน้าปก — ปล่อยสะอาด

    const { width, height } = page.getSize();

    // ลายน้ำทแยงมุมกลางหน้า: ชื่อบรรทัดบน ข้อความเตือนสิทธิ์ขึ้นบรรทัดใหม่ข้างล่าง
    // ขนาดตัวอักษรตั้งไว้ให้เล็กพอไม่บังโจทย์ แต่ยังอ่านออกชัดถ้าไฟล์หลุด
    const maxSpan = width * 0.62;
    const nameSize = fitSize(font, fullName, Math.max(13, Math.min(23, width / 26)), 9, maxSpan);
    const noticeSize = fitSize(font, PERMISSION_LINE, nameSize * 0.72, 8, maxSpan);
    const lines = [
      ...(fullName ? [{ text: fullName, size: nameSize }] : []),
      { text: PERMISSION_LINE, size: noticeSize },
    ];
    const gap = nameSize * 1.5;

    // จุดกึ่งกลางของบล็อกลายน้ำ — หน้าคี่เยื้องซ้าย หน้าคู่เยื้องขวา สลับกันไปทุกหน้า
    const anchorX = width * (index % 2 === 0 ? 0.36 : 0.64);
    const anchorY = height * 0.46;

    lines.forEach((line, i) => {
      const half = font.widthOfTextAtSize(line.text, line.size) / 2;
      const drop = (i - (lines.length - 1) / 2) * gap; // ระยะห่างจากกึ่งกลางบล็อกในแนวตั้งฉาก
      page.drawText(line.text, {
        x: anchorX - ALONG.x * half + BELOW.x * drop,
        y: anchorY - ALONG.y * half + BELOW.y * drop,
        size: line.size,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.28,
        rotate: degrees(DIAG_ANGLE),
      });
    });

  });

  return pdfDoc.save();
}
