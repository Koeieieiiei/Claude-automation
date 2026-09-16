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
  // โจทย์ = ไฟล์เดิมทุกหน้า แต่เปลี่ยนหน้าปกเป็นปก "MOCK TPAT3" ชุดเดียวกับเฉลย Master Answers (2026-09-16)
  questions: { local: join(ASSETS, "master-questions.pdf"), storage: "master/questions-2026-09-16.pdf" },
  // เฉลยฉบับ Master Answers ใหม่ (2026-09-16) — อัปขึ้น path ใหม่แทนการทับ master/answers.pdf
  // (CDN ของ Supabase คืนไฟล์เก่าที่แคชไว้ได้สักพักหลังอัปทับ + เก็บฉบับเก่าไว้เป็นสำรอง)
  answers: { local: join(ASSETS, "master-answers.pdf"), storage: "master/answers-2026-09-16.pdf" },
  answersheet: { local: join(ASSETS, "master-answersheet.pdf"), storage: "master/answersheet.pdf" },
  tpat3content: { local: join(ASSETS, "master-tpat3-content.pdf"), storage: "master/tpat3-content.pdf" },
  // สรุป TPAT3 รุ่นเก่า (เลิกขายแล้ว) — ไฟล์ยังอยู่บน Storage ให้ลิงก์ในอีเมลเก่าโหลดได้
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

/** ไฟล์ที่ "ข้ามลายน้ำเฉพาะหน้าแรก" — หน้าแรกเป็นหน้าปก (เจ้าของขอให้ปกสะอาดไม่มีลายน้ำ)
 *  · questions    = ปก "MOCK TPAT3" (หน้า 1 ของ master-answers.pdf)
 *  · answers      = ปก "MOCK TPAT3" ของเฉลยฉบับ Master Answers (ฉบับก่อน 2026-09-16 ไม่มีปก)
 *  · tpat3content = ปก "เนื้อหา TPAT3"
 *  · sum4content  = ปก "สรุป TPAT3" ในตัว Mind Map รุ่นเก่า */
const SKIP_COVER_PAGE: ReadonlySet<FileId> = new Set(["questions", "answers", "tpat3content", "sum4content"]);

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

/**
 * ลายน้ำแบรนด์ — แบบเดียวกับไฟล์ตัวอย่างฟรี (scripts/make-summary-sample.mjs):
 * "Mr.tpat3" / "Tiktok: Mrtpat3" 2 บรรทัด เอียง 35° สีเทาจาง สลับเยื้องซ้าย-ขวาทีละหน้า
 * (เจ้าของสั่ง 2026-09-16: เลิกพิมพ์ชื่อ-อีเมลผู้ซื้อบนหน้ากระดาษ)
 * ตำแหน่งคิดเป็นสัดส่วนของหน้า A4 (595×842) ของต้นฉบับ เพื่อให้หน้าขนาดอื่นวางตรงกัน
 */
const BRAND_LINES = [
  { text: "Mr.tpat3", size: 34, yFrac: 403.92 / 842 },
  { text: "Tiktok: Mrtpat3", size: 28, yFrac: 347.92 / 842 },
];
const BRAND_X_LEFT = 124 / 595; // หน้าคี่ของชุด — เยื้องซ้าย
const BRAND_X_RIGHT = 339 / 595; // หน้าคู่ของชุด — เยื้องขวา
const BRAND_ANGLE = 35;
const BRAND_OPACITY = 0.25;

/**
 * ใส่ลายน้ำแบรนด์ลงทุกหน้าของ PDF
 * - ตัวตนผู้ซื้อ (ชื่อ/อีเมล) ไม่พิมพ์บนหน้ากระดาษแล้ว แต่ยังฝังใน metadata ของไฟล์ไว้สืบย้อนถ้าไฟล์หลุด
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
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const fullName = `${buyer.firstName} ${buyer.lastName}`.trim();
  pdfDoc.setSubject(`เอกสารลิขสิทธิ์เฉพาะ ${fullName} (${buyer.email}) • ห้ามเผยแพร่ต่อ`);
  pdfDoc.setKeywords([fullName, buyer.email, "ห้ามเผยแพร่ต่อ"]);

  pdfDoc.getPages().forEach((page, index) => {
    if (opts.skipFirstPage && index === 0) return; // หน้าปก — ปล่อยสะอาด

    const { width, height } = page.getSize();
    const scale = width / 595; // ต้นฉบับเป็น A4 — หน้าขนาดอื่นย่อ/ขยายตาม
    const baseX = width * (index % 2 === 1 ? BRAND_X_RIGHT : BRAND_X_LEFT); // สลับซ้าย-ขวาทีละหน้า
    BRAND_LINES.forEach((line, j) => {
      page.drawText(line.text, {
        x: baseX + j * 3 * scale, // บรรทัดล่างเยื้องขวาอีก 3pt ตามต้นฉบับ
        y: height * line.yFrac,
        size: line.size * scale,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: BRAND_OPACITY,
        rotate: degrees(BRAND_ANGLE),
      });
    });
  });

  return pdfDoc.save();
}
