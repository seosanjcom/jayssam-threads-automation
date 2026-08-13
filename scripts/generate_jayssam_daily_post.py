from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path.cwd()
OUT_ROOT = ROOT / "outputs" / "automation"
PUBLISH_LOG = ROOT / "outputs" / "meta-publish-log.json"
KST = timezone(timedelta(hours=9))
RECENT_DEDUPE_DAYS = 21

# 제이쌤은 교육 뉴스 요약 계정이 아니라, 수업과 교육 사업을 오래 운영한 사람이
# 그날의 장면에서 든 생각을 기록하는 계정이다. 한 소재를 설명형으로 풀지 않는다.
OBSERVATION_SEEDS = [
    ("student_deleted_first_build", "첫 결과물을 지우고 다시 시작한 아이", "오늘 한 아이가 자기가 만든 걸 다 지우고 처음부터 다시 했다.\n\n나는 그게 아까웠는데, 아이는 ‘이게 더 내가 만든 것 같아요’라고 했다.\n\n코딩에서 실력이 늘었다는 건 완성한 파일 개수보다, 자기 기준이 생긴 순간에 더 가까운 것 같다."),
    ("quiet_child_explained", "조용한 아이가 자기 코드를 설명하던 날", "평소엔 말이 거의 없는 아이가 오늘은 자기 코드 앞에서 5분을 넘게 설명했다.\n\n틀린 부분도 있었는데, 왜 그렇게 만들었는지는 아주 분명했다.\n\n나는 그런 설명을 들으면 결과물보다 먼저 안심하게 된다."),
    ("teacher_waited", "바로 답을 안 알려준 수업", "오늘은 아이가 막혔을 때 답을 조금 늦게 알려줬다.\n\n그 사이에 표정은 몇 번 바뀌었는데, 결국 자기가 찾았다.\n\n선생님이 일을 잘하는 날은 말을 많이 한 날이 아니라, 필요한 만큼만 기다린 날일 때가 있다."),
    ("parent_result_question", "결과물부터 묻는 부모님", "상담 때 ‘이번 달엔 뭘 만들었어요?’라고 먼저 물어보는 부모님이 있다.\n\n나는 그 질문을 좋아한다.\n\n진도표보다 아이가 집에 와서 자기 말로 설명할 게 남았는지가 더 오래 간다."),
    ("small_bug_pride", "작은 오류를 고친 뒤의 표정", "오늘 제일 크게 웃은 아이는 어려운 기능을 만든 아이가 아니었다.\n\n자기가 한참 붙잡던 오류 하나를 고친 아이였다.\n\n문제 하나를 끝까지 붙잡아본 기억은 생각보다 오래 남는다."),
    ("curriculum_question", "커리큘럼보다 먼저 듣는 질문", "학원 상담에서 커리큘럼은 늘 설명한다.\n\n그런데 내가 더 궁금한 건, 아이가 이번 달에 뭘 자기 손으로 바꿔봤는지다.\n\n언어 이름이 많은 수업보다, 아이 목소리가 남는 수업이 더 좋은 수업이라고 생각한다."),
    ("classroom_silence", "교실이 조용해지는 순간", "수업하다가 교실이 유난히 조용해지는 순간이 있다.\n\n아이들이 어려워서가 아니라, 각자 자기 문제를 붙잡고 있을 때다.\n\n그 조용함은 나한테는 꽤 좋은 신호다."),
    ("first_question", "수업의 첫 질문", "수업 시작 전에 ‘오늘 뭘 배워요?’보다 ‘오늘 뭘 만들어봐요?’를 먼저 묻는 아이가 있다.\n\n그 질문 하나에 그 아이가 수업을 대하는 방식이 보인다.\n\n만드는 경험이 쌓이면 공부가 조금 덜 남의 일이 된다."),
    ("business_long_view", "교육 일을 오래 하며 생긴 기준", "교육 일을 오래 할수록 화려한 한 번보다, 다시 오는 아이를 더 보게 된다.\n\n다음 수업에 와서 지난번 걸 고쳐보고 싶다고 말하는 아이.\n\n그런 흐름이 생기면 수업은 이미 잘 가고 있다고 생각한다."),
    ("parent_hurry", "부모가 조금만 덜 급했으면 하는 날", "오늘 상담에서 아이보다 부모님이 더 빨리 답을 찾고 계셨다.\n\n그 마음은 이해한다.\n\n그래도 아이가 자기 속도로 좋아하는 걸 발견할 여지는 조금 남겨두면 좋겠다."),
    ("wrong_plan", "처음 계획이 틀렸던 날", "오늘 수업 계획이 생각보다 잘 안 맞았다.\n\n아이들이 예상보다 다른 데서 오래 멈췄다.\n\n그래서 계획을 바꿨고, 오히려 그 시간이 더 좋았다. 수업도 사업도 잘 짠 계획보다 잘 고치는 감각이 중요하다."),
    ("student_teaches_peer", "아이들이 서로 설명해줄 때", "오늘은 내가 설명하기 전에 아이 하나가 친구에게 먼저 알려줬다.\n\n말이 완벽하지 않아도 자기 방식으로 설명하는 모습이 좋았다.\n\n알았다는 건 정답을 맞힌 것보다, 누군가에게 자기 말로 꺼낼 수 있을 때 더 분명해진다."),
    ("school_after_class", "가방 멘 아이가 다시 돌아온 순간", "수업이 끝나고 가방을 멘 아이가 다시 돌아왔다.\n\n‘집에서도 이거 해봐도 돼요?’\n\n그 한마디를 들으면 오늘 수업은 괜찮았다고 생각한다. 배움은 교실 밖으로 조금 나가야 한다."),
    ("tool_vs_thinking", "도구가 바뀌어도 안 바뀌는 것", "새 도구는 계속 나온다.\n\n그런데 아이가 막혔을 때 문제를 작게 나눠보는 습관은 쉽게 안 바뀐다.\n\n나는 그래서 유행하는 도구보다, 그 아이가 어떤 방식으로 다시 시작하는지를 더 본다."),
    ("career_not_label", "직업 이름보다 먼저 보이는 것", "아이 진로를 이야기할 때 직업 이름부터 정리하고 싶어질 때가 있다.\n\n그런데 나는 오래 붙잡는 것, 자꾸 손이 가는 것, 친구가 부탁하는 걸 먼저 본다.\n\n이름은 나중에 붙어도 된다."),
    ("teacher_energy", "선생님이 너무 앞서가지 않는 법", "수업이 잘 풀리면 선생님은 더 많이 알려주고 싶어진다.\n\n나는 그럴 때 조금 멈춘다.\n\n아이 몫까지 다 해버리면, 아이가 자기 힘을 발견할 시간이 없어진다."),
    ("portfolio_real", "포트폴리오를 볼 때 드는 생각", "완성도 높은 포트폴리오도 좋다.\n\n그런데 나는 중간에 고친 흔적이 보이는 작업을 더 오래 본다.\n\n그 흔적 안에는 이 아이가 어떤 문제 앞에서 포기하지 않았는지가 들어 있기 때문이다."),
    ("class_size_choice", "수업 인원을 늘리지 않는 이유", "가끔은 수업 인원을 더 늘릴 수도 있다.\n\n그래도 아이 한 명이 멈췄을 때 표정을 볼 수 있는 정도는 남겨두고 싶다.\n\n교육은 규모보다 관찰이 먼저 무너지면 안 된다고 생각한다."),
    ("making_not_speed", "빨리 만드는 아이보다", "빨리 만드는 아이는 눈에 잘 띈다.\n\n그런데 나중에 더 멀리 가는 아이는 고치고, 다시 보고, 자기 기준을 만드는 아이인 경우가 많았다.\n\n속도는 박수 받을 수 있지만 기준은 오래 남는다."),
    ("parent_one_question", "부모님께 자주 드리는 한 가지 질문", "부모님께 자주 묻는다.\n\n‘요즘 아이가 안 되는데도 계속 붙잡는 게 있나요?’\n\n성적표에 없는 이야기가 거기서 많이 나온다. 교육은 그런 장면을 놓치지 않는 일에 가깝다."),
    ("business_no_shortcut", "교육 사업에서 지키는 원칙", "교육 사업은 빨리 커지는 방법보다, 다음 달에도 같은 말을 할 수 있는지가 더 중요하다.\n\n아이와 부모님 앞에서 흔들리지 않을 기준.\n\n나는 그걸 오래 쌓는 쪽을 택하고 싶다."),
]

ANGLES = [
    ("afternoon", "수업 뒤 메모"),
    ("night", "오늘 생각"),
]


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else fallback
    except Exception:
        return fallback


def content_id_for(seed_id: str, slot: str) -> str:
    return f"{seed_id}-{slot if slot in {'afternoon', 'night'} else 'afternoon'}"


def recent_content_ids(date_text: str) -> set[str]:
    target = datetime.fromisoformat(date_text).date()
    recent: set[str] = set()
    for item in read_json(PUBLISH_LOG, []):
        if not isinstance(item, dict) or str(item.get("status", "")).startswith("deleted_"):
            continue
        try:
            published = datetime.fromisoformat(str(item.get("published_at", "")).replace("Z", "+00:00")).astimezone(KST).date()
        except ValueError:
            continue
        if timedelta(days=0) <= target - published <= timedelta(days=RECENT_DEDUPE_DAYS):
            identity = str(item.get("content_id") or item.get("draft_id") or "")
            if identity:
                recent.add(identity)
    if OUT_ROOT.exists():
        for folder in OUT_ROOT.iterdir():
            if not folder.is_dir():
                continue
            try:
                scheduled = datetime.fromisoformat(folder.name).date()
            except ValueError:
                continue
            if not timedelta(days=0) < target - scheduled <= timedelta(days=RECENT_DEDUPE_DAYS):
                continue
            for draft_path in folder.glob("*.json"):
                draft = read_json(draft_path, {})
                if isinstance(draft, dict) and not str(draft.get("status", "")).startswith("deleted_"):
                    identity = str(draft.get("content_id") or draft.get("id") or "")
                    if identity:
                        recent.add(identity)
    return recent


def seed_id_from_identity(identity: str) -> str:
    value = str(identity or "")
    for seed_id, _, _ in OBSERVATION_SEEDS:
        if value == seed_id or value.startswith(f"{seed_id}-") or f"-{seed_id}-" in value:
            return seed_id
    return ""


def pick_topic(date_text: str, slot: str) -> dict:
    seed_number = int(date_text.replace("-", "")) + (1 if slot == "night" else 0)
    recent_seed_ids = {seed_id_from_identity(identity) for identity in recent_content_ids(date_text)} - {""}
    angle_label = dict(ANGLES).get("night" if slot == "night" else "afternoon", "수업 뒤 메모")
    candidates = [
        {
            "content_id": content_id_for(seed_id, slot),
            "seed_id": seed_id,
            "title": title,
            "text": text,
            "angle": angle_label,
            "pillar": "educator_observation" if seed_id not in {"business_long_view", "business_no_shortcut", "class_size_choice"} else "education_business_judgment",
        }
        for seed_id, title, text in OBSERVATION_SEEDS
    ]
    ordered = sorted(candidates, key=lambda item: item["seed_id"])
    rotated = ordered[seed_number % len(ordered):] + ordered[:seed_number % len(ordered)]
    for candidate in rotated:
        if candidate["seed_id"] not in recent_seed_ids:
            return candidate
    raise RuntimeError("최근 21일 안에 재사용하지 않을 제이쌤 관찰 소재가 부족합니다. 새 소재를 추가한 뒤 다시 실행하세요.")


def write_draft(topic: dict, date_text: str, slot: str) -> Path:
    out_dir = OUT_ROOT / date_text
    out_dir.mkdir(parents=True, exist_ok=True)
    draft_id = f"JAY-{date_text.replace('-', '')}-{slot}-{topic['content_id']}"
    draft_path = out_dir / f"{draft_id}.json"
    if draft_path.exists():
        existing = read_json(draft_path, {})
        if str(existing.get("status")) in {"approved", "published", "held", "publish_failed"}:
            (OUT_ROOT / "latest-draft-path.txt").write_text(f"{draft_path.as_posix()}\n", encoding="utf-8")
            return draft_path

    thread_text = topic["text"]
    if len(thread_text) > 480:
        thread_text = thread_text[:479].rstrip() + "…"
    draft = {
        "id": draft_id,
        "content_id": topic["content_id"],
        "date": date_text,
        "slot": slot,
        "account": os.environ.get("THREADS_USER_ID", ""),
        "status": "approved",
        "title": topic["title"],
        "topic": topic["title"],
        "pillar": topic["pillar"],
        "content_type": "educator_personal_note",
        "angle": topic["angle"],
        "threads_text": thread_text,
        "thread_comments": [],
        "local_media_paths": [],
        "source_urls": [],
        "source_note": "제이쌤 수업·상담·교육사업 운영 관찰",
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "editorial_rules": {
            "voice": "교육자의 실제 관찰과 여유 있는 판단",
            "avoid": ["뉴스 요약", "정답 제시", "AI 설명체", "억지 CTA"],
            "dedupe_days": RECENT_DEDUPE_DAYS,
        },
    }
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(f"{draft_path.as_posix()}\n", encoding="utf-8")
    return draft_path


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (os.sys.argv[1] if len(os.sys.argv) > 1 else kst_today())
    slot = os.environ.get("JAYSSAM_SLOT") or (os.sys.argv[2] if len(os.sys.argv) > 2 else "afternoon")
    print(write_draft(pick_topic(date_text, slot), date_text, slot))


if __name__ == "__main__":
    main()
