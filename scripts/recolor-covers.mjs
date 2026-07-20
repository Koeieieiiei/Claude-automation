// ให้พื้นหลังปกสรุป (sum1/2/3) เป็นโทนสีจาง ๆ ตามธีม เพื่อให้แยกออกจากพื้นขาวของเว็บ
// วิธี: แทนเฉพาะ "พิกเซลพื้นหลัง" (สว่าง + ความอิ่มสีต่ำ) ด้วยสีธีม โดยเบลนด์แบบนุ่ม
//       ตัวหนังสือ/ไอคอน/สีเน้น (เข้มหรืออิ่มสี) ไม่ถูกแตะ และขอบไม่เกิดรัศมีขาว
// รัน: node scripts/recolor-covers.mjs <destDir>   (ไม่ใส่ = เขียนทับ public/covers)
import sharp from "sharp";
import { join } from "path";

const SRC = "public/covers";
const DEST = process.argv[2] || "public/covers";

const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// สีพื้นหลังเป้าหมายของแต่ละเล่ม (โทนอ่อนแต่เห็นชัดบนพื้นขาว)
const TINTS = {
  sum1: [236, 224, 186], // ทรายอุ่น (ธีมส้ม/กลศาสตร์)
  sum2: [206, 231, 214], // เขียวมิ้นต์ (ธีมคลื่น/สสาร)
  sum3: [212, 222, 244], // ฟ้าอ่อน (ธีมไฟฟ้า/นิวเคลียร์)
};

async function recolor(name) {
  const tint = TINTS[name];
  const { data, info } = await sharp(join(SRC, name + ".png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const out = Buffer.from(data);
  for (let i = 0; i < data.length; i += C) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const w = ss(205, 244, lum) * (1 - ss(14, 48, chroma)); // น้ำหนักความเป็น "พื้นหลัง"
    out[i]     = Math.round(r * (1 - w) + tint[0] * w);
    out[i + 1] = Math.round(g * (1 - w) + tint[1] * w);
    out[i + 2] = Math.round(b * (1 - w) + tint[2] * w);
  }
  await sharp(out, { raw: { width: W, height: H, channels: C } }).png({ compressionLevel: 9 }).toFile(join(DEST, name + ".png"));
  console.log(name, "-> bg", tint.join(","), `(${W}x${H})`);
}

for (const n of ["sum1", "sum2", "sum3"]) await recolor(n);
console.log("เสร็จ — เขียนไปที่", DEST);
