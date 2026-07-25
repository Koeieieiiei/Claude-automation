# -*- coding: utf-8 -*-
"""
สร้างชุดข้อมูล "ทำข้อสอบออนไลน์" จากไฟล์ต้นฉบับ (รันครั้งเดียว หรือรันใหม่เมื่อเปลี่ยนไฟล์โจทย์/เฉลย)

    python scripts/build-exam-assets.py

อ่าน:
  assets/master-questions.pdf   โจทย์ 1-70 (หน้า 1 ปก, 2-3 คำชี้แจง, 4-57 โจทย์)
  assets/master-answers.pdf     เฉลย — หน้า 1-2 มี "ตารางเฉลยรวม" (ข้อ/ตอบ/ระดับ)

สร้าง:
  assets/exam-pages/page-NN.png     รูปโจทย์รายหน้า (เสิร์ฟผ่าน API ที่เช็คสิทธิ์เท่านั้น — ห้าม commit)
  data/exam/answer-key.json         เฉลย + ระดับความยากรายข้อ (server เท่านั้น — ห้าม commit)
  lib/exam-manifest.json            ข้อมูลไม่ลับสำหรับหน้าเว็บ (ตำแหน่งข้อ, ตอน, ขนาดหน้า)
  data/exam/population.json         ประชากรจำลองสำหรับสถิติ (DEMO — ดูหมายเหตุใน demo panel)
"""
import fitz  # PyMuPDF
import json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q_PDF = os.path.join(ROOT, "assets", "master-questions.pdf")
A_PDF = os.path.join(ROOT, "assets", "master-answers.pdf")
PAGES_DIR = os.path.join(ROOT, "assets", "exam-pages")
DATA_DIR = os.path.join(ROOT, "data", "exam")
MANIFEST = os.path.join(ROOT, "lib", "exam-manifest.json")

TOTAL_Q = 70
DPI = 150
FIRST_Q_PAGE = 4  # หน้า PDF (1-based) ที่โจทย์ข้อ 1 เริ่ม
INSTRUCTION_PAGES = [2, 3]  # หน้าคำชี้แจง แสดงก่อนเริ่มสอบ

SECTIONS = [
    {"no": 1, "title": "ความถนัดด้านตัวเลข", "from": 1, "to": 15},
    {"no": 2, "title": "ความถนัดด้านมิติสัมพันธ์", "from": 16, "to": 30},
    {"no": 3, "title": "ความถนัดด้านเชิงกลและความถนัดด้านฟิสิกส์", "from": 31, "to": 45},
    {"no": 4, "title": "ความคิดเชิงวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์", "from": 46, "to": 60},
    {"no": 5, "title": "ความสนใจข่าวสารความรู้ทางด้านวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์", "from": 61, "to": 70},
]

DIFF_MAP = {"ง่าย": "easy", "กลาง": "medium", "ยาก": "hard"}


def parse_answer_table():
    """อ่านตารางเฉลยรวมจากหน้า 1-2 ของไฟล์เฉลย → {ข้อ: {answer, difficulty}}"""
    doc = fitz.open(A_PDF)
    tokens = []
    for i in (0, 1):
        tokens += doc[i].get_text().split()
    key = {}
    expected = 1
    j = 0
    while j < len(tokens) - 2 and expected <= TOTAL_Q:
        t = tokens[j]
        if t == str(expected):
            ans, diff = tokens[j + 1], tokens[j + 2]
            if ans in {"1", "2", "3", "4", "5"} and diff in DIFF_MAP:
                key[expected] = {"answer": int(ans), "difficulty": DIFF_MAP[diff]}
                expected += 1
                j += 3
                continue
        j += 1
    if len(key) != TOTAL_Q:
        sys.exit(f"parse answer table failed: got {len(key)}/{TOTAL_Q}")
    return key


def locate_questions(doc):
    """หาว่าข้อแต่ละข้อเริ่มที่หน้าไหน ตำแหน่งแนวตั้งเท่าไร (เลขข้ออยู่ชิดซ้าย x<100, ช้อยส์เยื้องเข้ามา)"""
    positions = {}
    expected = 1
    for pi in range(FIRST_Q_PAGE - 1, len(doc)):
        page = doc[pi]
        h = page.rect.height
        d = page.get_text("dict")
        for block in d["blocks"]:
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                x0, y0 = spans[0]["bbox"][0], spans[0]["bbox"][1]
                text = "".join(s["text"] for s in spans).strip()
                m = re.match(r"^(\d{1,2})\.", text)
                if m and x0 < 100 and int(m.group(1)) == expected:
                    positions[expected] = {"page": pi + 1, "yFrac": round(max(0.0, (y0 - 14) / h), 4)}
                    expected += 1
                    if expected > TOTAL_Q:
                        return positions
    return positions


def render_pages(doc, page_numbers):
    os.makedirs(PAGES_DIR, exist_ok=True)
    size = None
    for n in page_numbers:
        pix = doc[n - 1].get_pixmap(dpi=DPI)
        pix.save(os.path.join(PAGES_DIR, f"page-{n:02d}.png"))
        size = (pix.width, pix.height)
    return size


def build_population(answer_key, n_students=612, seed=20260725):
    """จำลองประชากรผู้สอบ (DEMO): นักเรียนแต่ละคนมีความสามารถ theta,
    โอกาสตอบถูกรายข้อขึ้นกับความยากข้อ → ได้ทั้งการแจกแจงคะแนนและ % ตอบถูกรายข้อที่สอดคล้องกัน"""
    rng = random.Random(seed)
    b = {"easy": -0.9, "medium": 0.35, "hard": 1.6}  # ความยากมาตรฐาน
    import math

    scores = []
    per_q_correct = {q: 0 for q in answer_key}
    for _ in range(n_students):
        theta = rng.gauss(-0.6, 1.1)
        correct = 0
        for q, info in answer_key.items():
            p = 1 / (1 + math.exp(-1.35 * (theta - b[info["difficulty"]])))
            p = 0.16 + 0.84 * p  # เดามั่วยังถูกได้ ~1/5
            if rng.random() < p:
                correct += 1
                per_q_correct[q] += 1
        scores.append(correct)
    return {
        "note": "DEMO population — ประชากรจำลองเพื่อทดสอบระบบ ไม่ใช่ผู้สอบจริง",
        "nStudents": n_students,
        "scoresRaw": scores,  # จำนวนข้อถูก (0-70) ของนักเรียนจำลองแต่ละคน
        "perQuestionCorrect": per_q_correct,  # จำนวนคนที่ตอบถูกในแต่ละข้อ
    }


def main():
    for f in (Q_PDF, A_PDF):
        if not os.path.exists(f):
            sys.exit(f"missing {f}")
    os.makedirs(DATA_DIR, exist_ok=True)

    key = parse_answer_table()
    doc = fitz.open(Q_PDF)
    positions = locate_questions(doc)
    if len(positions) != TOTAL_Q:
        missing = [q for q in range(1, TOTAL_Q + 1) if q not in positions]
        sys.exit(f"locate questions failed, missing: {missing}")

    last_page = len(doc)
    question_pages = list(range(FIRST_Q_PAGE, last_page + 1))
    size = render_pages(doc, INSTRUCTION_PAGES + question_pages)

    with open(os.path.join(DATA_DIR, "answer-key.json"), "w", encoding="utf-8") as f:
        json.dump({str(q): key[q] for q in sorted(key)}, f, ensure_ascii=False, indent=2)

    manifest = {
        "totalQuestions": TOTAL_Q,
        "choices": 5,
        "durationMinutes": 180,
        "maxScore": 300,
        "instructionPages": INSTRUCTION_PAGES,
        "questionPages": question_pages,
        "pageWidth": size[0],
        "pageHeight": size[1],
        "sections": SECTIONS,
        "questions": [{"no": q, **positions[q]} for q in sorted(positions)],
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    with open(os.path.join(DATA_DIR, "population.json"), "w", encoding="utf-8") as f:
        json.dump(build_population(key), f, ensure_ascii=False)

    print(f"OK: {len(key)} answers, {len(positions)} question positions, "
          f"{len(INSTRUCTION_PAGES) + len(question_pages)} pages rendered ({size[0]}x{size[1]})")


if __name__ == "__main__":
    main()
