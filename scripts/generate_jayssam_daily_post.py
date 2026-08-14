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

# 제이쌤은 정보 전달 계정이 아니라, 성인 코딩 수업과 교육사업을 운영하며 마주친
# 장면·판단·수정의 기록을 남긴다. 21일 동안 하루 두 건을 발행하므로 42개보다 많은
# 소재를 둬서 같은 이야기가 돌아오지 않게 한다.
OBSERVATION_SEEDS = [
    ("screen_pause_before_commit", "저장 버튼 앞에서 멈춘 수강생", "오늘 저녁 수업에서 한 수강생이 저장 버튼 앞에서 한참 멈췄다.\n\n에러가 무서운 게 아니라, 자기 방식으로 한 번 더 손보고 싶다고 했다.\n\n그 말 듣고 나는 바로 답을 열던 습관을 또 줄여야겠다고 적어뒀다."),
    ("live_demo_trim", "시작 10분 전에 지운 데모", "오늘 수업 시작 10분 전에 준비한 데모 절반을 지웠다.\n\n기능 설명은 줄었는데 수강생 화면은 오히려 덜 멈췄다.\n\n다음 주도 이 정도만 가져가야겠다."),
    ("first_error_read", "에러 문장을 끝까지 읽은 날", "한 수강생이 오늘 처음으로 에러 문장을 끝까지 읽었다.\n\n전에는 화면을 캡처해서 바로 보내던 분인데, 이번엔 어느 줄에서 멈췄는지 먼저 말했다.\n\n그 정도면 수업은 잘 가고 있다."),
    ("after_work_second_attempt", "퇴근 뒤 두 번째 시도", "퇴근하고 온 수강생이 지난 시간 작업을 다시 열었다.\n\n첫 번째에는 안 됐던 부분을 오늘은 다른 순서로 붙여봤다.\n\n화면에 결과가 뜨자마자 다음 질문이 나왔다. 그 흐름이 좋았다."),
    ("lesson_plan_margin", "진도표에 남겨둔 빈칸", "이번 주 진도표에는 일부러 빈칸을 남겨뒀다.\n\n수강생마다 막히는 지점이 달라서, 꽉 찬 계획은 늘 누군가를 놓친다.\n\n빈칸이 있어야 수업에서 진짜 필요한 얘기를 할 수 있다."),
    ("portfolio_cut", "포트폴리오에서 지운 첫 페이지", "포트폴리오를 보다가 첫 페이지를 지우자고 했다.\n\n예쁜 소개보다 본인이 고친 화면 하나가 훨씬 많은 말을 하고 있었다.\n\n자기 일은 멋있게 설명하는 것보다 먼저 보여주는 편이 낫다."),
    ("consultation_current_work", "상담에서 먼저 꺼낸 현재 일", "상담할 때 기술 이름부터 묻지 않았다.\n\n지금 하는 일에서 가장 자주 반복되는 장면이 뭐냐고 먼저 물었다.\n\n답을 듣고 나니 어떤 수업부터 들어야 할지가 금방 정리됐다."),
    ("quiet_room_focus", "조용한 수업 시간", "오늘 수업은 유난히 조용했다.\n\n각자 화면을 보느라 질문이 없는 시간이 길었는데, 나는 그때가 싫지 않다.\n\n누가 듣기만 하는 시간이 아니라 직접 만져보는 시간이니까."),
    ("review_note_rewrite", "피드백 문장을 다시 쓴 밤", "수강생에게 보낼 피드백을 한 번 지우고 다시 썼다.\n\n틀린 부분을 많이 적는 것보다, 다음에 손댈 한 군데를 분명히 적는 편이 낫다.\n\n내 말이 많아질수록 상대 화면은 더 멀어지는 것 같아서."),
    ("question_became_specific", "질문이 달라진 순간", "처음엔 막연히 개발을 해보고 싶다고 했던 수강생이 있었다.\n\n오늘은 자기 업무에서 어떤 반복을 줄이고 싶은지부터 말했다.\n\n그때부터 수업 대화가 훨씬 빨라졌다."),
    ("bug_note_on_paper", "버그 옆에 적힌 한 줄", "한 수강생이 막힌 이유를 종이에 짧게 적어뒀다.\n\n코드를 고친 건 그 다음이었다.\n\n화면 밖으로 문제를 꺼내놓는 습관은 생각보다 오래 간다."),
    ("class_start_late_arrival", "늦게 들어온 수강생의 첫 화면", "수업에 조금 늦게 들어온 수강생이 있었다.\n\n미안하다는 말보다 지난 시간 파일을 바로 열었다.\n\n피곤한 날에도 자기 흐름을 놓지 않는 사람은 금방 티가 난다."),
    ("project_scope_cut", "과제 범위를 줄인 이유", "이번 과제에서 넣고 싶던 기능 두 개를 뺐다.\n\n다 해보는 것보다 하나를 끝까지 닫아보는 편이 지금 수강생들에겐 더 필요했다.\n\n과제는 욕심을 보여주는 곳이 아니라 다음 시도를 남기는 곳이다."),
    ("learner_explains_choice", "자기 선택을 설명한 수강생", "오늘은 한 수강생이 왜 이 방법을 골랐는지 먼저 설명했다.\n\n정답과는 조금 달랐지만, 그 선택을 바꿀 이유도 스스로 알고 있었다.\n\n그런 설명이 나오면 나는 답안을 고치는 손을 멈춘다."),
    ("career_resume_pause", "이력서보다 먼저 멈춘 질문", "경력 전환 상담에서 이력서 이야기를 잠깐 미뤘다.\n\n대신 최근 일 중에 유독 덜 지쳤던 날을 물었다.\n\n방향은 대개 그 대답 안에서 더 빨리 보인다."),
    ("classroom_seat_change", "자리 하나를 바꾼 날", "오늘은 수강생 한 명의 자리를 슬쩍 바꿨다.\n\n질문할 때마다 화면을 숨기게 되는 자리가 있었기 때문이다.\n\n수업은 내용만 고치는 일이 아니었다."),
    ("recording_not_rewatched", "다시 안 보는 녹화본", "수업 녹화본을 전부 다시 보진 않는다.\n\n대신 유난히 질문이 몰린 10분은 꼭 확인한다.\n\n다음 수업을 바꾸는 건 대개 그 짧은 장면이다."),
    ("course_price_decision", "가격표를 고치지 않은 날", "이번 달에도 수업 가격표를 그대로 두기로 했다.\n\n주변은 계속 바뀌지만, 지금 제공하는 피드백 시간까지 생각하면 아직 손댈 때가 아니었다.\n\n가격은 숫자보다 약속에 가까워서 쉽게 움직이고 싶지 않다."),
    ("consulting_no_easy_answer", "쉽게 괜찮다고 말하지 않은 상담", "오늘 상담에서 지금 시작해도 되냐는 질문을 받았다.\n\n나는 바로 괜찮다고 하지 않고, 지금 가진 경험 중에 이어 붙일 수 있는 걸 같이 찾았다.\n\n전환은 새로 만드는 일보다 연결하는 일에 더 가깝다."),
    ("template_removed", "자료에서 뺀 예쁜 문장", "강의 자료에서 보기 좋은 문장 몇 개를 지웠다.\n\n수강생이 자기 화면에서 바로 해볼 수 있는 문장만 남겼다.\n\n자료는 저장되는 것보다 쓰이는 쪽이 좋다."),
    ("business_capacity_limit", "수업 인원을 늘리지 않은 이유", "이번 모집에서 인원을 더 받지 않았다.\n\n가능은 했지만 질문을 놓치기 시작하면 그건 내 방식이 아니었다.\n\n교육 사업은 커지는 속도보다 관찰이 무너지지 않는 속도가 더 중요하다."),
    ("one_line_feedback", "한 줄로 끝낸 피드백", "오늘 피드백은 길게 쓰지 않았다.\n\n다음 화면에서 이 버튼만 먼저 눌러보면 된다고 적었다.\n\n상대가 바로 움직일 수 있는 한 줄이면 충분한 날이 있다."),
    ("late_working_demo", "늦은 시간에 다시 열린 프로젝트", "밤 수업 뒤에도 한 수강생의 프로젝트가 계속 열려 있었다.\n\n고쳐야 할 부분을 찾은 건 아니고, 어디서 멈췄는지만 표시해둔 상태였다.\n\n그 표시 하나가 다음 날 다시 시작할 자리를 만들어준다."),
    ("material_example_changed", "예시를 바꾼 이유", "오늘 수업 예시를 쇼핑몰이 아니라 예약 업무로 바꿨다.\n\n수강생들 일과 가까운 장면으로 바꾸니 질문도 달라졌다.\n\n예시는 쉬운 게 아니라 자기 일로 보이는 게 좋아야 한다."),
    ("business_client_message", "문의 답장을 미룬 오후", "새 문의가 왔지만 바로 답장을 보내지 않았다.\n\n조건을 맞출 수 없는 수업까지 잡아두면 나중에 서로 피곤해진다.\n\n할 수 있는 일과 잘할 수 있는 일은 따로 적어둔다."),
    ("learner_own_checklist", "자기 체크리스트를 만든 수강생", "한 수강생이 수업 노트 대신 자기 체크리스트를 만들었다.\n\n다음에 막히면 무엇부터 볼지 순서를 적어뒀다고 했다.\n\n그런 목록이 생기면 강사보다 본인이 먼저 해결하게 된다."),
    ("curriculum_order_swap", "커리큘럼 순서를 바꾼 주", "이번 주에는 계획했던 순서를 바꿨다.\n\n앞 단원보다 지금 다들 막히는 문제를 먼저 다루는 게 맞았다.\n\n교재 순서보다 현장 순서가 우선인 날이 있다."),
    ("portfolio_version_note", "버전 이름을 남긴 포트폴리오", "포트폴리오 파일에 버전 이름을 남겨둔 수강생이 있었다.\n\n완성본보다 어떻게 고쳐왔는지가 더 잘 보였다.\n\n일한 흔적을 지우지 않는 사람은 다음 작업에서도 덜 헤맨다."),
    ("workshop_room_setup", "수업 전 책상을 옮긴 아침", "수업 전에 책상 배치를 조금 바꿨다.\n\n서로 화면을 보여주기 어려운 구조가 계속 마음에 걸렸다.\n\n작은 불편을 그냥 두면 질문도 작아진다."),
    ("repeated_question_log", "같은 질문이 세 번 나온 날", "오늘 같은 질문이 세 번 나왔다.\n\n수강생들이 놓친 게 아니라 내가 설명을 잘못 놓은 거다.\n\n수업 끝나고 그 부분을 다음 자료 맨 앞으로 옮겼다."),
    ("career_small_proof", "경력 전환에 필요한 작은 증거", "상담 중인 수강생에게 거창한 포트폴리오보다 작은 결과 하나를 먼저 만들자고 했다.\n\n자기 업무에서 한 번 써본 흔적이면 충분하다.\n\n다음 선택은 늘 그 다음에 해도 늦지 않다."),
    ("class_end_no_wrapup", "억지로 마무리하지 않은 수업", "오늘 수업은 마지막 설명을 다 못 하고 끝냈다.\n\n대신 다음에 이어서 볼 파일 위치를 같이 적어뒀다.\n\n모든 걸 닫는 것보다 다시 열기 쉬운 상태로 두는 날도 필요하다."),
    ("business_message_standard", "운영 메시지를 통일한 이유", "수강생 안내 문구를 다시 정리했다.\n\n사소한 안내라도 사람마다 다르게 들리면 문의가 길어진다.\n\n운영이 편해지는 건 친절을 줄이는 게 아니라 기준을 맞추는 쪽이었다."),
    ("learner_retried_without_prompt", "말하지 않아도 다시 시도한 장면", "오늘은 내가 힌트를 꺼내기 전에 수강생이 다시 실행해봤다.\n\n실패한 화면을 그대로 두지 않고 조건 하나를 바꿔봤다.\n\n그 장면을 보면 수업 끝나고도 잘 해낼 거라는 생각이 든다."),
    ("phone_call_after_consult", "상담 뒤 적어둔 세 문장", "상담을 마치고 바로 다음 일로 넘어가지 않았다.\n\n상대가 반복해서 말한 단어 세 개를 메모해뒀다.\n\n다음 만남에서 그 단어부터 꺼내면 대화가 덜 멀어진다."),
    ("project_name_changed", "프로젝트 이름을 바꾼 날", "수강생 프로젝트 이름이 너무 넓어서 같이 바꿨다.\n\n무엇을 해결하는지 이름에 들어가니 만들 기능도 바로 줄었다.\n\n이름을 고치면 일이 갑자기 쉬워지는 경우가 있다."),
    ("weekend_material_review", "주말에 다시 본 수업 자료", "주말에 지난 수업 자료를 다시 열었다.\n\n잘 설명한 페이지보다 질문이 많았던 페이지부터 봤다.\n\n다음 주에는 그 페이지를 더 짧게 만들 생각이다."),
    ("business_referral_message", "소개 문의를 받았을 때", "예전 수강생이 지인을 소개하고 싶다고 연락했다.\n\n바로 가능하다고 답하기 전에, 지금 수업 방식이 그분에게 맞을지부터 물었다.\n\n소개는 숫자보다 첫 수업의 분위기가 더 중요하다."),
    ("learner_shared_shortcut", "수강생이 먼저 알려준 단축키", "오늘은 내가 알려주려던 단축키를 수강생이 먼저 보여줬다.\n\n자기 업무에서 매일 쓰다 보니 더 빠른 방법을 찾았다고 했다.\n\n이럴 때 수업은 내가 일방적으로 주는 자리가 아니라는 걸 다시 느낀다."),
    ("consultation_goal_narrowed", "상담 목표를 한 줄로 줄인 날", "상담 목표를 종이에 한 줄로 줄여봤다.\n\n처음엔 하고 싶은 일이 많았는데, 지금 바로 필요한 일은 하나였다.\n\n시작점이 좁아지니 표정도 조금 편해졌다."),
    ("course_material_blank_page", "일부러 남긴 빈 페이지", "새 자료 맨 끝에 빈 페이지를 하나 남겨뒀다.\n\n수강생이 자기 업무 예시를 적어볼 자리다.\n\n내 사례보다 그 한 줄이 다음 수업에서 더 많이 쓰인다."),
    ("operating_day_boundary", "운영 일을 여기까지 한 날", "오늘은 문의 답변을 정해둔 시간에 멈췄다.\n\n계속 열어두면 모든 메시지가 급해 보인다.\n\n내일 처리해도 되는 일은 내일의 집중력으로 하는 편이 낫다."),
    ("learner_fixed_typo", "오타 하나를 끝까지 찾은 수강생", "한 수강생이 오타 하나 때문에 한참 멈췄다.\n\n결국 본인이 찾아서 고친 뒤에는 다른 오류도 직접 확인했다.\n\n작은 해결 하나가 다음 화면에서 버티는 힘이 된다."),
    ("class_question_board", "질문을 한곳에 모은 이유", "질문이 수업 중간중간 흩어져서 오늘은 보드를 하나 만들었다.\n\n바로 답할 것과 끝에 같이 볼 것을 나눴다.\n\n수업 흐름이 덜 끊기니 질문도 더 편하게 나왔다."),
    ("career_previous_strength", "이전 경력을 지우지 않은 상담", "경력 전환을 준비하는 수강생의 이전 일을 지우지 않았다.\n\n그 안에 이미 고객을 이해한 경험이 있었기 때문이다.\n\n새 기술은 거기에 하나 더 얹는 쪽이 자연스러웠다."),
    ("business_small_cohort", "소규모 수업을 고집하는 이유", "소규모 수업은 운영만 보면 손이 더 간다.\n\n그래도 한 사람이 어디에서 말을 아끼는지까지 보려면 지금 규모가 맞다.\n\n나중에 커지더라도 그 감각은 놓치고 싶지 않다."),
    ("lesson_close_with_next_step", "수업 끝에 남긴 다음 한 줄", "오늘 수업 마지막에는 다음 할 일을 한 줄만 남겼다.\n\n다음 파일을 열고, 이 기능부터 다시 눌러보기.\n\n퇴근 뒤에 배우는 사람에게는 그 정도의 시작점이 제일 현실적이다."),
    ("own_workflow_note", "내 운영 순서를 다시 적은 날", "오늘은 내 운영 순서를 처음부터 다시 적어봤다.\n\n문의, 상담, 수업 준비가 한 덩어리로 섞이면 내 말도 급해진다.\n\n순서를 나누고 나니 저녁 수업 전 머리가 조금 조용해졌다."),
    ("learner_sent_real_result", "실제 업무에 써본 화면", "수강생에게 실제 업무에 써본 화면을 받았다.\n\n완벽하진 않았지만 지난 수업에서 만든 걸 자기 방식으로 바꿔 쓴 결과였다.\n\n이런 메시지를 받으면 다음 수업 준비 방향이 분명해진다."),
]

ANGLES = [
    ("afternoon", "수업·운영 메모"),
    ("night", "오늘의 작업 기록"),
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
    angle_label = dict(ANGLES).get("night" if slot == "night" else "afternoon", "수업·운영 메모")
    candidates = [
        {
            "content_id": content_id_for(seed_id, slot),
            "seed_id": seed_id,
            "title": title,
            "text": text,
            "angle": angle_label,
            "pillar": "education_business_judgment" if seed_id.startswith(("business_", "course_", "curriculum_", "operating_", "lesson_")) else "adult_learner_observation",
        }
        for seed_id, title, text in OBSERVATION_SEEDS
    ]
    ordered = sorted(candidates, key=lambda item: item["seed_id"])
    rotated = ordered[seed_number % len(ordered):] + ordered[:seed_number % len(ordered)]
    for candidate in rotated:
        if candidate["seed_id"] not in recent_seed_ids:
            return candidate
    raise RuntimeError("최근 21일 안에 재사용하지 않을 제이쌤 기록 소재가 부족합니다. 새 소재를 추가한 뒤 다시 실행하세요.")


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
        "source_note": "제이쌤의 성인 수강생·진로 전환·교육사업 운영 현장 기록",
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "editorial_rules": {
            "voice": "성인 코딩교육 사업가·진로코치가 실제 장면 뒤에 남기는 짧고 솔직한 개인 기록",
            "structure": "구체적 장면 → 내가 한 판단 또는 수정 → 다음에 남길 한 줄",
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
