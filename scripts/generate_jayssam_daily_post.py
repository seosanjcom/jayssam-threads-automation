from __future__ import annotations

import json
import os
import textwrap
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()
OUT_ROOT = ROOT / "outputs" / "automation"
CARD_ROOT = ROOT / "outputs" / "cards" / "github-daily"
KST = timezone(timedelta(hours=9))


TOPICS = [
    {
        "slug": "info-hours",
        "keyword": "정보교과",
        "title": "정보 시간이 늘어난 건, 코딩만 더 하자는 뜻이 아닙니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": [
            "https://www.korea.kr/news/policyNewsView.do?newsId=148905079",
            "https://cdn.kosac.re.kr/files/cms/attach/202501/05c5d138974447f28d9da98a29e9b087_1735878269507.pdf",
        ],
        "hook": "정보 시간이 늘어난 이유,\n코딩 때문만은 아닙니다.",
        "body": [
            "2022 개정 교육과정에서 초등·중학교 정보교육 시간은 확대됐습니다.",
            "핵심은 아이에게 코딩 문법을 더 외우게 하자는 것이 아니라, 데이터를 읽고 문제를 나누고 디지털 도구와 함께 생각하는 힘을 기르자는 방향입니다.",
            "부모님이 볼 지점은 학원 이름보다 아이가 수업에서 문제를 어떻게 설명하고, 오류를 어떻게 고치고, 결과를 어떤 말로 정리하는지입니다.",
        ],
        "slides": [
            ("01", "정보 시간이 늘어난 이유", "코딩만 더 하자는 뜻이 아닙니다."),
            ("02", "무엇이 바뀌었나요?", "초등·중학교에서 정보교육 시간이 확대됐습니다."),
            ("03", "핵심은 문법 암기가 아닙니다", "문제를 나누고, 데이터를 보고, 절차를 설명하는 힘입니다."),
            ("04", "부모님이 볼 장면", "아이가 결과보다 과정을 자기 말로 설명하는지 보세요."),
            ("05", "강사가 볼 장면", "정답 코드보다 오류를 고쳐 가는 질문이 있는 수업인지 보세요."),
            ("06", "오늘의 질문", "이 수업은 아이가 무엇을 설명하게 하나요?"),
        ],
    },
    {
        "slug": "career-no-dream",
        "keyword": "진로",
        "title": "아이가 꿈이 없다고 말해도 먼저 불안해하지 않으셔도 됩니다",
        "source_name": "커리어넷 진로교육 관점 / 학교 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "“꿈이 없어요.”\n이 대답에 바로 불안해하지 않으셔도 됩니다.",
        "body": [
            "요즘 진로는 직업명 하나를 빨리 정하는 방식으로 보기 어렵습니다.",
            "먼저 볼 것은 아이가 반복해서 선택하는 경험, 오래 붙잡는 문제, 주변에서 자주 맡는 역할입니다.",
            "직업명을 묻기 전에 “요즘 네가 자꾸 찾아보는 건 뭐야?”, “친구들이 너에게 자주 부탁하는 건 뭐야?”처럼 경험을 끌어내는 질문이 필요합니다.",
        ],
        "slides": [
            ("01", "꿈이 없다는 말", "진로가 없다는 뜻으로 바로 보지 마세요."),
            ("02", "직업명보다 먼저", "아이가 반복해서 선택하는 경험을 봅니다."),
            ("03", "질문을 바꿔보세요", "요즘 자꾸 찾아보는 건 뭐야?"),
            ("04", "한 번 더 묻기", "친구들이 너에게 자주 부탁하는 건 뭐야?"),
            ("05", "여기서 보이는 것", "흥미, 역할, 강점의 단서가 나옵니다."),
            ("06", "오늘의 질문", "직업명 말고 경험부터 꺼내보세요."),
        ],
    },
    {
        "slug": "ai-class-check",
        "keyword": "AI",
        "title": "AI 교육은 도구 이름보다 아이가 질문을 만드는지가 먼저입니다",
        "source_name": "교육부 디지털 기반 교육혁신 / AI 디지털교과서 정책 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI 수업을 볼 때\n도구 이름부터 보면 놓치는 게 있습니다.",
        "body": [
            "AI 교육에서 중요한 것은 아이가 버튼을 많이 아는지가 아닙니다.",
            "질문을 직접 만들고, 답을 비교하고, 왜 그 답을 선택했는지 설명하는 과정이 있어야 합니다.",
            "부모님은 “무슨 앱을 쓰나요?”보다 “아이가 질문을 직접 만들어보나요?”, “AI 답을 그대로 믿지 않고 비교하나요?”를 먼저 확인해보시면 좋습니다.",
        ],
        "slides": [
            ("01", "AI 수업 체크", "도구 이름보다 먼저 볼 것이 있습니다."),
            ("02", "버튼을 아는 것", "생각하는 힘과 같지는 않습니다."),
            ("03", "좋은 수업의 장면", "아이가 질문을 직접 만들어봅니다."),
            ("04", "다음 장면", "AI 답을 비교하고 고쳐봅니다."),
            ("05", "마지막 장면", "왜 그렇게 판단했는지 자기 말로 설명합니다."),
            ("06", "오늘의 질문", "이 수업은 아이에게 어떤 질문을 만들게 하나요?"),
        ],
    },
]


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def pick_topic(date_text: str, slot: str) -> dict:
    seed = int(date_text.replace("-", "")) + (0 if slot == "lunch" else 1)
    return TOPICS[seed % len(TOPICS)]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothicBold.ttf" if bold else "C:/Windows/Fonts/NanumGothic.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def wrap_by_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw in text.split("\n"):
        if not raw:
            lines.append("")
            continue
        line = ""
        for ch in raw:
            trial = line + ch
            if draw.textlength(trial, font=fnt) <= max_width:
                line = trial
            else:
                if line:
                    lines.append(line)
                line = ch
        if line:
            lines.append(line)
    return lines


def draw_multiline(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt: ImageFont.ImageFont, fill: str, max_width: int, line_gap: int = 14) -> int:
    x, y = xy
    for line in wrap_by_width(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        bbox = draw.textbbox((x, y), line or "가", font=fnt)
        y += (bbox[3] - bbox[1]) + line_gap
    return y


def make_card(out: Path, topic: dict, index: int, total: int, label: str, heading: str, body: str) -> None:
    img = Image.new("RGB", (1080, 1080), "#f7f7f4")
    draw = ImageDraw.Draw(img)

    accent = "#7B6CFF"
    black = "#161616"
    gray = "#6f7378"
    soft = "#e8e5ff"

    draw.rounded_rectangle((56, 52, 250, 98), radius=22, fill=soft)
    draw.text((82, 66), "JAYSSAM", font=font(25, True), fill=accent)
    draw.text((960, 64), f"{index}/{total}", font=font(28, True), fill=gray)
    draw.text((72, 156), label, font=font(34, True), fill=accent)

    y = draw_multiline(draw, (72, 230), heading, font(76, True), black, 880, 18)
    draw.rounded_rectangle((72, y + 32, 1008, y + 42), radius=5, fill=accent)
    draw_multiline(draw, (72, y + 92), body, font(38, False), black, 880, 18)

    draw.rounded_rectangle((72, 915, 1008, 1000), radius=26, fill="#ffffff", outline="#dedede", width=2)
    footer = topic["source_name"]
    draw_multiline(draw, (105, 940), footer, font(25, False), gray, 800, 8)
    img.save(out)


def generate_cards(topic: dict, date_text: str, slot: str) -> tuple[Path, list[str]]:
    card_dir = CARD_ROOT / date_text / slot / topic["slug"]
    card_dir.mkdir(parents=True, exist_ok=True)
    paths: list[str] = []
    for index, (label, heading, body) in enumerate(topic["slides"], start=1):
        out = card_dir / f"card_{index:02d}.png"
        make_card(out, topic, index, len(topic["slides"]), label, heading, body)
        paths.append(str(out.relative_to(ROOT)).replace("\\", "/"))
    return card_dir, paths


def write_draft(topic: dict, date_text: str, slot: str, card_dir: Path, media_paths: list[str]) -> Path:
    draft_id = f"GHA-{date_text.replace('-', '')}-{slot}-{topic['slug']}"
    out_dir = OUT_ROOT / date_text
    out_dir.mkdir(parents=True, exist_ok=True)

    threads_text = "\n\n".join(
        [
            topic["hook"],
            *topic["body"],
            f"출처는 {topic['source_name']} 흐름을 기준으로 확인했습니다.",
        ]
    )

    draft = {
        "id": draft_id,
        "date": date_text,
        "slot": slot,
        "account": os.environ.get("THREADS_USER_ID", ""),
        "status": "approved",
        "pillar": topic["keyword"],
        "keyword": topic["keyword"],
        "title": topic["title"],
        "topic": topic["title"],
        "threads_text": threads_text,
        "carousel_slides": [f"{h}\n{b}" for _, h, b in topic["slides"]],
        "local_card_dir": str(card_dir.relative_to(ROOT)).replace("\\", "/"),
        "local_media_paths": media_paths,
        "source_urls": topic["source_urls"],
        "source_note": topic["source_name"],
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
    }

    draft_path = out_dir / f"{draft_id}.json"
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(str(draft_path).replace("\\", "/"), encoding="utf-8")
    return draft_path


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (os.sys.argv[1] if len(os.sys.argv) > 1 else kst_today())
    slot = os.environ.get("JAYSSAM_SLOT") or (os.sys.argv[2] if len(os.sys.argv) > 2 else "lunch")
    topic = pick_topic(date_text, slot)
    card_dir, media_paths = generate_cards(topic, date_text, slot)
    draft_path = write_draft(topic, date_text, slot, card_dir, media_paths)
    print(draft_path)


if __name__ == "__main__":
    main()
