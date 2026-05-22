import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_CANDIDATES = [
    Path("C:/Users/NOTE/AppData/Local/Microsoft/Windows/Fonts/NanumSquareEB.otf"),
    Path("C:/Users/NOTE/AppData/Local/Microsoft/Windows/Fonts/NanumSquareB.otf"),
    Path("C:/Windows/Fonts/malgunbd.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc"),
]
FONT_REG_CANDIDATES = [
    Path("C:/Users/NOTE/AppData/Local/Microsoft/Windows/Fonts/NanumSquareR.otf"),
    Path("C:/Windows/Fonts/malgun.ttf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"),
]


def pick_font(candidates):
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return "arial.ttf"


FONT_BOLD = pick_font(FONT_CANDIDATES)
FONT_REG = pick_font(FONT_REG_CANDIDATES)


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def text_size(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap_text(draw, text, fnt, max_width):
    lines = []
    for raw in str(text).split("\n"):
        raw = raw.strip()
        if not raw:
            lines.append("")
            continue
        current = ""
        for ch in raw:
            test = current + ch
            if text_size(draw, test, fnt)[0] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = ch
        if current:
            lines.append(current)
    return lines


def clean_sentences(text):
    parts = [p.strip() for p in re.split(r"[\n.?!]+", text) if p.strip()]
    return [p for p in parts if len(p) >= 5]


def normalize_slide(item, index):
    if isinstance(item, dict):
        return {
            "kicker": str(item.get("kicker") or item.get("label") or f"POINT {index}").strip(),
            "title": str(item.get("title") or item.get("headline") or "").strip(),
            "body": str(item.get("body") or item.get("text") or item.get("description") or "").strip(),
            "footer": str(item.get("footer") or item.get("note") or "").strip(),
        }

    text = str(item).strip()
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    if len(lines) >= 2:
        return {"kicker": f"POINT {index}", "title": lines[0], "body": "\n".join(lines[1:]), "footer": ""}
    return {"kicker": f"POINT {index}", "title": text, "body": "", "footer": ""}


def build_slides(draft):
    explicit = draft.get("cardnews_slides") or draft.get("carousel_slides")
    if explicit and isinstance(explicit, list):
        slides = [normalize_slide(item, idx) for idx, item in enumerate(explicit, start=1)]
        return slides[:6]

    text = draft.get("threads_text", "")
    sentences = clean_sentences(text)
    title = sentences[0] if sentences else "콘텐츠 부업은 플랫폼보다 기준이 먼저입니다"
    body_candidates = sentences[1:5] or [
        "조회수보다 먼저 봐야 할 것은 반복해서 팔릴 수 있는 구조입니다.",
        "주제가 넓으면 글쓰기가 어려운 것이 아니라 읽는 사람이 자기 상황을 못 찾습니다.",
        "수익형 콘텐츠는 글 하나가 아니라 검색, 저장, 댓글, 상품까지 이어지는 길을 설계해야 합니다.",
    ]

    slides = [{"kicker": "OFFNOTE CHECK", "title": title, "body": "", "footer": ""}]
    for idx, sentence in enumerate(body_candidates[:4], start=2):
        slides.append({
            "kicker": f"기준 {idx - 1}",
            "title": sentence,
            "body": "이 기준을 통과하지 못하면 오래 쓰고도 수익으로 연결되기 어렵습니다.",
            "footer": "본문과 댓글에서 더 구체화",
        })
    return slides[:6]


def fit_font(draw, text, start, minimum, bold, max_width, max_lines):
    size = start
    while size >= minimum:
        fnt = font(size, bold)
        if len(wrap_text(draw, text, fnt, max_width)) <= max_lines:
            return fnt
        size -= 2
    return font(minimum, bold)


def draw_wrapped(draw, xy, text, fnt, fill, max_width, max_lines, line_gap=16):
    x, y = xy
    lines = wrap_text(draw, text, fnt, max_width)[:max_lines]
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line or " ", fnt)[1] + line_gap
    return y


def draw_card(path, index, total, slide, draft):
    width, height = 1080, 1350
    ink = "#101418"
    white = "#FFFFFF"
    lime = "#CCFF3D"
    coral = "#FF6B4A"
    muted = "#AEB8C2"
    panel = "#192126"
    panel_2 = "#222B31"
    line = "#3A454D"

    img = Image.new("RGB", (width, height), ink)
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, width, 130), fill=lime)
    d.text((64, 43), "OFFNOTE.KR", font=font(34, True), fill=ink)
    d.text((width - 170, 43), f"{index}/{total}", font=font(34, True), fill=ink)

    d.rectangle((64, 220, 318, 278), fill=coral)
    d.text((88, 235), slide["kicker"][:18], font=font(24, True), fill=white)

    title_font = fit_font(d, slide["title"], 84 if index == 1 else 68, 46, True, width - 128, 5)
    y = draw_wrapped(d, (64, 340), slide["title"], title_font, white, width - 128, 5, 22)

    d.line((64, y + 48, width - 64, y + 48), fill=lime, width=8)

    if slide["body"]:
        d.rectangle((64, y + 105, width - 64, height - 210), fill=panel, outline=line, width=2)
        body_font = fit_font(d, slide["body"], 44, 30, False, width - 190, 7)
        draw_wrapped(d, (104, y + 150), slide["body"], body_font, "#E7EDF1", width - 190, 7, 18)
    else:
        d.rectangle((64, y + 105, width - 64, y + 205), fill=panel_2, outline=line, width=2)
        d.text((104, y + 135), "저장할 기준만 짧게 남깁니다.", font=font(34, True), fill=lime)

    if slide["footer"]:
        d.text((64, height - 135), slide["footer"][:36], font=font(30, True), fill=lime)
    d.text((64, height - 82), "@offnote.kr", font=font(26, True), fill=muted)

    img.save(path)


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_offnote_cardnews.py DRAFT_JSON", file=sys.stderr)
        sys.exit(1)

    draft_path = Path(sys.argv[1])
    draft = json.loads(draft_path.read_text(encoding="utf-8"))
    slides = build_slides(draft)
    out_dir = ROOT / "outputs" / "cards" / "offnote" / draft.get("id", draft_path.stem)
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = []
    for idx, slide in enumerate(slides, start=1):
        out = out_dir / f"card_{idx:02d}.png"
        draw_card(out, idx, len(slides), slide, draft)
        paths.append(str(out.relative_to(ROOT)))

    draft["local_media_paths"] = paths
    draft["cardnews_quality_rule"] = "Cardnews must add separate criteria, checklist, comparison, or examples. Do not split the post summary into images."
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out_dir / "cardnews-copy.txt").write_text(
        "\n\n".join(
            f"[{i + 1}]\n{slide['kicker']}\n{slide['title']}\n{slide['body']}\n{slide['footer']}".strip()
            for i, slide in enumerate(slides)
        ),
        encoding="utf-8",
    )
    print(json.dumps({"draft": str(draft_path), "cards": paths}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
