from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MODULE_PATH = ROOT / "generate_jayssam_daily_post.py"
SPEC = importlib.util.spec_from_file_location("generate_jayssam_daily_post", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_resource_post_is_evidence_first_and_within_threads_limit() -> None:
    topic = next(item for item in MODULE.TOPICS if item.get("resource"))
    text = "\n\n".join(MODULE.build_threads_text_parts(topic, None, "must_know_practical_tip", "2026-08-12", "night"))
    assert len(text) <= 500, len(text)
    assert "확인된 정보:" in text
    assert "이렇게 써보세요:" in text
    assert "공식 확인:" in text


def test_consulting_posts_use_parent_voice_without_explanatory_filler() -> None:
    topic = next(item for item in MODULE.CONSULTING_TOPICS if item["slug"] == "consulting-coding-before-math-score")
    text = "\n\n".join(MODULE.build_threads_text_parts(topic, None, "must_know_practical_tip", "2026-08-12", "night"))
    assert len(text) <= 500, len(text)
    assert text.startswith("수학 약한데 코딩 시켜도 되냐고?")
    for banned in ("다음과 같아", "이걸 확인해보자", "핵심은", "결국", "첫째", "둘째"):
        assert banned not in text
    assert "아이한테 물어봐" in text
    assert topic["thread_comments"]


def test_news_post_has_parent_action_and_source() -> None:
    topic = {
        "slug": "test-news",
        "keyword": "AI교육",
        "hook": "교육 뉴스는 제목보다 아이에게 어떤 변화가 오는지 먼저 봐야 합니다.",
        "body": ["정책 변화의 핵심은 수업에서 아이가 남기는 사고 과정과 피드백입니다."],
        "source_name": "공식 교육 정책 자료",
        "expert": {
            "must_know": "수업의 질은 결과물보다 근거를 설명하는 과정에서 드러납니다.",
            "check": "아이에게 오늘 어떤 기준으로 답을 고쳤는지 물어보세요.",
            "use_for": "가정 대화 질문으로 활용하세요.",
            "avoid": "도구 사용 여부만 보지 마세요.",
        },
    }
    text = "\n\n".join(MODULE.build_threads_text_parts(topic, None, "education_news_interpretation", "2026-08-12", "afternoon"))
    assert len(text) <= 500, len(text)
    assert "무엇이 중요한가:" in text
    assert "부모 체크:" in text
    assert "출처:" in text


if __name__ == "__main__":
    test_resource_post_is_evidence_first_and_within_threads_limit()
    test_consulting_posts_use_parent_voice_without_explanatory_filler()
    test_news_post_has_parent_action_and_source()
    print('{"ok": true, "guard": "jayssam evidence-first content quality passes"}')
