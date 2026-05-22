from __future__ import annotations

import json
import os
import subprocess
import textwrap
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote

from PIL import Image, ImageDraw, ImageFont


ROOT = Path.cwd()
OUT_ROOT = ROOT / "outputs" / "automation"
CARD_ROOT = ROOT / "outputs" / "cards" / "github-daily"
KST = timezone(timedelta(hours=9))
KOREA_POLICY_MOE_RSS = "https://www.korea.kr/rss/dept_moe.xml"
ISSUE_KEYWORDS = ("AI", "디지털", "정보", "진로", "교육과정", "학교", "학생", "교사", "미래교육")
PUBLISH_LOG = ROOT / "outputs" / "meta-publish-log.json"
RECENT_DEDUPE_DAYS = 7
LEGACY_SLUG_ALIASES = {
    "READY-20260520-career-dream-no-panic": "career-no-dream",
    "READY-20260521-informatics-hours-why": "info-hours",
}


TOPICS = [
    {
        "slug": "info-hours",
        "keyword": "정보교과",
        "title": "정보 수업 시간이 늘어난 이유는 코딩만 더 하자는 뜻이 아닙니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": [
            "https://www.moe.go.kr/",
            "https://www.korea.kr/news/policyNewsView.do?newsId=148905079",
        ],
        "hook": "정보 수업 시간이 늘어난 이유,\n코딩 문법 때문만은 아닙니다.",
        "body": [
            "2022 개정 교육과정 흐름에서 정보교육은 초중등 단계에서 더 중요하게 다뤄지고 있습니다.",
            "핵심은 아이에게 코딩 문법을 빨리 외우게 하는 것이 아니라, 데이터를 읽고 문제를 나누고 절차를 설계하는 힘을 기르는 쪽에 가깝습니다.",
            "부모님은 학원 이름보다 아이가 수업에서 문제를 어떻게 설명하는지, 오류를 어떻게 고치는지, 결과를 어떤 말로 정리하는지를 먼저 보셔도 좋습니다.",
        ],
        "slides": [
            ("01", "정보 시간이 늘어난 이유", "코딩만 더 하자는 뜻이 아닙니다."),
            ("02", "학교가 보려는 힘", "문제를 작게 나누고, 절차로 설명하고, 자료를 근거로 판단하는 힘입니다."),
            ("03", "부모님이 볼 지점", "아이가 결과보다 과정을 자기 말로 설명하는지 보세요."),
            ("04", "수업에서 중요한 장면", "정답 코드를 받는 순간보다 오류를 찾고 고치는 순간입니다."),
            ("05", "강사가 볼 지점", "정답보다 질문을 남기는 수업인지 확인해야 합니다."),
            ("06", "오늘의 한 문장", "코딩교육은 화면 앞에 앉히는 일이 아니라 생각을 구조화하는 연습입니다."),
        ],
    },
    {
        "slug": "career-no-dream",
        "keyword": "진로",
        "title": "꿈이 없다는 아이의 대답에 바로 불안해하지 않으셔도 됩니다",
        "source_name": "커리어넷 진로교육 자료 흐름 / 현장 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "“꿈이 없어요.”\n이 대답에 바로 불안해하지 않으셔도 됩니다.",
        "body": [
            "요즘 진로는 직업명 하나를 일찍 정하는 방식으로 보기 어렵습니다.",
            "먼저 봐야 할 것은 아이가 반복해서 고르는 경험, 오래 붙잡는 문제, 주변에서 자주 맡는 역할입니다.",
            "직업명을 묻기 전에 “요즘 네가 자꾸 찾아보는 건 뭐야?”, “친구들이 너에게 자주 부탁하는 건 뭐야?”처럼 경험을 꺼내는 질문이 더 도움이 됩니다.",
        ],
        "slides": [
            ("01", "꿈이 없다는 말", "진로가 없다는 뜻으로 바로 보지 마세요."),
            ("02", "직업명보다 먼저", "아이가 반복해서 고르는 경험을 봅니다."),
            ("03", "질문을 바꿔보세요", "요즘 자꾸 찾아보는 건 뭐야?"),
            ("04", "두 번째 질문", "친구들이 너에게 자주 부탁하는 건 뭐야?"),
            ("05", "여기서 보이는 것", "흥미, 역할, 강점의 단서가 나옵니다."),
            ("06", "오늘의 한 문장", "진로는 직업명보다 경험의 패턴에서 먼저 시작됩니다."),
        ],
    },
    {
        "slug": "ai-class-check",
        "keyword": "AI",
        "title": "AI 수업은 도구 이름보다 질문을 만드는 과정이 먼저입니다",
        "source_name": "교육부 디지털 기반 교육혁신 방향 / AI 디지털교과서 정책 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI 수업을 볼 때,\n도구 이름부터 보면 놓치는 게 있습니다.",
        "body": [
            "AI 교육에서 중요한 것은 아이가 버튼을 많이 아는지가 아닙니다.",
            "질문을 직접 만들고, 답을 비교하고, 왜 그 답을 선택했는지 설명하는 과정이 있어야 합니다.",
            "부모님은 “무슨 툴을 배웠어?”보다 “네가 질문을 직접 만들어봤어?”, “AI 답을 그대로 믿지 않고 비교해봤어?”라고 물어보시면 좋습니다.",
        ],
        "slides": [
            ("01", "AI 수업 체크", "도구 이름보다 먼저 볼 것이 있습니다."),
            ("02", "버튼을 아는 것", "생각하는 힘과 같지 않습니다."),
            ("03", "좋은 수업이라면", "아이가 질문을 직접 만들어봅니다."),
            ("04", "다음 장면", "AI 답을 비교하고 고쳐봅니다."),
            ("05", "마지막 장면", "왜 그렇게 판단했는지 자기 말로 설명합니다."),
            ("06", "오늘의 한 문장", "AI를 쓰는 수업보다 AI로 생각을 점검하는 수업이 더 중요합니다."),
        ],
    },
    {
        "slug": "digital-literacy",
        "keyword": "디지털문해력",
        "title": "아이에게 필요한 건 검색 실력보다 판단하는 힘입니다",
        "source_name": "디지털 소양 교육 방향 / 학교 현장 미디어 리터러시 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "검색을 잘하는 아이와\n판단을 잘하는 아이는 다릅니다.",
        "body": [
            "AI와 검색 도구가 쉬워질수록 아이들은 더 많은 답을 빠르게 만납니다.",
            "그래서 이제 중요한 질문은 “찾았니?”가 아니라 “왜 이 답을 믿었니?”에 가깝습니다.",
            "자료의 출처, 작성 시점, 다른 관점의 자료가 있는지를 확인하는 습관이 디지털 시대의 기본 공부가 됩니다.",
        ],
        "slides": [
            ("01", "검색보다 중요한 것", "답을 찾는 속도보다 판단의 근거입니다."),
            ("02", "아이에게 물어볼 질문", "이 자료는 어디에서 나온 거야?"),
            ("03", "두 번째 질문", "언제 작성된 자료야?"),
            ("04", "세 번째 질문", "다른 설명을 하는 자료도 있었어?"),
            ("05", "여기서 생기는 힘", "정보를 고르고 비교하고 책임 있게 쓰는 힘입니다."),
            ("06", "오늘의 한 문장", "디지털 문해력은 많이 찾는 능력이 아니라 덜 속는 능력입니다."),
        ],
    },
]


PRACTICAL_ANGLES = {
    "info-hours": {
        "benefit": "정보교과 시간이 왜 늘었는지 알면, 아이 수업을 볼 때 ‘코딩을 얼마나 했나’보다 ‘문제를 어떻게 쪼개서 설명했나’를 먼저 볼 수 있습니다.",
        "mistake": "초반에 문법 진도만 빠른 수업은 그럴듯해 보여도, 아이가 혼자 문제를 해석하는 힘은 늦게 자랄 수 있습니다.",
        "check": "수업 후에는 “오늘 만든 것 설명해봐”보다 “어디서 막혔고 어떻게 고쳤어?”라고 물어보세요.",
        "use_for": "학부모에게는 수업 선택 기준, 강사에게는 수업 마무리 질문으로 바로 쓸 수 있습니다.",
    },
    "career-no-dream": {
        "benefit": "이 관점을 알면 아이가 “꿈이 없어요”라고 말해도 바로 학원, 검사, 직업명 찾기로 몰아가지 않을 수 있습니다.",
        "mistake": "진로를 너무 빨리 직업명으로 고정하면 아이가 잘하는 행동의 패턴을 놓치기 쉽습니다.",
        "check": "이번 주 아이가 오래 붙잡은 것, 반복해서 찾아본 것, 친구들이 자주 부탁한 일을 3개만 적어보세요.",
        "use_for": "상담 전 부모 질문지로도 좋고, 진로 수업 도입 활동으로도 바로 쓸 수 있습니다.",
    },
    "ai-class-check": {
        "benefit": "AI 수업을 볼 때 이 기준을 알면 화려한 도구 이름에 덜 흔들리고, 진짜 배움이 있는 수업인지 구분할 수 있습니다.",
        "mistake": "툴 사용법만 따라 하는 수업은 결과물이 빨리 나오지만, 아이가 판단한 흔적은 남지 않을 수 있습니다.",
        "check": "좋은 AI 수업에는 질문 만들기, 답 비교하기, 근거 말하기가 최소 한 번씩 들어갑니다.",
        "use_for": "학부모는 수업 상담 때 물어볼 질문으로, 강사는 차시 설계 기준으로 쓸 수 있습니다.",
    },
    "digital-literacy": {
        "benefit": "이걸 알면 아이가 검색이나 AI 답을 가져왔을 때, 맞다 틀리다보다 먼저 확인해야 할 기준이 보입니다.",
        "mistake": "자료를 많이 찾는 아이가 곧 정보를 잘 다루는 아이는 아닙니다. 핵심은 출처와 근거를 따지는 힘입니다.",
        "check": "아이에게 딱 세 가지만 물어보세요. “어디서 나온 자료야?”, “언제 나온 자료야?”, “다른 설명도 있었어?”",
        "use_for": "숙제, 발표, 탐구보고서, AI 활용 과제에서 바로 써먹을 수 있는 확인 질문입니다.",
    },
}


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def pick_topic(date_text: str, slot: str) -> dict:
    seed_offsets = {
        "lunch": 0,
        "afternoon": 0,
        "evening": 1,
        "night": 1,
    }
    seed = int(date_text.replace("-", "")) + seed_offsets.get(slot, 0)
    recent_slugs = recent_published_slugs(date_text)
    for offset in range(len(TOPICS)):
        topic = TOPICS[(seed + offset) % len(TOPICS)]
        if topic["slug"] not in recent_slugs:
            return topic
    return TOPICS[seed % len(TOPICS)]


def recent_published_slugs(date_text: str) -> set[str]:
    log = read_json(PUBLISH_LOG, [])
    if not isinstance(log, list):
        return set()

    try:
        target_date = datetime.fromisoformat(date_text).date()
    except ValueError:
        target_date = datetime.now(KST).date()

    recent: set[str] = set()
    topic_slugs = {topic["slug"] for topic in TOPICS}

    for item in log:
        if not isinstance(item, dict):
            continue
        if item.get("status") == "deleted_after_mojibake_publish":
            continue
        published_at = str(item.get("published_at") or "")
        try:
            published_date = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone(KST).date()
        except ValueError:
            published_date = target_date
        if not (timedelta(days=0) <= target_date - published_date <= timedelta(days=RECENT_DEDUPE_DAYS)):
            continue

        draft_id = str(item.get("draft_id") or "")
        slug = LEGACY_SLUG_ALIASES.get(draft_id)
        if not slug:
            slug = next((candidate for candidate in topic_slugs if candidate in draft_id), "")
        if slug:
            recent.add(slug)
    return recent


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def fetch_latest_signal() -> dict | None:
    query = quote("교육부 AI 교육 정보교육 진로교육 when:14d")
    sources = [
        ("대한민국 정책브리핑 교육부 RSS", KOREA_POLICY_MOE_RSS),
        ("Google News 교육 이슈 RSS", f"https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko"),
    ]
    for source_name, source_url in sources:
        signal = fetch_rss_signal(source_name, source_url)
        if signal:
            return signal
    return None


def fetch_rss_signal(source_name: str, source_url: str) -> dict | None:
    try:
        req = urllib.request.Request(
            source_url,
            headers={"User-Agent": "Mozilla/5.0 jayssam-threads-automation/1.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            xml_text = response.read().decode("utf-8", errors="replace")
    except Exception:
        try:
            completed = subprocess.run(
                ["curl", "-L", "-A", "Mozilla/5.0", "--max-time", "10", source_url],
                check=True,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            xml_text = completed.stdout
        except Exception:
            return None

    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return None

    items = root.findall(".//item")
    for item in items[:12]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        if is_recent_pub_date(pub_date) and any(keyword.lower() in title.lower() for keyword in ISSUE_KEYWORDS):
            return {"title": title, "link": link, "pub_date": pub_date, "source": source_name}
    recent_items = [item for item in items if is_recent_pub_date((item.findtext("pubDate") or "").strip())]
    if recent_items:
        item = recent_items[0]
        return {
            "title": (item.findtext("title") or "").strip(),
            "link": (item.findtext("link") or "").strip(),
            "pub_date": (item.findtext("pubDate") or "").strip(),
            "source": source_name,
        }
    return None


def is_recent_pub_date(pub_date: str, days: int = 14) -> bool:
    if not pub_date:
        return False
    try:
        published = parsedate_to_datetime(pub_date)
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return now - timedelta(days=days) <= published <= now + timedelta(days=1)
    except Exception:
        return False


def first_item_signal(items: list[ET.Element], source_name: str) -> dict | None:
    if items:
        item = items[0]
        return {
            "title": (item.findtext("title") or "").strip(),
            "link": (item.findtext("link") or "").strip(),
            "pub_date": (item.findtext("pubDate") or "").strip(),
            "source": source_name,
        }
    return None


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" if bold else "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/NanumGothicBold.ttf" if bold else "C:/Windows/Fonts/NanumGothic.ttf",
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf",
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
                continue
            if line:
                lines.append(line)
            line = ch
        if line:
            lines.append(line)
    return lines


def draw_multiline(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.ImageFont,
    fill: str,
    max_width: int,
    line_gap: int = 14,
    align: str = "left",
) -> int:
    x, y = xy
    for line in wrap_by_width(draw, text, fnt, max_width):
        bbox = draw.textbbox((0, 0), line or "가", font=fnt)
        width = bbox[2] - bbox[0]
        tx = x if align == "left" else x + (max_width - width) // 2
        draw.text((tx, y), line, font=fnt, fill=fill)
        y += (bbox[3] - bbox[1]) + line_gap
    return y


def draw_card_background(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, 1080, 1080), fill="#f7f7f4")
    draw.rounded_rectangle((44, 44, 1036, 1036), radius=34, fill="#ffffff")
    draw.rectangle((44, 44, 1036, 136), fill="#edf0f4")
    draw.ellipse((82, 78, 102, 98), fill="#7B6CFF")
    draw.ellipse((112, 78, 132, 98), fill="#55B86B")
    draw.ellipse((142, 78, 162, 98), fill="#FFBC42")
    draw.rounded_rectangle((190, 72, 860, 104), radius=16, fill="#ffffff")
    draw.text((218, 78), "www.jayssam-edu.kr / insight", font=font(21, False), fill="#a0a5ad")


def make_card(out: Path, topic: dict, index: int, total: int, label: str, heading: str, body: str) -> None:
    img = Image.new("RGB", (1080, 1080), "#f7f7f4")
    draw = ImageDraw.Draw(img)

    accent = "#7B6CFF"
    black = "#161616"
    gray = "#6f7378"
    soft = "#eeeaff"

    draw_card_background(draw)
    draw.text((82, 174), f"Chapter {label}.", font=font(32, True), fill=accent)
    draw.text((944, 172), f"{index}/{total}", font=font(28, True), fill="#9aa0a6")

    heading_font = font(68 if len(heading) < 24 else 58, True)
    y = draw_multiline(draw, (82, 292), heading, heading_font, black, 884, 16)

    y += 30
    draw.rounded_rectangle((82, y, 998, y + 3), radius=2, fill="#e4e6ea")
    y += 58

    body_font = font(38 if len(body) < 50 else 34, False)
    draw_multiline(draw, (92, y), body, body_font, black, 860, 18, align="left")

    if index in {2, 3, 4}:
        draw.rounded_rectangle((86, 858, 994, 930), radius=20, fill=soft)
        draw.text((122, 876), "부모님 질문으로 바꾸면 더 잘 보입니다.", font=font(31, True), fill=accent)

    draw.text((82, 980), "JAYSSAM FUTURE EDUCATION", font=font(24, True), fill="#a0a5ad")
    draw.text((650, 980), f"{topic['keyword']} / source checked", font=font(22, False), fill="#a0a5ad")
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

    latest_signal = fetch_latest_signal()
    angle = PRACTICAL_ANGLES.get(topic["slug"], {})
    content_type = content_type_for_slot(slot)
    text_parts = build_threads_text_parts(topic, angle, latest_signal, content_type)
    text_parts.append(f"출처는 {topic['source_name']}을 기준으로 확인했습니다.")
    threads_text = "\n\n".join(text_parts)

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
        "content_type": content_type,
        "practical_angle": angle,
        "threads_text": threads_text,
        "carousel_slides": [f"{h}\n{b}" for _, h, b in topic["slides"]],
        "local_card_dir": str(card_dir.relative_to(ROOT)).replace("\\", "/"),
        "local_media_paths": media_paths,
        "source_urls": [*topic["source_urls"], *([latest_signal["link"]] if latest_signal and latest_signal.get("link") else [])],
        "source_note": topic["source_name"],
        "latest_signal": latest_signal,
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
    }

    draft_path = out_dir / f"{draft_id}.json"
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(str(draft_path).replace("\\", "/"), encoding="utf-8")
    return draft_path


def content_type_for_slot(slot: str) -> str:
    if slot == "night":
        return "must_know_practical_tip"
    return "education_news_interpretation"


def build_threads_text_parts(topic: dict, angle: dict, latest_signal: dict | None, content_type: str) -> list[str]:
    if content_type == "education_news_interpretation":
        if latest_signal:
            return [
                f"오늘 교육 이슈 하나,\n그냥 뉴스로 넘기기엔 아깝습니다.",
                f"“{latest_signal['title']}”",
                "중요한 건 이 소식 자체보다, 이 흐름이 아이 교육 기준을 어떻게 바꾸는지입니다.",
                angle.get("benefit", ""),
                angle.get("check", ""),
                "제이쌤 관점에서는 뉴스보다 ‘부모님이 내일 바로 물어볼 질문’이 더 중요합니다.",
            ]
        return [
            topic["hook"],
            "오늘은 새 이슈를 억지로 붙이기보다, 부모님과 강사가 바로 판단에 쓸 기준을 정리합니다.",
            angle.get("benefit", ""),
            angle.get("check", ""),
        ]

    return [
        topic["hook"],
        "이건 그냥 알아두면 좋은 정보가 아니라, 상담이나 수업을 고를 때 기준이 되는 내용입니다.",
        angle.get("benefit", ""),
        angle.get("mistake", ""),
        angle.get("check", ""),
        angle.get("use_for", ""),
    ]


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (os.sys.argv[1] if len(os.sys.argv) > 1 else kst_today())
    slot = os.environ.get("JAYSSAM_SLOT") or (os.sys.argv[2] if len(os.sys.argv) > 2 else "afternoon")
    topic = pick_topic(date_text, slot)
    card_dir, media_paths = generate_cards(topic, date_text, slot)
    draft_path = write_draft(topic, date_text, slot, card_dir, media_paths)
    print(draft_path)


if __name__ == "__main__":
    main()
