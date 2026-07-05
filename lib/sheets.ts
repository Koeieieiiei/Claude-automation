import { google } from "googleapis";
import { config, ready } from "./config";

/**
 * บันทึกสถิติลง Google Sheets ผ่าน Service Account
 * - แท็บ "visits" : บันทึกการเข้าชมเว็บ
 * - แท็บ "sales"  : บันทึกการซื้อขายที่สำเร็จ
 * ถ้ายังไม่ได้ตั้งค่า จะแค่ log (โหมดทดสอบ) ไม่เขียนจริง
 */
function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: config.sheets.clientEmail,
    key: config.sheets.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * กัน formula/CSV injection: เซลล์ที่เป็นสตริงและขึ้นต้นด้วย = + - @ (หรือ tab/CR)
 * อาจถูก Google Sheets ตีความเป็นสูตร (เช่น =IMPORTXML(...) ดูดข้อมูลออก) — ข้อมูลชื่อ
 * ผู้ซื้อและ referrer/user-agent จาก /api/track มาจาก input ที่ควบคุมไม่ได้ จึงต้อง neutralize
 * ด้วยการเติม ' นำหน้า (Sheets จะถือเป็นข้อความล้วน) ตัวเลขปล่อยผ่านตามเดิม
 */
function sanitizeCell(v: string | number): string | number {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

async function appendRow(tab: string, row: (string | number)[]): Promise<void> {
  if (!ready.sheets) {
    console.log(`📊 [MOCK SHEETS] (ยังไม่ได้ตั้งค่า) จะเพิ่มแถวในแท็บ "${tab}":`, row);
    return;
  }
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheets.id,
      range: `${tab}!A:Z`,
      // RAW = ไม่ตีความค่าเป็นสูตร (กัน injection ชั้นแรก) + sanitizeCell กันชั้นสอง
      valueInputOption: "RAW",
      requestBody: { values: [row.map(sanitizeCell)] },
    });
  } catch (err) {
    // สถิติไม่ควรทำให้ flow หลักล้ม — log ไว้เฉยๆ
    console.error("เขียน Google Sheets ไม่สำเร็จ:", err);
  }
}

export function logVisit(meta: { path: string; referrer?: string; userAgent?: string }) {
  return appendRow("visits", [
    new Date().toISOString(),
    meta.path,
    meta.referrer ?? "",
    meta.userAgent ?? "",
  ]);
}

export function logSale(order: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  amount: number;
}) {
  return appendRow("sales", [
    new Date().toISOString(),
    order.id,
    `${order.firstName} ${order.lastName}`,
    order.email,
    order.amount,
    "paid",
  ]);
}
