from __future__ import annotations

import importlib.util
import json
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
BANNED_TEMPLATE_TONE = ("정리해야 한다", "같이 짚어", "핵심을 짚어보자")
BANNED_DISRESPECTFUL_TONE = ("쓰레기 데이터", "아무 의미 없다", "당연하지", "어이없었던", "봐라", "찾아라", "쳐내야", "스킵당", "어그로", "낚여서", "종이 쪼가리")
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
        for banned in BANNED_TEMPLATE_TONE:
            assert banned not in combined
        for banned in BANNED_DISRESPECTFUL_TONE:
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


def test_generated_posts_add_a_specific_tip_and_natural_action_prompt() -> None:
    temp_root = Path(tempfile.mkdtemp(prefix="jayssam-practical-finish-"))
    original_out_root = MODULE.OUT_ROOT
    original_publish_log = MODULE.PUBLISH_LOG
    try:
        MODULE.OUT_ROOT = temp_root / "outputs" / "automation"
        MODULE.PUBLISH_LOG = temp_root / "outputs" / "meta-publish-log.json"
        for seed_id in ("excel_certificate_gap", "photoshop_pretty_not_sell", "youtube_title_promise", "career_certificate_question"):
            topic = next(
                item for item in (
                    {
                        "content_id": MODULE.content_id_for(source_id, "afternoon"),
                        "seed_id": source_id,
                        "title": title,
                        "text": text,
                        "angle": "교육 현장 메모",
                        "pillar": MODULE.pillar_for(source_id),
                    }
                    for source_id, title, text in MODULE.OBSERVATION_SEEDS
                ) if item["seed_id"] == seed_id
            )
            draft_path = MODULE.write_draft(topic, "2026-09-15", "afternoon")
            draft = json.loads(draft_path.read_text(encoding="utf-8"))
            text = draft["threads_text"]
            assert draft["topic_tag"] == MODULE.topic_tag_for(seed_id)
            assert 1 <= len(draft["topic_tag"]) <= 50
            assert "#" not in draft["topic_tag"]
            assert draft["editorial_rules"]["strategy_skill"] == "jayssam-threads-content-strategy"
            assert "한 개만 API에 전달" in draft["editorial_rules"]["topic_tag_policy"]
            assert any(marker in text for marker in ("💬 ", "📌 ", "📩 ")), seed_id
            assert text.rstrip().split("\n")[-1].startswith(("💬 ", "📌 ", "📩 ")), seed_id
            assert len(text) <= 500, seed_id
            assert "인 거지" not in text, seed_id
            for banned in BANNED_TEMPLATE_TONE:
                assert banned not in text, seed_id
            for banned in BANNED_DISRESPECTFUL_TONE:
                assert banned not in text, seed_id
            if seed_id == "excel_certificate_gap":
                assert text.count("Ctrl + G") == 1
            if seed_id == "photoshop_pretty_not_sell":
                assert text.count("폰트가 3~4개") == 1
            if seed_id == "youtube_title_promise":
                assert text.count("편집 프로그램을 켜기") == 1
            if seed_id == "career_certificate_question":
                assert text.count("채용공고 3개") == 1
                assert "댓글로 알려줘~!" in text
                assert "같이 찾아보자ㅎㅎ" in text
            if seed_id == "excel_certificate_gap":
                assert "언제였어?? 알려줘~!" in text
            if seed_id == "photoshop_pretty_not_sell":
                assert "확인해봐!!" in text
            if seed_id == "youtube_title_promise":
                assert "알려줘~!" in text
    finally:
        MODULE.OUT_ROOT = original_out_root
        MODULE.PUBLISH_LOG = original_publish_log
        shutil.rmtree(temp_root, ignore_errors=True)


def test_core_philosophy_uses_purpose_before_tool_and_concrete_field_gaps() -> None:
    seeds = {seed_id: text for seed_id, _, text in MODULE.OBSERVATION_SEEDS}
    assert "도구 위치" in seeds["excel_certificate_gap"]
    assert "문제의 원인" in seeds["excel_certificate_gap"]
    assert "명확한 목적 없이" in seeds["career_certificate_question"]
    assert "자격증의 개수" in seeds["career_certificate_question"]
    assert "정확히 어느 업무에" in seeds["career_certificate_question"]
    assert "설득력" in seeds["photoshop_pretty_not_sell"]
    assert "도구일 뿐" in seeds["photoshop_pretty_not_sell"]
    assert "시청자와 하는 약속" in seeds["youtube_title_promise"]
    assert "의미가 크지 않아" in seeds["youtube_title_promise"]


def test_every_course_seed_maps_to_one_relevant_threads_topic_tag() -> None:
    expected = {
        "excel_certificate_gap": "엑셀 실무",
        "photoshop_pretty_not_sell": "포토샵",
        "illustrator_logo_before_shape": "일러스트레이터",
        "video_effect_not_story": "영상 편집",
        "youtube_title_promise": "유튜브",
        "career_certificate_question": "진로 상담",
        "three_d_pen_result": "3D펜",
        "three_d_printer_file": "3D프린터",
        "smallbiz_product_explanation": "소상공인 마케팅",
    }
    for seed_id, expected_tag in expected.items():
        assert MODULE.topic_tag_for(seed_id) == expected_tag
    for seed_id, _, _ in MODULE.OBSERVATION_SEEDS:
        topic_tag = MODULE.topic_tag_for(seed_id)
        assert 1 <= len(topic_tag) <= 50
        assert "#" not in topic_tag
        assert "," not in topic_tag


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
    test_generated_posts_add_a_specific_tip_and_natural_action_prompt()
    test_core_philosophy_uses_purpose_before_tool_and_concrete_field_gaps()
    test_every_course_seed_maps_to_one_relevant_threads_topic_tag()
    test_pillars_reflect_practical_education_marketing_career_and_owner_judgment()
    print('{"ok": true, "guard": "jayssam course spectrum and owner-voice content quality passes"}')
