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
CARD_ROOT = ROOT / "outputs" / "cards" / "github-daily"
KST = timezone(timedelta(hours=9))
ALLOWED_STATUS = {"queued", "approved"}


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
    return value[:60] or "news"


def split_facts(value: str) -> list[str]:
    facts = [item.strip() for item in re.split(r"\s*\|\s*|\n+", value or "") if item.strip()]
    return facts[:5]


def read_queue() -> list[dict]:
    if not QUEUE_PATH.exists():
        return []
    with QUEUE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def pick_row(date_text: str, slot: str) -> dict | None:
    rows = read_queue()
    candidates = []
    for index, row in enumerate(rows):
        if clean(row.get("status")).lower() not in ALLOWED_STATUS:
            continue
        if clean(row.get("due_date")) != date_text:
            continue
        row_slot = clean(row.get("slot")) or slot
        if row_slot != slot:
            continue
        try:
            priority = int(clean(row.get("priority")) or "50")
        except ValueError:
            priority = 50
        candidates.append((priority, index, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1]))
    return candidates[0][2]


def wrap_by_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw in text.split("\n"):
        current = ""
        for char in raw:
            candidate = current + char
            if draw.textbbox((0, 0), candidate, font=fnt)[2] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    return lines


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    fnt: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    line_gap: int = 12,
) -> int:
    for line in wrap_by_width(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        bbox = draw.textbbox((x, y), line, font=fnt)
        y += bbox[3] - bbox[1] + line_gap
    return y


def slide_texts(row: dict) -> list[tuple[str, str]]:
    source_title = clean(row.get("source_title")) or "오늘 교육뉴스"
    key_facts = split_facts(clean(row.get("key_facts")))
    parent_takeaway = clean(row.get("parent_takeaway")) or "이 뉴스는 아이의 학교생활과 선택을 어떻게 봐야 하는지 알려주는 신호입니다."
    jayssam_angle = clean(row.get("jayssam_angle")) or "제이쌤 관점에서는 제도 변화보다 아이가 자기 경험을 설명할 수 있는지가 더 중요합니다."

    defaults = [
        (clean(row.get("hook")) or source_title, "기사 제목보다 중요한 건 우리 아이에게 어떤 변화가 오는지입니다."),
        ("핵심 변화 1", key_facts[0] if len(key_facts) > 0 else parent_takeaway),
        ("핵심 변화 2", key_facts[1] if len(key_facts) > 1 else "숫자와 제도 변화는 부모가 먼저 확인해야 할 신호입니다."),
        ("부모가 볼 지점", parent_takeaway),
        ("제이쌤 해석", jayssam_angle),
        ("저장 포인트", "원문은 기사로 확인하고, 핵심은 아이의 선택·기록·설명력으로 연결해서 보세요."),
    ]

    slides = []
    for index, default in enumerate(defaults, start=1):
        title = clean(row.get(f"card_{index}_title")) or default[0]
        body = clean(row.get(f"card_{index}_body")) or default[1]
        slides.append((title, body))
    return slides


def make_card(out: Path, row: dict, index: int, total: int, title: str, body: str) -> None:
    width, height = 1080, 1350
    image = Image.new("RGB", (width, height), "#f8f9fb")
    draw = ImageDraw.Draw(image)
    margin = 84

    draw.rectangle((0, 0, width, 132), fill="#eef1f5")
    draw.rounded_rectangle((54, 44, 526, 108), radius=30, fill="#ffffff")
    for cx, color in [(86, "#ea534e"), (122, "#f5bc41"), (158, "#4caf50")]:
        draw.ellipse((cx - 9, 67, cx + 9, 85), fill=color)
    draw.text((202, 64), "jayssam.edu / news", font=font(25), fill="#9ca2ab")
    draw.text((958, 64), f"{index} / {total}", font=font(28), fill="#818790")

    category = clean(row.get("category")) or "교육뉴스"
    draw.rounded_rectangle((margin, 214, margin + 350, 270), radius=10, fill="#dae8ff")
    draw.text((margin + 22, 228), f"{index:02d}  {category}", font=font(30, True), fill="#2f77e8")

    y = 356
    title_lines = title.split("\n")
    for line_index, line in enumerate(title_lines[:4]):
        fill = "#2f77e8" if line_index == len(title_lines[:4]) - 1 else "#18191b"
        draw.text((margin, y), line, font=font(74 if index == 1 else 68, True), fill=fill)
        y += 88

    y += 34
    draw.rounded_rectangle((margin, y, width - margin, y + 320), radius=18, fill="#ffffff", outline="#dee2e8", width=2)
    draw_text_block(draw, margin + 42, y + 42, body, font(32), "#18191b", width - 2 * margin - 84, 18)

    source = clean(row.get("source_name")) or "source checked"
    draw.rounded_rectangle((margin, 984, width - margin, 1096), radius=56, fill="#1a1c1f")
    draw_text_block(draw, margin + 42, 1015, "원문 확인 + 제이쌤 해석으로 재구성했습니다.", font(28, True), "#ffffff", width - 2 * margin - 84, 8)
    draw.line((margin, height - 146, width - margin, height - 146), fill="#dee2e8", width=2)
    draw.text((margin, height - 104), "제이쌤 미래교육 노트", font=font(28, True), fill="#6c727b")
    draw.text((width - margin - 360, height - 104), f"source: {source[:22]}", font=font(24), fill="#6c727b")

    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, quality=95)


def build_threads_text(row: dict) -> str:
    hook = clean(row.get("hook")) or clean(row.get("source_title")) or "오늘 교육뉴스, 그냥 넘기면 안 됩니다."
    facts = split_facts(clean(row.get("key_facts")))
    parent_takeaway = clean(row.get("parent_takeaway"))
    jayssam_angle = clean(row.get("jayssam_angle"))
    source_url = clean(row.get("source_url"))
    hashtags = clean(row.get("hashtags")) or "#교육 #교육뉴스 #자녀교육 #학부모"

    parts = [hook]
    if facts:
        parts.append("\n".join(facts))
    if parent_takeaway:
        parts.append(parent_takeaway)
    if jayssam_angle:
        parts.append(jayssam_angle)
    if source_url:
        parts.append(f"기사: {source_url}")
    parts.append(hashtags)
    return "\n\n".join(parts)


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (sys.argv[1] if len(sys.argv) > 1 else datetime.now(KST).strftime("%Y-%m-%d"))
    slot = os.environ.get("JAYSSAM_SLOT") or (sys.argv[2] if len(sys.argv) > 2 else "afternoon")
    row = pick_row(date_text, slot)
    if not row:
        print(f"No queued Jayssam news row for {date_text} {slot}.")
        raise SystemExit(3)

    row_id = slugify(clean(row.get("id")) or clean(row.get("source_title")) or "news")
    draft_id = f"QUEUE-{date_text.replace('-', '')}-{slot}-{row_id}"
    card_dir = CARD_ROOT / date_text / slot / row_id
    slides = slide_texts(row)
    media_paths: list[str] = []
    for index, (title, body) in enumerate(slides, start=1):
        output = card_dir / f"card_{index:02d}.png"
        make_card(output, row, index, len(slides), title, body)
        media_paths.append(str(output.relative_to(ROOT)).replace("\\", "/"))

    out_dir = OUT_ROOT / date_text
    out_dir.mkdir(parents=True, exist_ok=True)
    draft = {
        "id": draft_id,
        "date": date_text,
        "slot": slot,
        "account": os.environ.get("THREADS_USER_ID", ""),
        "status": "approved",
        "pillar": clean(row.get("category")) or "교육뉴스",
        "keyword": clean(row.get("category")) or "교육뉴스",
        "title": clean(row.get("source_title")) or clean(row.get("hook")) or draft_id,
        "topic": clean(row.get("source_title")) or clean(row.get("hook")) or draft_id,
        "content_type": "queued_education_news",
        "threads_text": build_threads_text(row),
        "thread_comments": [clean(row.get("comment_1")), clean(row.get("comment_2"))],
        "carousel_slides": [f"{title}\n{body}" for title, body in slides],
        "cardnews_slides": [{"title": title, "body": body} for title, body in slides],
        "local_card_dir": str(card_dir.relative_to(ROOT)).replace("\\", "/"),
        "local_media_paths": media_paths,
        "source_urls": [clean(row.get("source_url"))] if clean(row.get("source_url")) else [],
        "source_note": clean(row.get("source_name")) or "education news queue",
        "queue_id": row_id,
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
    }
    draft["thread_comments"] = [item for item in draft["thread_comments"] if item]

    draft_path = out_dir / f"{draft_id}.json"
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(str(draft_path).replace("\\", "/"), encoding="utf-8")
    print(draft_path)


if __name__ == "__main__":
    main()
