from __future__ import annotations

import json
import os
import subprocess
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
PUBLISH_LOG = ROOT / "outputs" / "meta-publish-log.json"
KST = timezone(timedelta(hours=9))
KOREA_POLICY_MOE_RSS = "https://www.korea.kr/rss/dept_moe.xml"
ISSUE_KEYWORDS = ("AI", "디지털", "정보", "진로", "교육과정", "학교", "학생", "교사", "미래교육")
RECENT_DEDUPE_DAYS = 7
LEGACY_SLUG_ALIASES = {
    "READY-20260520-career-dream-no-panic": "career-no-dream",
    "READY-20260521-informatics-hours-why": "info-hours",
}


TOPICS = [
    {
        "slug": "ai-class-evidence",
        "keyword": "AI수업평가",
        "title": "AI 수업을 볼 때 결과물보다 먼저 봐야 할 것은 사고의 흔적입니다",
        "source_name": "교육부 디지털 기반 교육혁신 방향 / AI 디지털교과서 정책 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI 수업을 평가할 때,\n결과물이 예쁜지만 보면 놓치는 게 있습니다.",
        "body": [
            "좋은 AI 수업은 도구를 많이 소개하는 수업이 아니라, 아이가 문제를 어떻게 정의했고 왜 그 답을 선택했는지 남기는 수업입니다.",
            "수업 산출물보다 먼저 봐야 할 증거는 세 가지입니다. 질문을 바꾼 흔적, 답을 비교한 흔적, 기준을 세워 판단한 흔적입니다.",
            "핵심은 AI를 썼는지가 아니라, 아이가 AI 답을 의심하고 수정하며 자기 기준을 만들었는지입니다.",
        ],
        "slides": [
            ("01", "AI 수업의 핵심", "결과물이 아니라 사고의 흔적을 봐야 합니다."),
            ("02", "첫 번째 증거", "아이 스스로 질문을 고쳐본 기록이 있나요?"),
            ("03", "두 번째 증거", "AI 답을 두 개 이상 비교해봤나요?"),
            ("04", "세 번째 증거", "왜 이 답을 골랐는지 기준을 말했나요?"),
            ("05", "해석 프레임", "AI 사용 여부보다 검토-수정-판단 구조를 봅니다."),
            ("06", "저장 기준", "툴 이름보다 질문-비교-판단 구조를 보세요."),
        ],
        "expert": {
            "news_frame": "AI 교육 확대 이슈는 ‘도구 도입’ 뉴스로 보이면 가볍지만, 실제 현장에서는 평가 기준이 바뀌는 신호입니다.",
            "must_know": "AI 활용 수업의 질은 결과물의 화려함이 아니라 아이가 남긴 사고 과정의 밀도로 갈립니다.",
            "avoid": "툴 사용법만 따라 하면 수업은 빨리 끝나지만, 아이가 판단한 근거는 남지 않습니다.",
            "check": "AI 답을 그대로 제출하는 활동과, AI 답을 검토해 자기 기준으로 고치는 활동은 전혀 다른 수업입니다.",
            "use_for": "학부모에게는 교육 방향을 보는 렌즈, 강사에게는 차시 설계와 평가 루브릭 기준으로 바로 쓸 수 있습니다.",
        },
    },
    {
        "slug": "digital-literacy-source-check",
        "keyword": "디지털문해력",
        "title": "검색을 잘하는 아이보다 출처를 의심할 줄 아는 아이가 더 강합니다",
        "source_name": "디지털 소양 교육 방향 / 학교 현장 미디어 리터러시 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "요즘 아이에게 필요한 건\n검색 속도가 아니라 출처를 다루는 힘입니다.",
        "body": [
            "AI와 검색이 쉬워질수록 아이는 정답처럼 보이는 문장을 더 빨리 만납니다. 그래서 이제 핵심은 찾기보다 검증입니다.",
            "자료를 볼 때는 출처, 시점, 이해관계, 반대 자료를 함께 봐야 합니다. 이 네 가지가 없으면 탐구가 아니라 복사에 가깝습니다.",
            "숙제나 발표에서 중요한 것은 자료의 양이 아니라, 출처와 관점을 다룬 흔적입니다.",
        ],
        "slides": [
            ("01", "검색보다 중요한 것", "출처를 의심하고 근거를 확인하는 힘입니다."),
            ("02", "체크 1", "누가 만든 자료인가요?"),
            ("03", "체크 2", "언제 나온 자료인가요?"),
            ("04", "체크 3", "이 자료가 유리한 사람이 있나요?"),
            ("05", "체크 4", "반대로 설명하는 자료도 봤나요?"),
            ("06", "저장 기준", "찾기-복사보다 출처-시점-관점 검토가 먼저입니다."),
        ],
        "expert": {
            "news_frame": "디지털 교육 이슈를 볼 때 핵심은 기기 보급이 아니라 정보 판단 기준이 수업 안에 들어왔는지입니다.",
            "must_know": "디지털 문해력은 검색량이 아니라 출처, 시점, 이해관계, 반대 근거를 다루는 능력입니다.",
            "avoid": "자료를 많이 찾았다는 말만 믿으면 아이가 복사를 탐구로 착각할 수 있습니다.",
            "check": "출처, 시점, 이해관계, 반대 근거가 보이면 탐구이고, 없으면 검색 결과를 옮긴 것에 가깝습니다.",
            "use_for": "학부모는 과제 점검 질문으로, 강사는 탐구보고서 평가 기준으로 바로 쓸 수 있습니다.",
        },
    },
    {
        "slug": "info-curriculum-thinking",
        "keyword": "정보교과",
        "title": "정보교과 시수 확대는 코딩 진도보다 문제해결 언어를 보라는 신호입니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": ["https://www.moe.go.kr/", "https://www.korea.kr/news/policyNewsView.do?newsId=148905079"],
        "hook": "정보교과 시간이 늘어난 이유를\n코딩 진도표로만 보면 절반만 본 겁니다.",
        "body": [
            "정보교과의 핵심은 특정 언어를 빨리 외우는 것이 아니라 문제를 구조화하고 절차로 설명하는 능력입니다.",
            "좋은 수업은 결과 코드를 빨리 보여주기보다, 아이가 조건을 어떻게 나눴고 오류를 어떤 근거로 수정했는지 말하게 합니다.",
            "수업을 고를 때는 진도표보다 디버깅 기록, 설명 시간, 자기 점검표가 있는지 확인하는 편이 더 정확합니다.",
        ],
        "slides": [
            ("01", "정보교과의 핵심", "코딩 진도보다 문제해결 언어입니다."),
            ("02", "수업 증거 1", "조건을 나누어 설명하나요?"),
            ("03", "수업 증거 2", "오류를 찾은 근거를 말하나요?"),
            ("04", "수업 증거 3", "다른 해결 방법을 비교하나요?"),
            ("05", "해석 프레임", "진도표보다 설명 시간과 디버깅 기록을 봅니다."),
            ("06", "저장 기준", "진도표보다 사고 과정 기록을 보세요."),
        ],
        "expert": {
            "news_frame": "정보교육 확대는 코딩학원 홍보 소재가 아니라, 학교가 문제해결 언어를 평가하기 시작했다는 신호입니다.",
            "must_know": "코딩을 잘한다는 말은 문법을 외웠다는 뜻이 아니라 조건, 반복, 자료를 설명할 수 있다는 뜻에 가까워져야 합니다.",
            "avoid": "진도만 빠른 수업은 초반 만족도는 높지만, 낯선 문제 앞에서 멈추는 아이를 만들 수 있습니다.",
            "check": "수업 후 ‘오늘 어디서 막혔고, 어떤 근거로 고쳤어?’라고 물어보세요.",
            "use_for": "학부모는 교육 방향을 보는 기준으로, 강사는 수업 관찰 체크리스트로 쓸 수 있습니다.",
        },
    },
    {
        "slug": "career-pattern-before-job",
        "keyword": "진로",
        "title": "진로는 직업명보다 반복되는 선택 패턴에서 먼저 보입니다",
        "source_name": "커리어넷 진로교육 자료 흐름 / 현장 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "아이가 꿈이 없다고 말할 때,\n직업명부터 찾으면 중요한 단서를 놓칠 수 있습니다.",
        "body": [
            "요즘 진로교육에서 먼저 볼 것은 직업명이 아니라 아이가 반복해서 선택하는 경험의 패턴입니다.",
            "오래 붙잡는 문제, 자주 맡는 역할, 친구들이 부탁하는 일, 스스로 찾아보는 주제가 진로 단서가 됩니다.",
            "진로를 볼 때는 한 번의 대답보다 반복되는 선택, 역할, 몰입 시간을 읽어야 합니다.",
        ],
        "slides": [
            ("01", "진로의 첫 단서", "직업명보다 반복되는 선택 패턴입니다."),
            ("02", "단서 1", "오래 붙잡는 문제가 있나요?"),
            ("03", "단서 2", "자주 맡는 역할이 있나요?"),
            ("04", "단서 3", "친구들이 부탁하는 일이 있나요?"),
            ("05", "해석 프레임", "선언보다 반복 행동을 봅니다."),
            ("06", "저장 기준", "진로는 선언보다 반복 행동에서 먼저 보입니다."),
        ],
        "expert": {
            "news_frame": "진로교육 이슈는 검사나 직업 정보보다 아이의 경험 데이터를 어떻게 읽을지로 봐야 합니다.",
            "must_know": "진로 단서는 거창한 꿈 선언보다 반복 행동, 역할, 몰입 시간에서 더 안정적으로 나옵니다.",
            "avoid": "직업명을 빨리 정하게 하면 부모는 안심하지만 아이의 실제 강점 패턴은 가려질 수 있습니다.",
            "check": "이번 주 아이가 오래 붙잡은 문제, 자주 맡은 역할, 스스로 찾아본 주제를 각각 하나씩 적어보세요.",
            "use_for": "학부모에게는 아이를 보는 관점, 강사에게는 진로 수업 도입 프레임으로 쓸 수 있습니다.",
        },
    },
]


TOPICS = [
    {
        "slug": "ai-parent-thinking-trace",
        "keyword": "AI교육",
        "title": "AI 교육의 핵심은 프로그램 이름이 아니라 판단력으로 옮겨가고 있습니다",
        "source_name": "교육부 AI 디지털 기반 교육혁신 방향 / AI 디지털교과서 정책 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI 교육이 늘어난다는 말,\n사실은 ‘툴을 더 배우라’는 뜻이 아닙니다.",
        "body": [
            "교육 현장에서 AI가 중요해지는 이유는 아이가 더 많은 앱을 외워야 해서가 아닙니다.",
            "정보를 빨리 얻는 시대에는 답을 찾는 능력보다, 답이 맞는지 판단하고 목적에 맞게 고치는 능력이 더 중요해집니다.",
            "그래서 AI 교육의 진짜 핵심은 사용법 암기가 아니라 질문 설계, 결과 검토, 판단 기준입니다.",
        ],
        "slides": [
            ("01", "AI 교육의 방향", "툴 사용법보다 판단력으로 옮겨가고 있습니다."),
            ("02", "왜 중요한가", "정답을 빨리 얻는 시대일수록 검토 능력이 차이를 만듭니다."),
            ("03", "핵심 변화 1", "검색 능력보다 질문 설계가 중요해집니다."),
            ("04", "핵심 변화 2", "결과물보다 검토 과정이 중요해집니다."),
            ("05", "핵심 변화 3", "사용법보다 판단 기준이 중요해집니다."),
            ("06", "저장 포인트", "AI 교육은 도구 교육이 아니라 사고 기준 교육입니다."),
        ],
        "expert": {
            "news_frame": "AI 교육 확대는 ‘AI 앱을 많이 쓰는 아이’를 만들겠다는 흐름이 아니라, AI가 만든 결과를 해석하고 판단하는 역량을 키우겠다는 흐름에 가깝습니다.",
            "must_know": "앞으로 차이를 만드는 건 프롬프트 문장 몇 개가 아니라, 목적에 맞는 질문을 만들고 결과의 오류를 걸러내는 기준입니다.",
            "avoid": "AI 결과물이 화려하다는 이유만으로 교육 효과가 있다고 보면 핵심을 놓칩니다. 완성물보다 판단 과정이 교육의 본체입니다.",
            "check": "부모가 알아야 할 포인트는 간단합니다. AI를 배운다는 말은 ‘빨리 만드는 법’보다 ‘제대로 판단하는 법’에 가까워지고 있습니다.",
            "use_for": "이 관점을 알면 AI 교육 광고나 학교 활동을 볼 때, 겉으로 보이는 결과물에 덜 흔들릴 수 있습니다.",
        },
    },
    {
        "slug": "digital-literacy-parent-source",
        "keyword": "디지털문해력",
        "title": "디지털문해력은 검색 실력이 아니라 정보에 덜 속는 힘입니다",
        "source_name": "디지털 소양 교육 방향 / 학교 현장 미디어 리터러시 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "요즘 아이들은 정보를 못 찾아서가 아니라\n너무 쉽게 믿어서 흔들립니다.",
        "body": [
            "검색과 AI가 쉬워질수록 아이들은 그럴듯한 문장을 더 많이 만나게 됩니다.",
            "그래서 디지털문해력은 자료를 빨리 찾는 기술이 아니라, 출처와 관점과 의도를 읽어내는 능력에 가까워지고 있습니다.",
            "이걸 모르면 아이는 정보를 많이 소비해도 판단력은 자라지 않을 수 있습니다.",
        ],
        "slides": [
            ("01", "디지털문해력의 핵심", "검색을 잘하는 것보다 덜 속는 힘입니다."),
            ("02", "왜 중요한가", "AI와 검색은 그럴듯한 정보를 더 쉽게 보여줍니다."),
            ("03", "핵심 변화 1", "출처를 보는 능력이 공부 실력이 됩니다."),
            ("04", "핵심 변화 2", "자료의 시점과 의도를 읽어야 합니다."),
            ("05", "핵심 변화 3", "반대 근거를 보는 아이가 더 단단합니다."),
            ("06", "저장 포인트", "정보량보다 정보 판단력이 아이의 격차가 됩니다."),
        ],
        "expert": {
            "news_frame": "디지털 교육의 핵심은 기기를 더 잘 쓰는 데서 끝나지 않습니다. 아이가 정보를 고르고 검증하는 기준을 갖는지가 점점 중요해지고 있습니다.",
            "must_know": "디지털문해력은 검색 실력이 아니라 출처, 시점, 관점, 반대 근거를 함께 보는 힘입니다.",
            "avoid": "자료를 많이 찾는 능력만 강조하면 아이는 정보 소비에는 익숙해져도, 정보의 질을 가르는 감각은 약해질 수 있습니다.",
            "check": "부모가 알아야 할 포인트는 정보량이 많아질수록 공부의 핵심이 ‘찾기’에서 ‘걸러내기’로 이동한다는 점입니다.",
            "use_for": "이 관점을 알면 아이의 발표, 탐구보고서, AI 활용 과제를 볼 때 무엇이 진짜 역량인지 구분할 수 있습니다.",
        },
    },
    {
        "slug": "informatics-parent-why",
        "keyword": "정보교과",
        "title": "정보교과 시간이 늘어난 건 코딩을 더 시키라는 뜻만은 아닙니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": ["https://www.moe.go.kr/", "https://www.korea.kr/news/policyNewsView.do?newsId=148905079"],
        "hook": "정보 시간이 늘었다는 말에\n바로 코딩 진도부터 떠올리면 핵심을 놓칠 수 있습니다.",
        "body": [
            "정보교과에서 중요한 건 특정 언어를 빨리 외우는 것이 아니라, 문제를 작게 나누고 순서대로 설명하는 힘입니다.",
            "코딩은 그 힘을 연습하는 도구에 가깝습니다. 아이가 조건을 나누고 오류를 고치고 다른 방법을 비교하는 과정이 더 중요합니다.",
            "부모가 봐야 할 건 몇 줄을 짰는지가 아니라, 아이가 왜 그렇게 해결했는지 말할 수 있는지입니다.",
        ],
        "slides": [
            ("01", "정보교과가 늘어난 이유", "코딩 진도보다 문제를 푸는 방식을 보기 위해서입니다."),
            ("02", "필요한 힘 1", "문제를 작게 나누는 힘"),
            ("03", "필요한 힘 2", "순서를 세워 설명하는 힘"),
            ("04", "필요한 힘 3", "오류를 근거로 고치는 힘"),
            ("05", "핵심 변화 3", "오류를 고치는 과정이 실력이 됩니다."),
            ("06", "저장 포인트", "정보교과는 코딩보다 문제해결 언어에 가깝습니다."),
        ],
        "expert": {
            "news_frame": "정보교육 강화는 코딩학원 선택 문제가 아니라, 학교가 아이의 문제해결 언어를 더 중요하게 보기 시작했다는 흐름입니다.",
            "must_know": "코딩을 배운다는 건 문법을 외운다는 뜻보다 조건, 순서, 반복, 오류를 자기 말로 다루는 힘에 가깝습니다.",
            "avoid": "진도만 빠르면 초반에는 잘하는 것처럼 보이지만, 낯선 문제 앞에서 멈추는 아이가 될 수 있습니다.",
            "check": "부모가 알아야 할 포인트는 정보교과 확대가 코딩 기술 자체보다, 논리적으로 문제를 다루는 힘을 학교가 더 중요하게 본다는 뜻이라는 점입니다.",
            "use_for": "이 관점을 알면 코딩 선행 여부보다 정보교과가 요구하는 사고력이 무엇인지 먼저 이해할 수 있습니다.",
        },
    },
    {
        "slug": "career-parent-no-dream",
        "keyword": "진로",
        "title": "꿈이 없다는 아이의 말에 먼저 불안해하지 않으셔도 됩니다",
        "source_name": "커리어넷 진로교육 자료 흐름 / 현장 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "‘꿈이 뭐니?’라고 물었는데\n‘없어요’라고 답해도 바로 늦은 건 아닙니다.",
        "body": [
            "요즘 진로는 직업명을 빨리 정하는 방식으로만 보기가 어렵습니다. 직업이 바뀌는 속도보다 아이의 경험 패턴을 읽는 일이 먼저입니다.",
            "아이가 오래 붙잡는 문제, 자주 맡는 역할, 스스로 찾아보는 주제 안에 진로 단서가 남습니다.",
            "부모가 봐야 할 건 한 번의 대답이 아니라 반복되는 선택과 몰입의 방향입니다.",
        ],
        "slides": [
            ("01", "꿈이 없다는 말", "바로 늦었다는 뜻은 아닙니다."),
            ("02", "먼저 볼 것 1", "아이가 오래 붙잡는 문제가 있나요?"),
            ("03", "먼저 볼 것 2", "자주 맡는 역할이 있나요?"),
            ("04", "먼저 볼 것 3", "스스로 찾아보는 주제가 있나요?"),
            ("05", "부모가 바꿀 관점", "직업명보다 반복되는 경험을 보세요."),
            ("06", "저장 포인트", "진로는 직업명보다 경험 데이터에서 먼저 보입니다."),
        ],
        "expert": {
            "news_frame": "진로교육은 직업 정보를 많이 아는 것보다 아이가 어떤 경험에서 에너지를 쓰는지 읽는 방향으로 봐야 합니다.",
            "must_know": "진로 단서는 거창한 꿈 선언보다 반복 행동, 맡는 역할, 몰입 시간이 훨씬 안정적으로 보여줍니다.",
            "avoid": "직업명을 빨리 정하게 하면 부모는 잠깐 안심하지만 아이의 실제 강점 패턴은 가려질 수 있습니다.",
            "check": "부모가 알아야 할 포인트는 진로가 한 번의 대답으로 정해지는 것이 아니라, 반복되는 경험이 쌓이며 방향을 만든다는 점입니다.",
            "use_for": "이 관점을 알면 ‘꿈이 없다’는 말에 덜 흔들리고, 아이의 경험을 진로 데이터로 볼 수 있습니다.",
        },
    },
]


def kst_today() -> str:
    return datetime.now(KST).date().isoformat()


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def recent_published_slugs(date_text: str) -> set[str]:
    log = read_json(PUBLISH_LOG, [])
    if not isinstance(log, list):
        return set()

    try:
        target_date = datetime.fromisoformat(date_text).date()
    except ValueError:
        target_date = datetime.now(KST).date()

    topic_slugs = {topic["slug"] for topic in TOPICS}
    legacy_map = {
        **LEGACY_SLUG_ALIASES,
        "GHA-20260522-lunch-career-no-dream": "career-pattern-before-job",
        "GHA-20260523-afternoon-digital-literacy": "digital-literacy-source-check",
        "GHA-20260524-afternoon-ai-class-check": "ai-class-evidence",
    }
    recent: set[str] = set()

    for item in log:
        if not isinstance(item, dict):
            continue
        if str(item.get("status") or "").startswith("deleted_"):
            continue
        published_at = str(item.get("published_at") or "")
        try:
            published_date = datetime.fromisoformat(published_at.replace("Z", "+00:00")).astimezone(KST).date()
        except ValueError:
            continue
        if not (timedelta(days=0) <= target_date - published_date <= timedelta(days=RECENT_DEDUPE_DAYS)):
            continue

        draft_id = str(item.get("draft_id") or "")
        slug = legacy_map.get(draft_id)
        if not slug:
            slug = next((candidate for candidate in topic_slugs if candidate in draft_id), "")
        if slug:
            recent.add(slug)
    return recent


def pick_topic(date_text: str, slot: str) -> dict:
    seed_offsets = {"lunch": 0, "afternoon": 0, "evening": 1, "night": 1}
    seed = int(date_text.replace("-", "")) + seed_offsets.get(slot, 0)
    recent_slugs = recent_published_slugs(date_text)
    for offset in range(len(TOPICS)):
        topic = TOPICS[(seed + offset) % len(TOPICS)]
        if topic["slug"] not in recent_slugs:
            return topic
    return TOPICS[seed % len(TOPICS)]


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
        request = urllib.request.Request(source_url, headers={"User-Agent": "Mozilla/5.0 jayssam-threads-automation/1.0"})
        with urllib.request.urlopen(request, timeout=8) as response:
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
    for item in items:
        pub_date = (item.findtext("pubDate") or "").strip()
        if is_recent_pub_date(pub_date):
            return {
                "title": (item.findtext("title") or "").strip(),
                "link": (item.findtext("link") or "").strip(),
                "pub_date": pub_date,
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
) -> int:
    x, y = xy
    for line in wrap_by_width(draw, text, fnt, max_width):
        draw.text((x, y), line, font=fnt, fill=fill)
        bbox = draw.textbbox((x, y), line or "가", font=fnt)
        y += (bbox[3] - bbox[1]) + line_gap
    return y


def text_width(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0]


def draw_card_background(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, 1080, 1080), fill="#f7f7f4")
    draw.rounded_rectangle((44, 44, 1036, 1036), radius=34, fill="#ffffff")
    draw.rectangle((44, 44, 1036, 136), fill="#edf0f4")
    draw.ellipse((82, 78, 102, 98), fill="#7B6CFF")
    draw.ellipse((112, 78, 132, 98), fill="#55B86B")
    draw.ellipse((142, 78, 162, 98), fill="#FFBC42")
    draw.rounded_rectangle((190, 72, 860, 104), radius=16, fill="#ffffff")
    draw.text((218, 78), "jayssam / future education insight", font=font(21), fill="#a0a5ad")


def draw_badge(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, fg: str = "#ffffff") -> None:
    fnt = font(24, True)
    w = text_width(draw, text, fnt) + 38
    draw.rounded_rectangle((x, y, x + w, y + 42), radius=18, fill=fill)
    draw.text((x + 19, y + 8), text, font=fnt, fill=fg)


def draw_rows(draw: ImageDraw.ImageDraw, rows: list[tuple[str, str]], y: int, accent: str) -> int:
    for label, text in rows:
        draw.rounded_rectangle((82, y, 998, y + 96), radius=18, fill="#f5f6f8", outline="#e5e7eb", width=2)
        draw_badge(draw, 110, y + 26, label, accent)
        draw_multiline(draw, (250, y + 24), text, font(31, True), "#161616", 700, 10)
        y += 118
    return y


def slide_payload(topic: dict, index: int, label: str, heading: str, body: str) -> dict:
    expert = topic["expert"]
    slug = topic["slug"]
    if index == 1:
        return {
            "kind": "cover",
            "eyebrow": topic["keyword"],
            "title": heading,
            "subtitle": body,
            "footer": "넘겨보면 교육을 해석하는 기준이 나옵니다.",
        }
    if index == 2:
        return {
            "kind": "compare",
            "title": "겉보기와 실제 기준",
            "rows": [
                ("겉보기", "결과물이 빠르고 화려한가"),
                ("실제", expert["must_know"]),
            ],
        }
    if index == 3:
        return {
            "kind": "checklist",
            "title": "현장에서 볼 증거",
            "rows": checklist_rows(slug),
        }
    if index == 4:
        return {
            "kind": "warning",
            "title": "이걸 놓치면 생기는 문제",
            "rows": [
                ("주의", expert["avoid"]),
                ("기준", expert["check"]),
            ],
        }
    if index == 5:
        return {
            "kind": "lens",
            "title": "관점이 바뀌는 지점",
            "rows": lens_rows(slug),
        }
    return {
        "kind": "summary",
        "title": "저장용 정리",
        "rows": [
            ("부모", parent_takeaway(slug)),
            ("강사", instructor_takeaway(slug)),
            ("한 줄", body),
        ],
    }


def checklist_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-class-evidence": [
            ("1", "질문을 수정한 기록이 있는가"),
            ("2", "AI 답을 비교한 과정이 있는가"),
            ("3", "판단 기준을 말로 설명했는가"),
        ],
        "digital-literacy-source-check": [
            ("1", "출처를 확인했는가"),
            ("2", "작성 시점을 확인했는가"),
            ("3", "반대 자료를 함께 봤는가"),
        ],
        "info-curriculum-thinking": [
            ("1", "조건을 나누어 설명했는가"),
            ("2", "오류 수정 근거를 말했는가"),
            ("3", "다른 해결 방법을 비교했는가"),
        ],
        "career-pattern-before-job": [
            ("1", "반복해서 고르는 경험이 있는가"),
            ("2", "오래 붙잡는 문제가 있는가"),
            ("3", "자주 맡는 역할이 있는가"),
        ],
    }
    return data.get(slug, [])


def lens_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-class-evidence": [
            ("전", "AI를 썼는가"),
            ("후", "AI 답을 검토하고 수정했는가"),
            ("핵심", "도구 경험보다 판단 경험"),
        ],
        "digital-literacy-source-check": [
            ("전", "자료를 많이 찾았는가"),
            ("후", "출처와 관점을 따져봤는가"),
            ("핵심", "검색량보다 검증 흔적"),
        ],
        "info-curriculum-thinking": [
            ("전", "진도를 어디까지 나갔는가"),
            ("후", "오류를 어떤 근거로 고쳤는가"),
            ("핵심", "진도보다 설명 가능성"),
        ],
        "career-pattern-before-job": [
            ("전", "장래희망이 무엇인가"),
            ("후", "반복되는 선택 패턴이 무엇인가"),
            ("핵심", "직업명보다 경험 데이터"),
        ],
    }
    return data.get(slug, [])


def parent_takeaway(slug: str) -> str:
    data = {
        "ai-class-evidence": "툴 이름보다 질문-비교-판단 기록을 보세요.",
        "digital-literacy-source-check": "검색 결과보다 출처와 근거를 확인하세요.",
        "info-curriculum-thinking": "진도표보다 설명 시간과 디버깅 기록을 보세요.",
        "career-pattern-before-job": "직업명보다 반복 행동의 패턴을 보세요.",
    }
    return data.get(slug, "결과보다 과정의 증거를 보세요.")


def instructor_takeaway(slug: str) -> str:
    data = {
        "ai-class-evidence": "AI 활동마다 판단 근거를 남기게 설계하세요.",
        "digital-literacy-source-check": "출처-시점-관점 검토를 평가표에 넣으세요.",
        "info-curriculum-thinking": "오류 수정 과정을 말하게 하는 시간을 넣으세요.",
        "career-pattern-before-job": "반복 행동을 읽는 활동으로 수업을 여세요.",
    }
    return data.get(slug, "관찰 가능한 기준을 수업 안에 넣으세요.")


def footer_line(index: int) -> str:
    lines = {
        2: "겉보기 기준에서 실제 교육 기준으로 옮겨갑니다.",
        3: "세 항목 중 두 개 이상이 보여야 수업의 질을 판단할 수 있습니다.",
        4: "주의점은 수업 선택에서 바로 걸러내는 기준입니다.",
        5: "관점이 바뀌면 같은 장면도 다르게 보입니다.",
        6: "부모와 강사가 각각 다르게 써먹을 수 있게 정리했습니다.",
    }
    return lines.get(index, "현장 기준으로 보면 여기서 차이가 납니다.")


def make_card(out: Path, topic: dict, index: int, total: int, label: str, heading: str, body: str) -> None:
    img = Image.new("RGB", (1080, 1080), "#f7f7f4")
    draw = ImageDraw.Draw(img)
    accent = "#6C5CE7"
    black = "#161616"
    gray = "#8d939c"

    draw_card_background(draw)
    payload = slide_payload(topic, index, label, heading, body)
    draw.text((82, 174), f"Chapter {label}.", font=font(32, True), fill=accent)
    draw.text((944, 172), f"{index}/{total}", font=font(28, True), fill=gray)

    heading_text = payload["title"]
    heading_font = font(62 if len(heading_text) < 22 else 52, True)
    y = draw_multiline(draw, (82, 276), heading_text, heading_font, black, 884, 14)
    y += 26
    draw.rounded_rectangle((82, y, 998, y + 3), radius=2, fill="#e3e5ea")

    y += 48
    if payload["kind"] == "cover":
        draw_badge(draw, 92, y, payload["eyebrow"], accent)
        y += 74
        draw_multiline(draw, (92, y), payload["subtitle"], font(38, True), black, 850, 18)
        draw_multiline(draw, (92, 820), payload["footer"], font(34, True), accent, 850, 14)
    else:
        draw_rows(draw, payload["rows"], y, accent)

    if index in {2, 3, 4, 5, 6}:
        draw.rounded_rectangle((86, 858, 994, 930), radius=20, fill="#eeeaff")
        draw.text((122, 876), footer_line(index), font=font(29, True), fill=accent)

    draw.text((82, 980), "JAYSSAM FUTURE EDUCATION", font=font(24, True), fill="#a0a5ad")
    draw.text((690, 980), f"{topic['keyword']} / source checked", font=font(22), fill="#a0a5ad")
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


def content_type_for_slot(slot: str) -> str:
    return "must_know_practical_tip" if slot == "night" else "education_news_interpretation"


def build_threads_text_parts(topic: dict, latest_signal: dict | None, content_type: str) -> list[str]:
    expert = topic["expert"]
    if content_type == "education_news_interpretation":
        parts = [
            topic["hook"],
            latest_signal and f"오늘 참고한 이슈는 “{latest_signal['title']}”입니다.",
            expert["news_frame"],
            expert["must_know"],
            expert["check"],
            "뉴스를 외우는 것보다, 이 흐름을 어떤 교육 기준으로 해석할지가 더 중요합니다.",
        ]
    else:
        parts = [
            topic["hook"],
            "이건 그냥 알아두면 좋은 정보가 아니라, 교육 장면을 해석하는 기준입니다.",
            expert["must_know"],
            expert["avoid"],
            expert["check"],
            expert["use_for"],
        ]
    return [part for part in parts if part]


def write_draft(topic: dict, date_text: str, slot: str, card_dir: Path, media_paths: list[str]) -> Path:
    draft_id = f"GHA-{date_text.replace('-', '')}-{slot}-{topic['slug']}"
    out_dir = OUT_ROOT / date_text
    out_dir.mkdir(parents=True, exist_ok=True)

    latest_signal = fetch_latest_signal()
    content_type = content_type_for_slot(slot)
    text_parts = build_threads_text_parts(topic, latest_signal, content_type)
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
        "expert_angle": topic["expert"],
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


def slide_payload(topic: dict, index: int, label: str, heading: str, body: str) -> dict:
    expert = topic["expert"]
    slug = topic["slug"]
    if index == 1:
        return {
            "kind": "cover",
            "eyebrow": topic["keyword"],
            "title": heading,
            "subtitle": body,
            "footer": "넘겨보면 교육 흐름의 핵심만 정리됩니다.",
        }
    if index == 2:
        return {
            "kind": "compare",
            "title": "흔한 해석과 진짜 의미",
            "rows": [
                ("오해", parent_misread(slug)),
                ("실제", expert["must_know"]),
            ],
        }
    if index == 3:
        return {
            "kind": "checklist",
            "title": "지금 중요해지는 역량",
            "rows": checklist_rows(slug),
        }
    if index == 4:
        return {
            "kind": "warning",
            "title": "모르면 놓치는 지점",
            "rows": [
                ("주의", expert["avoid"]),
                ("신호", expert["check"]),
            ],
        }
    if index == 5:
        return {
            "kind": "lens",
            "title": "관점이 바뀌는 지점",
            "rows": lens_rows(slug),
        }
    return {
        "kind": "summary",
        "title": "저장용 핵심 정리",
        "rows": [
            ("흐름", trend_takeaway(slug)),
            ("핵심", parent_takeaway(slug)),
            ("의미", body),
        ],
    }


def parent_misread(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "AI 도구를 많이 다루면 앞서가는 것처럼 보입니다.",
        "digital-literacy-parent-source": "검색을 빨리 하면 정보를 잘 다루는 것처럼 보입니다.",
        "informatics-parent-why": "코딩 진도가 빠르면 정보교과를 잘하는 것처럼 보입니다.",
        "career-parent-no-dream": "직업명을 빨리 정해야 진로가 있는 것처럼 보입니다.",
    }
    return data.get(slug, "겉으로 보이는 결과만 보면 핵심을 놓칠 수 있습니다.")


def checklist_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-parent-thinking-trace": [
            ("1", "목적에 맞게 질문을 설계하는 힘"),
            ("2", "AI 결과의 오류를 걸러내는 힘"),
            ("3", "판단 기준을 세워 수정하는 힘"),
        ],
        "digital-literacy-parent-source": [
            ("1", "출처의 신뢰도를 읽는 힘"),
            ("2", "자료의 시점과 맥락을 보는 힘"),
            ("3", "관점과 의도를 구분하는 힘"),
        ],
        "informatics-parent-why": [
            ("1", "문제를 구조화하는 힘"),
            ("2", "절차를 논리적으로 설계하는 힘"),
            ("3", "오류를 분석해 개선하는 힘"),
        ],
        "career-parent-no-dream": [
            ("1", "경험에서 패턴을 읽는 힘"),
            ("2", "역할과 몰입의 방향을 보는 힘"),
            ("3", "직업 변화 속에서도 남는 강점을 찾는 힘"),
        ],
    }
    return data.get(slug, [])


def lens_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-parent-thinking-trace": [
            ("전", "AI 도구 사용 경험"),
            ("후", "AI 결과 검토 능력"),
            ("핵심", "도구 격차보다 판단 격차"),
        ],
        "digital-literacy-parent-source": [
            ("전", "정보를 찾는 속도"),
            ("후", "정보를 걸러내는 기준"),
            ("핵심", "검색 격차보다 검증 격차"),
        ],
        "informatics-parent-why": [
            ("전", "코딩 진도와 문법"),
            ("후", "문제 구조화와 오류 분석"),
            ("핵심", "기술 격차보다 사고 격차"),
        ],
        "career-parent-no-dream": [
            ("전", "장래희망 직업명"),
            ("후", "반복되는 경험 데이터"),
            ("핵심", "선언보다 패턴"),
        ],
    }
    return data.get(slug, [])


def trend_takeaway(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "AI 교육은 사용법에서 판단력으로 이동하고 있습니다.",
        "digital-literacy-parent-source": "디지털문해력은 검색력에서 검증력으로 이동하고 있습니다.",
        "informatics-parent-why": "정보교과는 코딩 진도에서 문제해결 언어로 이동하고 있습니다.",
        "career-parent-no-dream": "진로교육은 직업명에서 경험 패턴으로 이동하고 있습니다.",
    }
    return data.get(slug, "교육 흐름은 겉보기 결과보다 사고력 중심으로 이동하고 있습니다.")


def parent_takeaway(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "핵심은 도구 이름이 아니라 결과를 판단하는 기준입니다.",
        "digital-literacy-parent-source": "핵심은 정보량이 아니라 정보의 질을 가르는 기준입니다.",
        "informatics-parent-why": "핵심은 코딩 속도가 아니라 문제를 구조화하는 방식입니다.",
        "career-parent-no-dream": "핵심은 꿈의 유무가 아니라 경험이 쌓이는 방향입니다.",
    }
    return data.get(slug, "결과보다 아이가 생각한 흔적을 보세요.")


def footer_line(index: int) -> str:
    lines = {
        2: "겉으로 보이는 변화와 실제 교육 의미는 다를 수 있습니다.",
        3: "지금 교육에서 중요해지는 역량만 뽑았습니다.",
        4: "모르면 광고 문구와 교육 흐름을 구분하기 어렵습니다.",
        5: "관점이 바뀌면 같은 교육 이슈도 다르게 읽힙니다.",
        6: "저장해두고 교육 흐름을 볼 때 기준으로 쓰세요.",
    }
    return lines.get(index, "부모 관점으로 보면 놓치던 신호가 보입니다.")


def build_threads_text_parts(topic: dict, latest_signal: dict | None, content_type: str) -> list[str]:
    expert = topic["expert"]
    if content_type == "education_news_interpretation":
        parts = [
            topic["hook"],
            latest_signal and f"오늘 참고한 교육 이슈는 ‘{latest_signal['title']}’입니다.",
            expert["news_frame"],
            "이 흐름을 ‘무엇을 더 시켜야 하나’로만 보면 핵심을 놓치기 쉽습니다.",
            expert["must_know"],
            expert["check"],
            "핵심은 더 많이 시키는 것이 아니라, 지금 교육이 어떤 역량을 요구하는지 정확히 읽는 것입니다.",
        ]
    else:
        parts = [
            topic["hook"],
            "이건 단순한 교육 정보가 아니라, 교육 흐름을 읽을 때 놓치기 쉬운 기준입니다.",
            expert["must_know"],
            expert["avoid"],
            expert["check"],
            expert["use_for"],
        ]
    return [part for part in parts if part]


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (os.sys.argv[1] if len(os.sys.argv) > 1 else kst_today())
    slot = os.environ.get("JAYSSAM_SLOT") or (os.sys.argv[2] if len(os.sys.argv) > 2 else "afternoon")
    topic = pick_topic(date_text, slot)
    card_dir, media_paths = generate_cards(topic, date_text, slot)
    draft_path = write_draft(topic, date_text, slot, card_dir, media_paths)
    print(draft_path)


if __name__ == "__main__":
    main()
