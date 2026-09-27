# -*- coding: utf-8 -*-
"""
สร้างชุดข้อมูล "ทำข้อสอบออนไลน์" จากไฟล์ต้นฉบับ (รันครั้งเดียวต่อสนาม หรือรันใหม่เมื่อเปลี่ยนไฟล์)

    python scripts/build-exam-assets.py [examId]     (ไม่ระบุ = tpat3-1)
    python scripts/build-exam-assets.py [examId] --population-only
        สร้างเฉพาะประชากรอ้างอิงใหม่ (หลังแก้ TARGET_SCORES) ไม่แตะไฟล์อื่น

⚠️ สคริปต์นี้ตั้งค่าตามชุด TPAT3 (โครงหน้า/ตอน/น้ำหนัก/ประชากร ในค่าคงที่ด้านล่าง)
เพิ่มสนามใหม่ (เช่น A-Level) ต้องปรับค่าพวกนั้นให้ตรงกับชุดนั้นก่อนรัน
แล้วอย่าลืมเพิ่ม entry ใน lib/exams.ts ให้ตรงกัน

อ่าน:
  assets/master-questions.pdf   โจทย์ 1-70 (หน้า 1 ปก, 2-3 คำชี้แจง, 4-57 โจทย์)
      ฉบับ Sarabun 2026-09-15 ไม่มีหน้าปก (56 หน้า เริ่มที่คำชี้แจง) — สคริปต์เลื่อนเลขหน้าให้เอง
      เลขหน้าในห้องสอบจึงยังเป็น 2-57 เหมือนเดิม (ดู page_offset)
  assets/master-answers.pdf     เฉลย — มี "ตารางเฉลยรวม" (ข้อ/ตอบ/ระดับ) อยู่ใน 5 หน้าแรก

สร้าง (แยกโฟลเดอร์ตามสนาม):
  assets/exam-pages/<examId>/page-NN.png  รูปโจทย์รายหน้า (เสิร์ฟผ่าน API ที่เช็คสิทธิ์ — ห้าม commit)
  data/exam/<examId>/answer-key.json      เฉลย + ระดับความยากรายข้อ (server เท่านั้น — ห้าม commit)
  data/exam/<examId>/population.json      ประชากรอ้างอิงสำหรับสถิติ
  lib/exam-manifests/<examId>.json        ข้อมูลไม่ลับสำหรับหน้าเว็บ (ตำแหน่งข้อ, ตอน, ขนาดหน้า)
"""
import fitz  # PyMuPDF
import json, os, random, re, sys

_args = [a for a in sys.argv[1:] if not a.startswith("--")]
EXAM_ID = _args[0] if _args else "tpat3-1"
if not re.fullmatch(r"[a-z0-9-]+", EXAM_ID):
    sys.exit(f"examId ไม่ถูกต้อง: {EXAM_ID} (ใช้ a-z 0-9 และขีดกลางเท่านั้น)")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q_PDF = os.path.join(ROOT, "assets", "master-questions.pdf")
A_PDF = os.path.join(ROOT, "assets", "master-answers.pdf")
PAGES_DIR = os.path.join(ROOT, "assets", "exam-pages", EXAM_ID)
DATA_DIR = os.path.join(ROOT, "data", "exam", EXAM_ID)
MANIFEST = os.path.join(ROOT, "lib", "exam-manifests", f"{EXAM_ID}.json")

TOTAL_Q = 70
DPI = 150
# เลขหน้าด้านล่างคือ "เลขหน้าในห้องสอบ" (ชื่อไฟล์ page-NN.png) นับแบบไฟล์ที่มีหน้าปกเป็นหน้า 1
FIRST_Q_PAGE = 4  # หน้าที่โจทย์ข้อ 1 เริ่ม
INSTRUCTION_PAGES = [2, 3]  # หน้าคำชี้แจง แสดงก่อนเริ่มสอบ


def page_offset(doc) -> int:
    """เลขหน้าในห้องสอบ = เลขหน้า PDF + ค่านี้
    ไฟล์ที่ไม่มีหน้าปก (หน้า 1 เป็นคำชี้แจงเลย) ต้องเลื่อน 1 ให้เลขหน้าในห้องสอบคงเดิม —
    เครื่องผู้สอบที่เปิดห้องสอบค้างไว้จะได้ขอรูปหน้าเดิมได้ต่อ"""
    return 1 if "คำชี้แจง" in doc[0].get_text() else 0

# น้ำหนักคะแนนรายข้อ (คะแนนเต็ม 100): ข้อ 1-60 ข้อละ 4/3 (รวม 80) · ข้อ 61-70 ข้อละ 2 (รวม 20)
def question_weight(no: int) -> float:
    return 4 / 3 if no <= 60 else 2.0


SECTIONS = [
    {"no": 1, "title": "ความถนัดด้านตัวเลข", "from": 1, "to": 15},
    {"no": 2, "title": "ความถนัดด้านมิติสัมพันธ์", "from": 16, "to": 30},
    {"no": 3, "title": "ความถนัดด้านเชิงกลและความถนัดด้านฟิสิกส์", "from": 31, "to": 45},
    {"no": 4, "title": "ความคิดเชิงวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์", "from": 46, "to": 60},
    {"no": 5, "title": "ความสนใจข่าวสารความรู้ทางด้านวิทยาศาสตร์ เทคโนโลยี และวิศวกรรมศาสตร์", "from": 61, "to": 70},
]

DIFF_MAP = {"ง่าย": "easy", "กลาง": "medium", "ยาก": "hard"}


def parse_answer_table():
    """อ่านตารางเฉลยรวมจาก 5 หน้าแรกของไฟล์เฉลย → {ข้อ: {answer, difficulty}}
    (ฉบับเดิมตารางอยู่หน้า 1-2 · ฉบับ Master Answers 2026-09-16 มีปก+สารบัญ ตารางเลื่อนไปหน้า 3-4)"""
    doc = fitz.open(A_PDF)
    tokens = []
    for i in range(min(5, doc.page_count)):
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
    offset = page_offset(doc)
    for pi in range(FIRST_Q_PAGE - 1 - offset, len(doc)):
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
                    positions[expected] = {"page": pi + 1 + offset, "yFrac": round(max(0.0, (y0 - 14) / h), 4)}
                    expected += 1
                    if expected > TOTAL_Q:
                        return positions
    return positions


def render_pages(doc, page_numbers):
    os.makedirs(PAGES_DIR, exist_ok=True)
    size = None
    offset = page_offset(doc)
    for n in page_numbers:
        pix = doc[n - 1 - offset].get_pixmap(dpi=DPI)
        pix.save(os.path.join(PAGES_DIR, f"page-{n:02d}.png"))
        size = (pix.width, pix.height)
    return size


# คะแนนเป้าหมายของประชากรอ้างอิง (เต็ม 100) — เจ้าของร้านกำหนด 2026-09-27:
# ผู้สอบ 20 คน แจกแจงแบบปกติ (ค่าเฉลี่ย 45, SD 15 — ตำแหน่งควอนไทล์ของโค้งปกติ)
# นับรายช่วง 10 คะแนนได้ 1-2-4-6-4-2-1 (ช่วง 10-20 ถึง 70-80) ยอดอยู่ที่ 40-50
# คะแนนจริงที่ได้จะต่ำกว่าเป้าไม่เกิน 1.33 จึงตั้งเป้าให้ห่างขอบช่วงไว้ ไม่ให้หล่นไปช่วงข้างล่าง
# (เดิม 2026-07-25: 15 คน กองกันช่วง 30-60 + คนเก่งหลุดกลุ่ม 1 คนที่ราว 76)
TARGET_SCORES = [
    16,
    23.5, 28,
    31, 34, 36, 38.5,
    41, 42.5, 44, 46, 47.5, 49.3,
    52, 54, 56.5, 59,
    62.5, 67,
    74.5,
]


def build_population(answer_key, seed=20260725):
    """สร้างประชากรอ้างอิงให้ได้คะแนนตามที่กำหนดใน TARGET_SCORES

    วิธี: เรียงข้อตาม "ความน่าจะทำได้" (ง่ายมาก่อน + สุ่มรบกวนรายคน)
    แล้วไล่เก็บคะแนนจนใกล้เป้าหมาย — ได้ทั้งคะแนนรวมตามต้องการ และ
    % ตอบถูกรายข้อที่สมเหตุสมผล (ข้อง่ายคนตอบถูกเยอะ ข้อยากคนตอบถูกน้อย)
    """
    rng = random.Random(seed)
    base = {"easy": 0.0, "medium": 1.0, "hard": 2.0}

    scores = []
    scores_weighted = []
    per_q_correct = {q: 0 for q in answer_key}

    for target in TARGET_SCORES:
        # ลำดับการเก็บข้อของนักเรียนคนนี้ — จิตเตอร์ทำให้แต่ละคนพลาดคนละข้อ
        order = sorted(
            answer_key.keys(),
            key=lambda q: base[answer_key[q]["difficulty"]] + rng.gauss(0, 0.9),
        )
        weighted = 0.0
        correct = 0
        for q in order:
            w = question_weight(q)
            if weighted + w > target + 0.01:
                continue  # ข้อนี้ทำให้เกินเป้า ข้ามไปหาข้อที่พอดีกว่า
            weighted += w
            correct += 1
            per_q_correct[q] += 1
        scores.append(correct)
        scores_weighted.append(round(weighted, 2))

    return {
        "note": "ประชากรอ้างอิงสำหรับคิดสถิติช่วงที่ผู้สอบจริงยังน้อย (ไม่ใช่ผู้สอบจริง)",
        "nStudents": len(TARGET_SCORES),
        "scoresRaw": scores,  # จำนวนข้อถูก (0-70) ของแต่ละคน
        "scoresWeighted": scores_weighted,  # คะแนนถ่วงน้ำหนัก (เต็ม 100) ของแต่ละคน
        "perQuestionCorrect": per_q_correct,  # จำนวนคนที่ตอบถูกในแต่ละข้อ
    }


def rebuild_population_only():
    """สร้างเฉพาะ population.json ใหม่จากเฉลยที่มีอยู่แล้ว — ไม่แตะไฟล์ PDF/รูปโจทย์/เฉลย/manifest
    ใช้ตอนเปลี่ยน TARGET_SCORES อย่างเดียว (ไฟล์ master ในเครื่องอาจไม่ตรงกับที่ใช้จริงบน Storage)"""
    key_file = os.path.join(DATA_DIR, "answer-key.json")
    if not os.path.exists(key_file):
        sys.exit(f"missing {key_file}")
    with open(key_file, encoding="utf-8") as f:
        key = {int(q): v for q, v in json.load(f).items()}
    if len(key) != TOTAL_Q:
        sys.exit(f"answer key has {len(key)}/{TOTAL_Q} questions")

    pop = build_population(key)
    with open(os.path.join(DATA_DIR, "population.json"), "w", encoding="utf-8") as f:
        json.dump(pop, f, ensure_ascii=False)

    scores = pop["scoresWeighted"]
    bins = [0] * 10
    for s in scores:
        bins[min(9, int(s // 10))] += 1
    mean = sum(scores) / len(scores)
    sd = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
    print(f"OK: population {len(scores)} students, mean {mean:.2f}, sd {sd:.2f}")
    print(f"scores: {scores}")
    print(f"histogram (0-10 ... 90-100): {bins}")


def main():
    if "--population-only" in sys.argv:
        return rebuild_population_only()
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

    last_page = len(doc) + page_offset(doc)
    question_pages = list(range(FIRST_Q_PAGE, last_page + 1))
    size = render_pages(doc, INSTRUCTION_PAGES + question_pages)

    with open(os.path.join(DATA_DIR, "answer-key.json"), "w", encoding="utf-8") as f:
        json.dump({str(q): key[q] for q in sorted(key)}, f, ensure_ascii=False, indent=2)

    manifest = {
        "totalQuestions": TOTAL_Q,
        "choices": 5,
        "durationMinutes": 180,
        "maxScore": 100,
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
