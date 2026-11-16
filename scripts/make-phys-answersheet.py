# -*- coding: utf-8 -*-
"""
สร้างกระดาษคำตอบ Mock A-Level ฟิสิกส์ (A4 1 หน้า) แบบเดียวกับกระดาษคำตอบ Mock TPAT3 — สีโทนปก PHYSICS
(เจ้าของสั่ง 2026-11-16 "ขอแนบกระดาษคำตอบเหมือน mock TPAT3 ด้วย")

    python scripts/make-phys-answersheet.py

ได้ 2 ไฟล์:
  public/covers/answersheet-physics.png  รูปวางเหลื่อมหลังปก Mock ฟิสิกส์บนหน้าเว็บ (กว้าง 1400 เท่า answersheet.png)
  assets/master-phys-answersheet.pdf     ต้นฉบับ PDF (git-ignored) — ไม่ได้แจกลูกค้า: เจ้าของสั่ง 2026-11-16
                                         "ไฟล์กระดาษคำตอบเอามาเป็นหน้าปกอย่างเดียวพอ"
ตอนที่ 1 ข้อ 1-25 ปรนัย 5 ตัวเลือก / ตอนที่ 2 ข้อ 26-30 ช่องตัวเลข (เครื่องหมายลบ + 4 หลัก . 2 ตำแหน่ง) / รหัสวิชา 64
ต้องมี playwright (python) + เน็ต (ฟอนต์ Anuphan/Kanit จาก Google Fonts)
"""
import sys, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "master-phys-answersheet.pdf")
OUT_PNG = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "public", "covers", "answersheet-physics.png")

C = "#8A3A12"       # สีหลัก (น้ำตาลส้มเข้ม — โทนเฟืองบนปก)
C2 = "#C8571A"      # สีเน้น (PHYSICS บนปก)
SOFT = "#FBE9DD"    # พื้นหัวตาราง
BUB = "#E3B79A"     # เส้นวงกลม

def bubbles(n_from, n_to, choices=5):
    return "".join(f'<span class="b">{c}</span>' for c in range(n_from, n_to + 1))

def digit_col(filled=None):
    return "".join(
        f'<span class="b{" f" if filled == d else ""}">{"" if filled == d else d}</span>' for d in range(10)
    )

# ---------- ส่วนหัว ----------
seat_cols = "".join(f'<div class="dcol">{digit_col()}</div>' for _ in range(7))
id_cols = "".join(f'<div class="dcol">{digit_col()}</div>' for _ in range(13))
code_cols = f'<div class="dcol">{digit_col(6)}</div><div class="dcol">{digit_col(4)}</div>'

# ---------- ตอนที่ 1: ข้อ 1–25 (5 คอลัมน์ x 5 แถว) ----------
p1_cols = ""
for col in range(5):
    rows = ""
    for r in range(5):
        q = col * 5 + r + 1
        rows += f'<div class="qrow"><span class="qn">{q}</span>{bubbles(1, 5)}</div>'
    p1_cols += f'<div class="qcol">{rows}</div>'
timing1 = "".join('<i class="tm"></i>' for _ in range(5))

# ---------- ตอนที่ 2: ข้อ 26–30 ช่องตัวเลข (เครื่องหมายลบ + 4 หลัก . 2 ตำแหน่ง) ----------
def numeric_grid(q):
    head = '<div class="ncell sign">±</div>' + "".join('<div class="ncell"></div>' for _ in range(4)) + \
           '<div class="ncell dot">.</div>' + "".join('<div class="ncell"></div>' for _ in range(2))
    sign_col = '<div class="dcol"><span class="b">−</span></div>'
    digits = "".join(f'<div class="dcol">{digit_col()}</div>' for _ in range(4))
    dot = '<div class="dcol dotcol"><span class="dotmark">•</span></div>'
    decs = "".join(f'<div class="dcol">{digit_col()}</div>' for _ in range(2))
    return f'''<div class="ngrid">
      <div class="nq">ข้อ {q}</div>
      <div class="nhead">{head}</div>
      <div class="ncols">{sign_col}{digits}{dot}{decs}</div>
    </div>'''

p2 = "".join(numeric_grid(q) for q in range(26, 31))

html = f'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Kanit:wght@600&display=swap">
<style>
@page {{ size: A4; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ width: 210mm; height: 297mm; }}
body {{ font-family: "Anuphan", sans-serif; color: {C}; position: relative; font-size: 9.2pt; }}
.reg {{ position: absolute; width: 5.2mm; height: 5.2mm; background: #111; }}
.page {{ position: absolute; left: 11mm; right: 11mm; top: 12.5mm; bottom: 14mm; display: flex; flex-direction: column; gap: 4mm; }}
.box {{ border: 1.1px solid {C}; border-radius: 2.2mm; background: #fff; overflow: hidden; }}
.hd {{ background: {SOFT}; border-bottom: 1.1px solid {C}; text-align: center; font-weight: 700; padding: 1.6mm 2mm; font-size: 9.6pt; line-height: 1.25; }}
.b {{ display: inline-grid; place-items: center; width: 4mm; height: 4mm; border: 0.8px solid {BUB}; border-radius: 50%;
      font-size: 6.4pt; color: {BUB}; line-height: 1; font-weight: 500; }}
.b.f {{ background: #111; border-color: #111; }}
.dcol {{ display: flex; flex-direction: column; align-items: center; gap: 0.55mm; }}
.row1 {{ display: grid; grid-template-columns: 50mm 1fr 22mm 52mm; gap: 2.4mm; height: 66mm; }}
.brand {{ display: flex; flex-direction: column; }}
.brand .logo {{ font-family: "Kanit", sans-serif; font-weight: 600; font-size: 21pt; text-align: center; padding: 3.2mm 0 2.2mm; color: {C}; border-bottom: 1.6px solid {C}; letter-spacing: .3px; }}
.brand .t {{ text-align: center; font-weight: 700; font-size: 12pt; margin-top: 3mm; }}
.brand .s {{ text-align: center; font-size: 8.6pt; margin-top: .6mm; }}
.brand ul {{ margin: 3mm 3mm 0 6.4mm; font-size: 8.2pt; line-height: 1.32; }}
.brand li {{ margin-bottom: 2mm; }}
.brand li b {{ font-weight: 700; }}
.fields {{ padding: 0; display: flex; flex-direction: column; }}
.fields .rows {{ padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: space-between; flex: 1; }}
.f {{ display: flex; align-items: end; gap: 1.6mm; font-weight: 700; font-size: 8.8pt; white-space: nowrap; }}
.f span {{ flex: 1; min-width: 8mm; border-bottom: 0.9px dotted {C}; height: 3.5mm; }}
.f.sig {{ font-size: 8pt; }}
.sep {{ border-top: 0.9px solid {BUB}; margin: .4mm 0; }}
.codebox .digits {{ display: flex; border-bottom: 1.1px solid {C}; }}
.codebox .digits div {{ flex: 1; text-align: center; font-weight: 700; font-size: 11pt; padding: 1mm 0; }}
.codebox .digits div + div {{ border-left: 1.1px solid {C}; }}
.grid {{ display: flex; justify-content: space-around; padding: 1.6mm 1mm 0; }}
.seat .cells, .idbox .cells {{ display: flex; border-bottom: 0.9px solid {BUB}; }}
.cells div {{ flex: 1; height: 5.2mm; }}
.cells div + div {{ border-left: 0.9px solid {BUB}; }}
.row2 {{ display: grid; grid-template-columns: 84mm 1fr; gap: 3mm; height: 63mm; }}
.idbox .grid {{ padding-top: 1.6mm; }}
.idbox .b {{ width: 3.9mm; height: 3.9mm; }}
.help {{ display: grid; grid-template-columns: 1fr 1fr; }}
.help > div + div {{ border-left: 1.1px solid {C}; }}
.help ol {{ padding: 2mm 2.6mm 0 6mm; font-size: 7.2pt; line-height: 1.34; color: #4a2a1c; }}
.help li {{ margin-bottom: .8mm; }}
.help li b {{ color: {C}; }}
.ex {{ padding: 2.2mm 2.6mm 0; display: flex; flex-direction: column; gap: 1.7mm; font-size: 6.8pt; color: #6b4a3a; }}
.ex .r {{ display: flex; align-items: center; gap: 1.2mm; }}
.ex .r .lab {{ margin-left: auto; font-weight: 700; font-size: 8pt; color: {C}; }}
.ex .r .lab.ok {{ color: #1E6E42; }}
.ex .r .lab.bad {{ color: #B3261E; }}
.ex .b {{ width: 4.3mm; height: 4.3mm; }}
.ex .light {{ background: #bbb; border-color: #bbb; }}
.ex .over {{ background: #111; border-color: #111; box-shadow: 1mm -0.6mm 0 -.1mm #111; }}
.ex .tick {{ border-color: {BUB}; color: #111; font-size: 10pt; font-weight: 700; }}
.ans {{ flex: 1; padding: 3mm 3.5mm 2.5mm; display: flex; flex-direction: column; align-items: center; gap: 2.4mm; position: relative; overflow: visible; }}
.ans h2 {{ font-size: 10.2pt; font-weight: 700; }}
.pill {{ background: {C}; color: #fff; border-radius: 1.4mm; padding: 1mm 5mm; font-weight: 700; font-size: 9.6pt; }}
.p1 {{ display: grid; grid-template-columns: repeat(5, 1fr); width: 100%; position: relative; }}
.qcol {{ display: flex; flex-direction: column; gap: 1.7mm; padding: 0 1.6mm; align-items: center; }}
.qcol + .qcol {{ border-left: 0.9px solid {BUB}; }}
.qrow {{ display: flex; align-items: center; gap: .8mm; }}
.qn {{ width: 5.5mm; text-align: right; margin-right: .8mm; font-weight: 700; font-size: 9pt; color: {C}; }}
.tms {{ position: absolute; left: -9.6mm; top: 0; display: flex; flex-direction: column; gap: 1.7mm; }}
.tm {{ display: block; width: 4.2mm; height: 2mm; background: #111; margin-block: 1mm; }}
.note2 {{ font-size: 7.8pt; color: #6b4a3a; text-align: center; margin-top: -1mm; }}
.p2 {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; width: 100%; }}
.ngrid {{ border: 0.9px solid {BUB}; border-radius: 1.6mm; padding: 1.2mm 1mm 1.4mm; display: flex; flex-direction: column; align-items: center; gap: 1mm; }}
.nq {{ font-weight: 700; font-size: 9pt; }}
.nhead {{ display: flex; border: 0.9px solid {C}; }}
.ncell {{ width: 3.9mm; height: 4.6mm; display: grid; place-items: center; font-weight: 700; font-size: 8pt; }}
.ncell + .ncell {{ border-left: 0.9px solid {BUB}; }}
.ncell.sign {{ background: {SOFT}; }}
.ncell.dot {{ width: 2.2mm; background: {SOFT}; }}
.ncols {{ display: flex; gap: 0; }}
.ncols .dcol {{ width: 3.9mm; gap: .5mm; }}
.ncols .b {{ width: 3.6mm; height: 3.6mm; font-size: 5.8pt; }}
.ncols .dotcol {{ width: 2.2mm; justify-content: start; }}
.dotmark {{ font-size: 9pt; color: {C}; line-height: 3.6mm; }}
.foot {{ position: absolute; bottom: 7mm; left: 0; right: 0; text-align: center; font-size: 7.4pt; color: #8b6a5a; }}
</style></head><body>
<i class="reg" style="left:5mm;top:5mm"></i><i class="reg" style="right:5mm;top:5mm"></i>
<i class="reg" style="left:5mm;bottom:5mm"></i><i class="reg" style="right:5mm;bottom:5mm"></i>
<div class="page">
  <div class="row1">
    <div class="box brand">
      <div class="logo">Mrtpat3</div>
      <div class="t">กระดาษคำตอบ</div>
      <div class="s">(มีทั้งหมด 2 ตอน)</div>
      <ul>
        <li><b>ตอนที่ 1 แบบปรนัย 5 ตัวเลือก</b><br>(ข้อ 1–25 ข้อละ 3 คะแนน)</li>
        <li><b>ตอนที่ 2 แบบระบายคำตอบที่เป็นตัวเลข</b><br>(ข้อ 26–30 ข้อละ 5 คะแนน)</li>
      </ul>
    </div>
    <div class="box fields">
      <div class="hd">A-Level ฟิสิกส์ (Physics)<br>Mock ชุดที่ 1</div>
      <div class="rows">
        <div class="f">ชื่อ-สกุล<span></span></div>
        <div class="f">วิชาที่สอบ<span></span></div>
        <div class="f">สถานที่สอบ<span></span></div>
        <div class="f">ห้องสอบ<span></span></div>
        <div class="f">วันที่สอบ<span></span></div>
        <div class="sep"></div>
        <div class="f sig">ลายมือชื่อผู้เข้าสอบ<span></span></div>
        <div class="f sig">ลายมือชื่อกรรมการคุมสอบ<span></span></div>
      </div>
    </div>
    <div class="box codebox">
      <div class="hd">รหัสวิชา</div>
      <div class="digits"><div>6</div><div>4</div></div>
      <div class="grid">{code_cols}</div>
    </div>
    <div class="box seat">
      <div class="hd">เลขที่นั่งสอบ</div>
      <div class="cells">{"<div></div>" * 7}</div>
      <div class="grid">{seat_cols}</div>
    </div>
  </div>

  <div class="row2">
    <div class="box idbox">
      <div class="hd">เลขประจำตัวประชาชน 13 หลัก</div>
      <div class="cells">{"<div></div>" * 13}</div>
      <div class="grid">{id_cols}</div>
    </div>
    <div class="box help">
      <div>
        <div class="hd">คำแนะนำ</div>
        <ol>
          <li>ผู้เข้าสอบและกรรมการคุมสอบ ลงลายมือชื่อในช่องที่กำหนด <b>ด้วยปากกา</b></li>
          <li>ระบายคำตอบด้วย <b>ดินสอดำ 2B เท่านั้น</b> ให้ทึบเต็มวง</li>
          <li>ตอนที่ 1 แต่ละข้อระบายได้ <b>เพียง 1 ตัวเลือก</b></li>
          <li>ตอนที่ 2 <b>เขียนตัวเลขในช่องด้านบน</b> แล้วระบายให้ตรงทุกหลัก ตอบตามหน่วยที่โจทย์กำหนด ค่าติดลบให้ระบายช่อง −</li>
          <li>หากต้องการเปลี่ยนคำตอบ ให้ <b>ลบด้วยยางลบให้สะอาด</b> แล้วจึงระบายใหม่</li>
          <li>ห้ามพับ ขยำ หรือทำให้กระดาษคำตอบชำรุด</li>
        </ol>
      </div>
      <div>
        <div class="hd">ตัวอย่างการระบาย</div>
        <div class="ex">
          <div class="r"><span class="b">1</span><span class="b">2</span><span class="b f"></span><span class="b">4</span><span class="b">5</span><span class="lab ok">✓ ถูกวิธี</span></div>
          <div style="margin-top:-1.4mm">ระบายทึบเต็มวง ด้วยดินสอ 2B</div>
          <div class="r"><span class="b">1</span><span class="b">2</span><span class="b light"></span><span class="b">4</span><span class="b">5</span><span class="lab bad">✗ ผิดวิธี</span></div>
          <div style="margin-top:-1.4mm">ระบายจาง ไม่เต็มวง</div>
          <div class="r"><span class="b">1</span><span class="b">2</span><span class="b tick">✓</span><span class="b">4</span><span class="b">5</span><span class="lab bad">✗ ผิดวิธี</span></div>
          <div style="margin-top:-1.4mm">ทำเครื่องหมายแทนการระบาย</div>
          <div class="r"><span class="b">1</span><span class="b f"></span><span class="b">3</span><span class="b f"></span><span class="b">5</span><span class="lab bad">✗ ผิดวิธี</span></div>
          <div style="margin-top:-1.4mm;color:#B3261E;font-weight:700">ระบาย 2 ตัวเลือกในข้อเดียว → ข้อนั้นได้ 0 คะแนน</div>
        </div>
      </div>
    </div>
  </div>

  <div class="box ans">
    <h2>จำนวน 30 ข้อ (คะแนนเต็ม 100 คะแนน) แบ่งเป็น 2 ตอน</h2>
    <div class="pill">ตอนที่ 1 : แบบปรนัย 5 ตัวเลือก ข้อที่ 1 – 25</div>
    <div class="p1"><div class="tms">{timing1}</div>{p1_cols}</div>
    <div class="pill">ตอนที่ 2 : แบบระบายคำตอบที่เป็นตัวเลข ข้อที่ 26 – 30</div>
    <div class="p2">{p2}</div>
  </div>
</div>
<div class="foot">A-Level ฟิสิกส์ / รหัสวิชา 64 / กระดาษคำตอบ 1 แผ่น (ตอนที่ 1–2) / หน้า 1/1</div>
</body></html>'''

import tempfile
src = os.path.join(tempfile.gettempdir(), "mrtpat3-phys-answersheet.html")
open(src, "w", encoding="utf-8").write(html)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    pg.goto("file:///" + src.replace("\\", "/"))
    pg.wait_for_load_state("networkidle")
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(500)
    pg.pdf(path=OUT_PDF, format="A4", print_background=True, prefer_css_page_size=True)
    b.close()

import fitz
d = fitz.open(OUT_PDF)
print("pages", d.page_count, d[0].rect)
z = 1400 / d[0].rect.width
d[0].get_pixmap(matrix=fitz.Matrix(z, z)).save(OUT_PNG)
print("png ok")
