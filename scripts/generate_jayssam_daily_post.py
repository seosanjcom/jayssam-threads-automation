#!/usr/bin/env python3

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path.cwd()
OUT_ROOT = ROOT / "outputs" / "automation"
PUBLISH_LOG = ROOT / "outputs" / "meta-publish-log.json"
KST = timezone(timedelta(hours=9))
RECENT_DEDUPE_DAYS = 21

# 제이쌤은 교육 뉴스 요약 계정이 아니라, 성인 수강생과 교육 사업 현장에서 본 장면을
# 짧게 기록하는 계정이다. 아동·학부모 중심 소재와 설명형 조언은 사용하지 않는다.
OBSERVATION_SEEDS = [
    ("adult_rebuilt_first_project", "첫 결과물을 다시 엎은 수강생", "오늘 한 수강생이 며칠 붙잡은 첫 결과물을 처음부터 다시 만들었다.\n\n나는 아깝지 않냐고 물었는데, 본인은 이제야 왜 안 됐는지 알겠다고 했다.\n\n가끔은 완성보다 다시 시작할 이유가 생긴 쪽이 더 크게 남는다."),
    ("quiet_learner_explained", "말수 적던 수강생이 자기 코드를 풀어낸 날", "평소에 질문이 많지 않던 수강생이 오늘은 자기 코드 흐름을 차근차근 설명했다.\n\n중간에 막힌 곳도 있었지만, 왜 그렇게 짰는지는 분명했다.\n\n나는 그 설명이 나오면 속도보다 방향을 먼저 믿게 된다."),
    ("waited_before_answer", "바로 답을 보여주지 않은 수업", "오늘은 막힌 수강생에게 정답 화면을 바로 열지 않았다.\n\n조금 돌아가더니 결국 자기 손으로 원인을 찾았다.\n\n가르치는 쪽이 할 일을 줄이는 순간이, 배우는 사람에게는 오래 남기도 한다."),
    ("after_work_arrival", "퇴근 뒤에도 노트북을 연 이유", "오늘 수업에는 퇴근하고 바로 온 수강생이 있었다.\n\n피곤해 보였는데도 지난 시간에 막힌 부분부터 다시 열었다.\n\n시간이 없다는 말보다, 남은 시간으로 뭘 하는지가 더 선명하게 보이는 날이 있다."),
    ("small_bug_breakthrough", "작은 오류 하나를 넘긴 날", "오늘 가장 환하게 웃은 사람은 어려운 기능을 만든 수강생이 아니었다.\n\n한참 붙잡던 오류 하나를 직접 고친 수강생이었다.\n\n작은 문제라도 끝까지 닫아본 경험은 다음 문제 앞에서 사람을 덜 흔들리게 한다."),
    ("curriculum_real_question", "커리큘럼보다 먼저 듣는 질문", "상담할 때 커리큘럼은 늘 설명한다.\n\n그런데 내가 먼저 듣고 싶은 건, 이 사람이 지금 자기 일에서 어디가 가장 답답한지다.\n\n기술 이름보다 해결하고 싶은 장면이 선명할 때 수업도 훨씬 빨리 살아난다."),
    ("adult_class_silence", "성인 수업이 조용해지는 순간", "성인 수업은 가끔 유난히 조용해진다.\n\n누가 시켜서가 아니라 각자 자기 화면의 문제를 붙잡고 있을 때다.\n\n그 조용함은 내게 수업이 멈춘 신호가 아니라, 각자 일이 시작된 신호에 가깝다."),
    ("first_practical_question", "첫 질문이 바뀌는 순간", "처음에는 ‘이걸 왜 배워야 해요?’라고 묻던 수강생이 있었다.\n\n오늘은 ‘그럼 제 업무에는 어디부터 붙여보면 될까요?’라고 물었다.\n\n배움이 자기 일과 닿는 순간, 질문의 결이 달라진다."),
    ("business_returning_learners", "다시 찾아오는 수강생을 볼 때", "교육 일을 오래 할수록 한 번에 크게 반응하는 수업보다, 몇 달 뒤 다시 연락 오는 수강생을 더 보게 된다.\n\n지난번에 만든 걸 자기 일에 붙여봤다는 말.\n\n그런 소식이 오면 수업은 이미 밖에서 이어지고 있다고 생각한다."),
    ("career_switcher_doubt", "경력 전환 앞에서 오래 멈춘 질문", "오늘 상담에서 한 수강생이 지금 시작해도 늦지 않겠냐고 물었다.\n\n나는 쉽게 괜찮다고 말하지 않는다.\n\n대신 지금까지 해온 일 중에 새 기술과 연결할 수 있는 조각부터 같이 찾는다. 전환은 지우는 일보다 이어 붙이는 일에 가깝다."),
    ("plan_changed_by_question", "계획보다 질문이 길어진 날", "오늘은 준비한 진도보다 질문 하나에 더 오래 머물렀다.\n\n처음 계획과는 달랐지만, 그 질문을 넘기면 다음 내용도 남지 않을 것 같았다.\n\n수업도 사업도 계획을 지키는 것보다, 어디에서 멈춰야 하는지 아는 쪽이 더 어렵다."),
    ("peer_explains_workflow", "수강생끼리 작업 흐름을 나눈 날", "오늘은 내가 설명하기 전에 한 수강생이 옆자리 사람에게 자기 작업 순서를 보여줬다.\n\n완벽한 답은 아니어도 실제로 해본 사람의 말에는 다른 힘이 있다.\n\n아는 건 혼자 이해한 순간보다, 내 방식으로 건넬 수 있을 때 더 또렷해진다."),
    ("late_question_after_class", "수업이 끝난 뒤 나온 현실적인 질문", "수업이 끝난 뒤 한 수강생이 다시 와서 물었다.\n\n‘이걸 제 업무에 쓰려면, 내일 뭘 먼저 해보면 될까요?’\n\n그 질문은 늘 좋다. 배운 내용이 화면 안에만 남지 않겠다는 뜻이니까."),
    ("tool_vs_problem", "도구가 바뀌어도 남는 것", "새 도구는 계속 나온다.\n\n그래도 일이 꼬였을 때 문제를 작게 나눠보는 습관은 쉽게 바뀌지 않는다.\n\n나는 그래서 유행하는 기능보다, 이 사람이 막힌 자리에서 어떻게 다시 시작하는지를 더 본다."),
    ("career_before_job_title", "직업 이름보다 먼저 보는 것", "진로 상담을 하면 직업 이름부터 정리하고 싶어질 때가 있다.\n\n그런데 나는 오래 붙잡는 일, 자꾸 손이 가는 일, 주변에서 자주 부탁하는 일을 먼저 듣는다.\n\n이름은 나중에 붙여도 늦지 않다."),
    ("instructor_steps_back", "강사가 한 걸음 물러난 날", "수업이 잘 풀리면 강사는 더 많이 알려주고 싶어진다.\n\n나는 그럴 때 조금 멈춘다.\n\n내가 다 해주면 당장은 편하지만, 수강생이 자기 방식으로 해결할 기회는 사라진다."),
    ("portfolio_revision_trace", "포트폴리오에서 먼저 보는 흔적", "완성도 높은 포트폴리오도 좋다.\n\n그런데 나는 중간에 고친 흔적이 남은 작업을 더 오래 본다.\n\n그 안에는 이 사람이 어떤 문제를 피하지 않았는지가 들어 있기 때문이다."),
    ("class_size_observation", "수업 인원을 쉽게 늘리지 않는 이유", "가끔은 수업 인원을 더 늘릴 수도 있다.\n\n그래도 한 사람의 표정과 질문이 흐려질 정도까지는 가고 싶지 않다.\n\n교육은 규모가 커지기 전에 관찰이 먼저 무너지기 쉽다."),
    ("making_with_standard", "빨리 끝낸 작업보다", "빨리 끝낸 작업은 눈에 잘 띈다.\n\n그런데 오래 가는 사람은 한 번 더 고치고, 다시 보고, 자기 기준을 만드는 경우가 많았다.\n\n속도는 칭찬받을 수 있지만 기준은 다음 작업까지 따라간다."),
    ("resume_question", "이력서보다 먼저 묻는 것", "경력 전환을 준비하는 수강생에게 이력서보다 먼저 묻는 게 있다.\n\n‘최근에 시간 가는 줄 모르고 붙잡았던 일이 뭐였어요?’\n\n그 답 안에 다음 방향의 실마리가 의외로 자주 있다."),
    ("business_consistent_standard", "교육 사업에서 지키는 기준", "교육 사업은 빨리 커지는 방법보다, 다음 달에도 같은 말을 할 수 있는지가 더 중요하다.\n\n수강생 앞에서 바뀌지 않을 기준이 있어야 한다.\n\n나는 그 기준을 오래 쌓는 쪽을 택하고 싶다."),
]

ANGLES = [
    ("afternoon", "수업 현장 메모"),
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
    angle_label = dict(ANGLES).get("night" if slot == "night" else "afternoon", "수업 현장 메모")
    candidates = [
        {
            "content_id": content_id_for(seed_id, slot),
            "seed_id": seed_id,
            "title": title,
            "text": text,
            "angle": angle_label,
            "pillar": "education_business_judgment" if seed_id in {"business_returning_learners", "class_size_observation", "business_consistent_standard"} else "adult_learner_observation",
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
        "source_note": "제이쌤의 성인 수강생·진로 전환·교육사업 운영 관찰",
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "editorial_rules": {
            "voice": "성인 교육 현장을 오래 본 교육자의 실제 관찰과 여유 있는 판단",
            "avoid": ["아동·학부모 소재", "뉴스 요약", "정답 제시", "AI 설명체", "억지 CTA"],
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
