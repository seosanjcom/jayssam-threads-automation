from __future__ import annotations

import importlib.util
from pathlib import Path
import shutil
import tempfile
from datetime import date, timedelta

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
BANNED_CHILD_CENTRIC_TERMS = ("학부모", "부모님", "우리 애", "가방 멘")
REQUIRED_PILLARS = {
    "practical_tool_education",
    "small_business_marketing_education",
    "career_lecture_judgment",
    "education_business_judgment",
}


def test_inventory_covers_two_posts_a_day_without_recycling() -> None:
    # 하루 두 건씩 21일을 운영할 수 있는 분량과, 서로 다른 수업·현장 소재가 필요하다.
    assert len(MODULE.OBSERVATION_SEEDS) >= 42
    seed_ids = [seed[0] for seed in MODULE.OBSERVATION_SEEDS]
    assert len(seed_ids) == len(set(seed_ids))


def test_inventory_covers_the_actual_course_and_learner_spectrum() -> None:
    seed_ids = {seed[0] for seed in MODULE.OBSERVATION_SEEDS}
    assert any(seed.startswith("excel_") for seed in seed_ids)
    assert any(seed.startswith("ppt_") for seed in seed_ids)
    assert any(seed.startswith("photoshop_") or seed.startswith("illustrator_") for seed in seed_ids)
    assert any(seed.startswith("video_") or seed.startswith("youtube_") for seed in seed_ids)
    assert any(seed.startswith("sns_") or seed.startswith("smallbiz_") for seed in seed_ids)
    assert any(seed.startswith("career_") or seed.startswith("jobtalk_") for seed in seed_ids)
    assert any(seed.startswith("three_d_") for seed in seed_ids)


def test_notes_are_threads_safe_and_keep_the_owner_voice() -> None:
    for _, title, text in MODULE.OBSERVATION_SEEDS:
        assert 90 <= len(text) <= 500, title
        assert text.count("\n\n") >= 2, title
        combined = f"{title}\n{text}"
        for banned in BANNED_EXPLANATORY_PHRASES:
            assert banned not in combined
        for banned in BANNED_CHILD_CENTRIC_TERMS:
            assert banned not in combined
        assert not text.startswith("교육 뉴스")
        assert not title.startswith(("수업 뒤", "늦게 남은 질문"))
        assert "인 거지" not in text, title
        assert not text.rstrip().endswith(("인 거지.", "인 거지", "거든.")), title
        # 한 문장 끝을 반복하지 않고, 원장님의 말투가 글 안에서 자연스럽게만 쓰인다.
        assert text.count("거든") <= 1, title
        assert text.count("~이야") <= 1, title


def test_every_note_has_question_or_scene_gap_and_educator_judgment() -> None:
    for _, title, text in MODULE.OBSERVATION_SEEDS:
        paragraphs = [paragraph for paragraph in text.split("\n\n") if paragraph]
        assert len(paragraphs) >= 3, title
        assert len(paragraphs[0].strip()) >= 20, title
        assert len(paragraphs[-1].strip()) >= 20, title


def test_same_day_slots_use_different_course_materials() -> None:
    afternoon = MODULE.pick_topic("2026-09-11", "afternoon")
    night = MODULE.pick_topic("2026-09-11", "night")
    assert afternoon["seed_id"] != night["seed_id"]
    assert afternoon["text"] != night["text"]
    assert afternoon["pillar"] in REQUIRED_PILLARS
    assert night["pillar"] in REQUIRED_PILLARS


def test_recent_seed_is_blocked_even_when_the_slot_name_changes() -> None:
    original = MODULE.recent_content_ids
    try:
        MODULE.recent_content_ids = lambda _date: {"excel_certificate_gap-afternoon"}
        topic = MODULE.pick_topic("2026-09-12", "night")
        assert topic["seed_id"] != "excel_certificate_gap"
    finally:
        MODULE.recent_content_ids = original


def test_twenty_one_days_of_two_daily_posts_do_not_reuse_a_course_scene() -> None:
    temp_root = Path(tempfile.mkdtemp(prefix="jayssam-dedupe-"))
    original_out_root = MODULE.OUT_ROOT
    original_publish_log = MODULE.PUBLISH_LOG
    try:
        MODULE.OUT_ROOT = temp_root / "outputs" / "automation"
        MODULE.PUBLISH_LOG = temp_root / "outputs" / "meta-publish-log.json"
        seen: set[str] = set()
        start = date(2026, 9, 1)
        for offset in range(21):
            current = (start + timedelta(days=offset)).isoformat()
            for slot in ("afternoon", "night"):
                topic = MODULE.pick_topic(current, slot)
                assert topic["seed_id"] not in seen, topic["seed_id"]
                MODULE.write_draft(topic, current, slot)
                seen.add(topic["seed_id"])
        assert len(seen) == 42
    finally:
        MODULE.OUT_ROOT = original_out_root
        MODULE.PUBLISH_LOG = original_publish_log
        shutil.rmtree(temp_root, ignore_errors=True)


def test_pillars_reflect_practical_education_marketing_career_and_owner_judgment() -> None:
    pillars = {MODULE.pillar_for(seed_id) for seed_id, _, _ in MODULE.OBSERVATION_SEEDS}
    assert REQUIRED_PILLARS.issubset(pillars)
    _, title, text = next(seed for seed in MODULE.OBSERVATION_SEEDS if seed[0] == "class_owner_standard")
    assert "교육 사업" in text
    assert title


if __name__ == "__main__":
    test_inventory_covers_two_posts_a_day_without_recycling()
    test_inventory_covers_the_actual_course_and_learner_spectrum()
    test_notes_are_threads_safe_and_keep_the_owner_voice()
    test_every_note_has_question_or_scene_gap_and_educator_judgment()
    test_same_day_slots_use_different_course_materials()
    test_recent_seed_is_blocked_even_when_the_slot_name_changes()
    test_twenty_one_days_of_two_daily_posts_do_not_reuse_a_course_scene()
    test_pillars_reflect_practical_education_marketing_career_and_owner_judgment()
    print('{"ok": true, "guard": "jayssam course spectrum and owner-voice content quality passes"}')
