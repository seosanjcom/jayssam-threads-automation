from __future__ import annotations

import csv
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
QUEUE_PATH = Path(os.environ.get("JAYSSAM_NEWS_QUEUE_PATH", str(ROOT / "content" / "jayssam-news-queue.csv")))
OUT_ROOT = ROOT / "outputs" / "automation"
CARD_ROOT = ROOT / "outputs" / "cards" / "jayssam-editorial"
KST = timezone(timedelta(hours=9))
ALLOWED_STATUS = {"queued", "approved"}
BRAND = "JAYSSAM / CLASSROOM EDIT"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def clean(value: str | None) -> str:
    return (value or "").strip()


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9가-힣_-]+", "-", value.strip()).strip("-")
    return value[:60] or "education-note"


def split_facts(value: str) -> list[str]:
    return [item.strip() for item in re.split(r"\s*\|\s*|\n+", value or "") if item.strip()][:4]


def read_queue() -> list[dict]:
    if not QUEUE_PATH.exists():
        return []
    with QUEUE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def pick_row(date_text: str, slot: str) -> dict | None:
    ranked: list[tuple[int, int, dict]] = []
    for index, row in enumerate(read_queue()):
        if clean(row.get("status")).lower() not in ALLOWED_STATUS:
            continue
        if clean(row.get("due_date")) != date_text:
            continue
        if (clean(row.get("slot")) or slot) != slot:
            continue
        try:
            priority = int(clean(row.get("priority")) or "50")
        except ValueError:
            priority = 50
        ranked.append((-priority, index, row))
    return sorted(ranked)[0][2] if ranked else None


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text or "").split("\n"):
        current = ""
        for char in paragraph:
            candidate = current + char
            if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    if len(lines) >= 2 and len(lines[-1]) <= 2 and re.fullmatch(r"[.!?…]+", lines[-1]):
        lines[-2] += lines[-1]
        lines.pop()
    return lines or [""]


def draw_block(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fnt: ImageFont.ImageFont, fill: str, max_width: int, gap: int = 12, max_lines: int = 5) -> int:
    for line in wrap(draw, text, fnt, max_width)[:max_lines]:
        draw.text((x, y), line, font=fnt, fill=fill)
        box = draw.textbbox((x, y), line, font=fnt)
        y += box[3] - box[1] + gap
    return y


def editorial_data(row: dict) -> dict:
    title = clean(row.get("source_title")) or clean(row.get("hook")) or "오늘의 교육 이슈"
    hook = clean(row.get("hook")) or title
    facts = split_facts(clean(row.get("key_facts")))
    fact = facts[0] if facts else "원문에서 확인된 변화가 아이의 일상에도 어떤 질문을 남기는지 살펴볼 필요가 있습니다."
    parent = clean(row.get("parent_takeaway")) or "이 변화가 우리 아이의 수업과 선택에 어떻게 닿는지 한 번만 물어보세요."
    angle = clean(row.get("jayssam_angle")) or "제이쌤은 제도 자체보다 아이가 자기 경험을 설명하는 장면을 먼저 봅니다."
    source = clean(row.get("source_name")) or "원문 출처"
    source_url = clean(row.get("source_url"))
    category = clean(row.get("category")) or "교육 이슈"
    question = clean(row.get("question")) or parent
    return {
        "title": title,
        "hook": hook,
        "fact": fact,
        "parent": parent,
        "angle": angle,
        "source": source,
        "source_url": source_url,
        "category": category,
        "question": question,
        "facts": facts,
    }


def slide_texts(row: dict) -> list[tuple[str, str, str]]:
    data = editorial_data(row)
    return [
        ("01 / HEADLINE", data["hook"], "뉴스를 한 줄로 읽지 않고, 아이의 하루까지 번역합니다."),
        ("02 / FACT", "지금 확인된 변화", data["fact"]),
        ("03 / JAYSSAM'S NOTE", "제이쌤은 여기서 멈춥니다", data["angle"]),
        ("04 / AT HOME", "오늘 이 질문 하나", data["question"]),
        ("05 / SAVE", "결국 봐야 할 것은", data["parent"]),
    ]


def make_card(out: Path, row: dict, index: int, total: int, kicker: str, title: str, body: str) -> None:
    width, height = 1080, 1350
    paper, navy, coral, blue, ink, mute = "#F6F1E7", "#1D2A44", "#EF6047", "#9FC5E8", "#151A23", "#667085"
    image = Image.new("RGB", (width, height), paper)
    draw = ImageDraw.Draw(image)
    margin = 76

    draw.rectangle((0, 0, width, 172), fill=navy)
    draw.text((margin, 54), BRAND, font=font(28, True), fill="#FFFFFF")
    draw.text((margin, 100), "EDUCATION, TRANSLATED INTO A CHILD'S DAY", font=font(18, True), fill=blue)
    draw.text((width - 174, 66), f"{index:02d}/{total:02d}", font=font(30, True), fill="#FFFFFF")

    draw.rectangle((margin, 238, margin + 14, 306), fill=coral)
    draw.text((margin + 34, 244), kicker, font=font(24, True), fill=coral)
    title_font = font(76 if index == 1 else 64, True)
    title_y = draw_block(draw, margin, 356, title, title_font, ink, width - (margin * 2), 16, 4)
    draw.line((margin, title_y + 32, width - margin, title_y + 32), fill="#CFD1D3", width=3)

    panel_top = title_y + 86
    panel_bottom = min(panel_top + 390, 1065)
    draw.rounded_rectangle((margin, panel_top, width - margin, panel_bottom), radius=28, fill="#FFFFFF")
    draw.rectangle((margin, panel_top, margin + 12, panel_bottom), fill=navy if index % 2 else coral)
    draw_block(draw, margin + 44, panel_top + 48, body, font(38 if index == 1 else 34, False), ink, width - (margin * 2) - 84, 18, 7)

    marker = ["제도보다 장면", "사실과 해석 분리", "아이의 언어로 번역", "집에서 대화 시작", "저장할 관점"][index - 1]
    draw.rounded_rectangle((margin, 1122, width - margin, 1208), radius=18, fill=navy)
    draw.text((margin + 28, 1146), marker, font=font(27, True), fill="#FFFFFF")
    draw.text((margin, 1270), "원문을 확인하고, 각 가정의 상황에 맞게 해석하세요.", font=font(23), fill=mute)
    draw.text((width - margin - 250, 1270), clean(row.get("source_name"))[:18], font=font(21, True), fill=mute)

    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, quality=95)


def clamp_threads(text: str, limit: int = 480) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def build_threads_text(row: dict) -> str:
    data = editorial_data(row)
    fact_lines = [f"- {fact}" for fact in data["facts"][:2]] or [f"- {data['fact']}"]
    sections = [
        f"{data['hook']}",
        "[확인된 변화]\n" + "\n".join(fact_lines),
        f"[제이쌤의 해석]\n{data['angle']}",
        f"[오늘 집에서]\n{data['question']}",
        "원문은 댓글에 남겨둘게요.",
    ]
    return clamp_threads("\n\n".join(sections))


def build_comments(row: dict) -> list[str]:
    data = editorial_data(row)
    comments = []
    if data["source_url"]:
        comments.append(f"원문 출처 · {data['source']}\n{data['source_url']}")
    comments.append("제이쌤의 기준은 하나예요. 뉴스의 결론을 외우기보다, 아이가 자기 경험을 어떻게 말하고 고치는지 관찰해보는 것.")
    return comments


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (sys.argv[1] if len(sys.argv) > 1 else datetime.now(KST).strftime("%Y-%m-%d"))
    slot = os.environ.get("JAYSSAM_SLOT") or (sys.argv[2] if len(sys.argv) > 2 else "afternoon")
    row = pick_row(date_text, slot)
    if not row:
        print(f"No queued Jayssam news row for {date_text} {slot}.")
        raise SystemExit(3)

    row_id = slugify(clean(row.get("id")) or clean(row.get("source_title")) or "education-note")
    draft_id = f"QUEUE-{date_text.replace('-', '')}-{slot}-{row_id}"
    card_dir = CARD_ROOT / date_text / slot / row_id
    slides = slide_texts(row)
    media_paths: list[str] = []
    for index, (kicker, title, body) in enumerate(slides, start=1):
        output = card_dir / f"card_{index:02d}.png"
        make_card(output, row, index, len(slides), kicker, title, body)
        media_paths.append(str(output.relative_to(ROOT)).replace("\\", "/"))

    data = editorial_data(row)
    out_dir = OUT_ROOT / date_text
    out_dir.mkdir(parents=True, exist_ok=True)
    draft = {
        "id": draft_id,
        "date": date_text,
        "slot": slot,
        "account": os.environ.get("THREADS_USER_ID", ""),
        "status": "approved",
        "pillar": "교실 장면을 읽는 교육 편집 노트",
        "keyword": data["category"],
        "title": data["title"],
        "topic": data["title"],
        "content_type": "jayssam_classroom_edit",
        "brand_system": "JAYSSAM / CLASSROOM EDIT",
        "threads_text": build_threads_text(row),
        "thread_comments": build_comments(row),
        "carousel_slides": [f"{title}\n{body}" for _, title, body in slides],
        "cardnews_slides": [{"kicker": kicker, "title": title, "body": body} for kicker, title, body in slides],
        "local_card_dir": str(card_dir.relative_to(ROOT)).replace("\\", "/"),
        "local_media_paths": media_paths,
        "source_urls": [data["source_url"]] if data["source_url"] else [],
        "source_note": data["source"],
        "queue_id": row_id,
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
    }
    draft_path = out_dir / f"{draft_id}.json"
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(str(draft_path).replace("\\", "/"), encoding="utf-8")
    print(draft_path)


if __name__ == "__main__":
    main()
