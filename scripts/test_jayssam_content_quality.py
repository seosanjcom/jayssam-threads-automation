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


def test_observation_inventory_matches_21_day_dedupe_window() -> None:
    assert len(MODULE.OBSERVATION_SEEDS) >= 21
    seed_ids = [seed[0] for seed in MODULE.OBSERVATION_SEEDS]
    assert len(seed_ids) == len(set(seed_ids))


def test_personal_note_is_natural_and_threads_safe() -> None:
    topic = MODULE.pick_topic("2026-08-12", "afternoon")
    text = topic["text"]
    assert 60 <= len(text) <= 500, len(text)
    assert "\n\n" in text
    for banned in BANNED_EXPLANATORY_PHRASES:
        assert banned not in text
    assert not text.startswith("교육 뉴스")
    assert topic["pillar"] in {"educator_observation", "education_business_judgment"}


def test_same_day_slots_use_different_observation_materials() -> None:
    afternoon = MODULE.pick_topic("2026-08-12", "afternoon")
    night = MODULE.pick_topic("2026-08-12", "night")
    assert afternoon["seed_id"] != night["seed_id"]
    assert afternoon["text"] != night["text"]


def test_recent_seed_is_blocked_even_when_the_slot_name_changes() -> None:
    original = MODULE.recent_content_ids
    try:
        MODULE.recent_content_ids = lambda _date: {"school_after_class-afternoon"}
        topic = MODULE.pick_topic("2026-08-13", "night")
        assert topic["seed_id"] != "school_after_class"
    finally:
        MODULE.recent_content_ids = original


def test_business_judgment_keeps_an_educator_voice() -> None:
    _, title, text = next(seed for seed in MODULE.OBSERVATION_SEEDS if seed[0] == "business_no_shortcut")
    assert "교육 사업" in text
    assert "빠르게" not in text or "빨리" in text
    assert title


if __name__ == "__main__":
    test_observation_inventory_matches_21_day_dedupe_window()
    test_personal_note_is_natural_and_threads_safe()
    test_same_day_slots_use_different_observation_materials()
    test_recent_seed_is_blocked_even_when_the_slot_name_changes()
    test_business_judgment_keeps_an_educator_voice()
    print('{"ok": true, "guard": "jayssam educator-observation content quality passes"}')
