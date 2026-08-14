from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODULE_PATH = ROOT / "generate_jayssam_daily_post.py"
SPEC = importlib.util.spec_from_file_location("generate_jayssam_daily_post", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)

BANNED_EXPLANATORY_PHRASES = (
    "다음과 같아",
    "이걸 확인해보자",
    "핵심은",
    "첫째",
    "둘째",
    "ChatGPT",
    "꿈이 없는 아이",
    "진로실험실",
    "댓글로 알려줘",
    "링크는 댓글",
)
BANNED_CHILD_CENTRIC_TERMS = ("아이", "학생", "학부모", "부모님", "가방 멘")


def test_observation_inventory_covers_two_posts_a_day_without_recycling() -> None:
    # 하루 두 건씩 21일을 운영해도 같은 장면이 바로 돌아오지 않도록 42개보다 많아야 한다.
    assert len(MODULE.OBSERVATION_SEEDS) >= 42
    seed_ids = [seed[0] for seed in MODULE.OBSERVATION_SEEDS]
    assert len(seed_ids) == len(set(seed_ids))


def test_notes_are_adult_learner_observations_and_threads_safe() -> None:
    for _, title, text in MODULE.OBSERVATION_SEEDS:
        assert 60 <= len(text) <= 500, title
        assert "\n\n" in text
        combined = f"{title}\n{text}"
        for banned in BANNED_EXPLANATORY_PHRASES:
            assert banned not in combined
        for banned in BANNED_CHILD_CENTRIC_TERMS:
            assert banned not in combined
        assert not text.startswith("교육 뉴스")
        assert not title.startswith(("수업 뒤", "늦게 남은 질문"))
        assert any(marker in text for marker in ("오늘", "이번", "수강생", "수업", "상담", "자료", "운영", "프로젝트", "문의", "커리큘럼", "포트폴리오", "피드백", "화면", "데모", "과제")), title


def test_same_day_slots_use_different_observation_materials() -> None:
    afternoon = MODULE.pick_topic("2026-08-12", "afternoon")
    night = MODULE.pick_topic("2026-08-12", "night")
    assert afternoon["seed_id"] != night["seed_id"]
    assert afternoon["text"] != night["text"]
    assert afternoon["pillar"] in {"adult_learner_observation", "education_business_judgment"}


def test_recent_seed_is_blocked_even_when_the_slot_name_changes() -> None:
    original = MODULE.recent_content_ids
    try:
        MODULE.recent_content_ids = lambda _date: {"screen_pause_before_commit-afternoon"}
        topic = MODULE.pick_topic("2026-08-13", "night")
        assert topic["seed_id"] != "screen_pause_before_commit"
    finally:
        MODULE.recent_content_ids = original


def test_business_judgment_keeps_an_educator_owner_voice() -> None:
    _, title, text = next(seed for seed in MODULE.OBSERVATION_SEEDS if seed[0] == "business_capacity_limit")
    assert "교육 사업" in text
    assert "관찰" in text
    assert title


def test_each_note_has_scene_judgment_and_personal_afterthought() -> None:
    for _, title, text in MODULE.OBSERVATION_SEEDS:
        paragraphs = [paragraph for paragraph in text.split("\n\n") if paragraph]
        assert len(paragraphs) >= 3, title
        assert len(paragraphs[0].strip()) >= 15, title
        assert len(paragraphs[-1].strip()) >= 15, title


if __name__ == "__main__":
    test_observation_inventory_covers_two_posts_a_day_without_recycling()
    test_notes_are_adult_learner_observations_and_threads_safe()
    test_same_day_slots_use_different_observation_materials()
    test_recent_seed_is_blocked_even_when_the_slot_name_changes()
    test_business_judgment_keeps_an_educator_owner_voice()
    test_each_note_has_scene_judgment_and_personal_afterthought()
    print('{"ok": true, "guard": "jayssam adult-learner observation content quality passes"}')
