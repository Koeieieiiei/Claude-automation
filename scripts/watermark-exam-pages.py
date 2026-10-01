# -*- coding: utf-8 -*-
"""
ประทับลายน้ำแบรนด์ลงรูปหน้าโจทย์ของห้องสอบออนไลน์ (เจ้าของสั่ง 2026-09-27)

    python scripts/watermark-exam-pages.py [examId] [--preview <โฟลเดอร์>] [--dry-run]

อ่านรูปต้นฉบับ (สะอาด) จาก Storage  exam/<examId>/pages-2026-09-27/page-NN.png
เขียนรูปที่มีลายน้ำไปที่           exam/<examId>/pages-wm-2026-09-27/page-NN.png   ← ห้องสอบเสิร์ฟจากโฟลเดอร์นี้
ต้นฉบับไม่ถูกแตะ — รันซ้ำได้ปลอดภัย (ทับเฉพาะโฟลเดอร์ลายน้ำ)
ชื่อโฟลเดอร์ (PAGES_DIR/PAGES_WM_DIR) ต้องตรงกับ upload-exam-assets.mjs และ storagePagePath ใน lib/exam-store.ts
ชุดก่อนหน้า (ฟอนต์เดิม) ยังอยู่ที่ pages/ และ pages-wm/

ลายน้ำ = แบบเดียวกับไฟล์ PDF ที่ลูกค้าโหลด (lib/watermark.ts): "Mr.tpat3" / "IG: mako_tpat3"
2 บรรทัด เอียง 35° สีเทาจาง สลับเยื้องซ้าย-ขวาทีละหน้า — ค่าตำแหน่งต้องตรงกับไฟล์นั้น

ต้องรันหลัง scripts/upload-exam-assets.mjs ทุกครั้งที่อัปรูปหน้าโจทย์ชุดใหม่
หลังรันต้อง deploy ใหม่ (vercel --prod) เพราะ server จำรูปไว้ในหน่วยความจำต่อ instance
--preview  เก็บสำเนารูปที่ประทับแล้วลงโฟลเดอร์ในเครื่องไว้เปิดดู
--dry-run  ประทับอย่างเดียว ไม่อัปโหลด (ใช้คู่กับ --preview)
"""
import io
import json
import math
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_FILE = os.path.join(ROOT, "assets", "fonts", "Sarabun-Regular.ttf")
PAGES_DIR = "pages-2026-09-27"
PAGES_WM_DIR = "pages-wm-2026-09-27"

args = sys.argv[1:]
DRY_RUN = "--dry-run" in args
PREVIEW_DIR = args[args.index("--preview") + 1] if "--preview" in args else None
positional = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] != "--preview")]
EXAM_ID = positional[0] if positional else "tpat3-1"
if not re.fullmatch(r"[a-z0-9-]+", EXAM_ID):
    sys.exit(f"examId ไม่ถูกต้อง: {EXAM_ID}")

# ---- ค่าลายน้ำ: ตรงกับ BRAND_* ใน lib/watermark.ts (หน่วย pt บนหน้า A4 595x842) ----
BRAND_LINES = [
    {"text": "Mr.tpat3", "size": 34, "y_frac": 403.92 / 842},
    {"text": "IG: mako_tpat3", "size": 28, "y_frac": 347.92 / 842},
]
BRAND_X_LEFT = 124 / 595
BRAND_X_RIGHT = 339 / 595
BRAND_ANGLE = 35
BRAND_GRAY = 128
BRAND_OPACITY = 0.25


def load_env():
    env = dict(os.environ)
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.rstrip("\r\n"))
            if m and m.group(1) not in os.environ:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


ENV = load_env()
BASE = (ENV.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ""
BUCKET = ENV.get("SUPABASE_BUCKET") or "ebooks"
if not BASE or not KEY:
    sys.exit("ต้องตั้ง NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local ก่อน")


def call(method, path, body=None, headers=None):
    req = urllib.request.Request(
        f"{BASE}/storage/v1/{path}",
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {KEY}", "apikey": KEY, **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.read()
    except urllib.error.HTTPError as err:
        sys.exit(f"Storage ตอบ {err.code} ({method} {path}): {err.read().decode('utf-8', 'replace')[:300]}")


def list_pages():
    body = json.dumps({"prefix": f"exam/{EXAM_ID}/{PAGES_DIR}", "limit": 1000, "offset": 0}).encode()
    rows = json.loads(call("POST", f"object/list/{BUCKET}", body, {"Content-Type": "application/json"}))
    return sorted(r["name"] for r in rows if re.fullmatch(r"page-\d+\.png", r["name"]))


def stamp(png_bytes, page_no):
    page = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    width, height = page.size
    scale = width / 595
    # หน้า PDF ลำดับคี่ (นับจาก 0) เยื้องขวา — ลำดับเดียวกับลายน้ำในไฟล์โจทย์ PDF
    base_x = width * (BRAND_X_RIGHT if (page_no - 1) % 2 == 1 else BRAND_X_LEFT)
    fill = (BRAND_GRAY, BRAND_GRAY, BRAND_GRAY, round(255 * BRAND_OPACITY))

    layer = Image.new("RGBA", page.size, (0, 0, 0, 0))
    for j, line in enumerate(BRAND_LINES):
        font = ImageFont.truetype(FONT_FILE, round(line["size"] * scale))
        text_w = math.ceil(font.getlength(line["text"]))
        # วาดข้อความโดยให้ "จุดเริ่มเส้นฐาน" อยู่กลางผืน แล้วหมุนรอบจุดนั้น = หมุนรอบจุดเดียวกับใน PDF
        half = text_w + round(60 * scale)
        tile = Image.new("RGBA", (half * 2, half * 2), (0, 0, 0, 0))
        ImageDraw.Draw(tile).text((half, half), line["text"], font=font, fill=fill, anchor="ls")
        tile = tile.rotate(BRAND_ANGLE, resample=Image.BICUBIC, center=(half, half))
        x = base_x + j * 3 * scale
        y = height - height * line["y_frac"]  # PDF นับ y จากขอบล่าง
        _paste_clipped(layer, tile, round(x) - half, round(y) - half)

    out = io.BytesIO()
    Image.alpha_composite(page, layer).convert("RGB").save(out, format="PNG", optimize=True)
    return out.getvalue()


def _paste_clipped(layer, tile, left, top):
    """วางผืนข้อความลงบนหน้า โดยตัดส่วนที่ล้นขอบออกก่อน (alpha_composite ไม่รับพิกัดติดลบ)"""
    box = (max(0, -left), max(0, -top), min(tile.width, layer.width - left), min(tile.height, layer.height - top))
    if box[0] >= box[2] or box[1] >= box[3]:
        return
    layer.alpha_composite(tile.crop(box), (max(0, left), max(0, top)))


def main():
    if not os.path.exists(FONT_FILE):
        sys.exit(f"missing {FONT_FILE}")
    names = list_pages()
    if not names:
        sys.exit(f"ไม่พบรูปหน้าโจทย์ที่ {BUCKET}/exam/{EXAM_ID}/{PAGES_DIR} — รัน scripts/upload-exam-assets.mjs ก่อน")
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)

    for i, name in enumerate(names, 1):
        page_no = int(re.search(r"\d+", name).group())
        src = call("GET", f"object/{BUCKET}/{urllib.parse.quote(f'exam/{EXAM_ID}/{PAGES_DIR}/{name}')}")
        stamped = stamp(src, page_no)
        if PREVIEW_DIR:
            with open(os.path.join(PREVIEW_DIR, name), "wb") as f:
                f.write(stamped)
        if not DRY_RUN:
            call(
                "POST",
                f"object/{BUCKET}/{urllib.parse.quote(f'exam/{EXAM_ID}/{PAGES_WM_DIR}/{name}')}",
                stamped,
                {"Content-Type": "image/png", "x-upsert": "true"},
            )
        if i % 10 == 0 or i == len(names):
            print(f"{'stamped' if DRY_RUN else 'uploaded'} {i}/{len(names)}")

    print(f"done: {len(names)} pages -> {BUCKET}/exam/{EXAM_ID}/{PAGES_WM_DIR}/" + (" (dry run, nothing uploaded)" if DRY_RUN else ""))


if __name__ == "__main__":
    main()
