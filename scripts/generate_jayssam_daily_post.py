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
        "title": "AI가 교실에 들어올수록, 아이에게 더 중요해지는 것은 ‘판단하는 힘’입니다",
        "source_name": "교육부 AI 디지털 기반 교육혁신 방향 / AI 디지털교과서 정책 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI가 교실에 들어온다는 말은\n생각보다 조용한 변화를 뜻합니다.",
        "body": [
            "겉으로는 새로운 도구가 들어오는 것처럼 보이지만, 실제로 흔들리는 것은 공부의 순서입니다.",
            "예전에는 답을 찾는 시간이 길었습니다. 이제는 답이 너무 빨리 도착합니다. 그래서 교육의 무게는 ‘찾기’에서 ‘판단하기’로 옮겨갑니다.",
            "아이에게 남아야 할 것은 특정 프로그램 이름이 아니라, 답을 의심하고 고치고 자기 기준으로 설명하는 경험입니다.",
        ],
        "slides": [
            ("01", "교실에 들어온 AI", "새 도구보다 먼저 바뀌는 것은 공부의 순서입니다."),
            ("02", "표면", "아이들이 더 빨리 답을 얻습니다."),
            ("03", "본질", "그래서 더 중요해지는 것은 답을 판단하는 힘입니다."),
            ("04", "교육의 장면", "좋은 배움은 결과물보다 수정의 흔적을 남깁니다."),
            ("05", "놓치기 쉬운 것", "화려한 산출물이 곧 깊은 이해는 아닙니다."),
            ("06", "남는 문장", "AI 시대의 공부는 답을 받는 법보다 답을 다루는 법에 가깝습니다."),
        ],
        "expert": {
            "news_frame": "AI 교육 확대는 기술 수업이 하나 더 생긴다는 소식으로만 읽기 어렵습니다. 답을 구하는 방식이 달라지면서, 배움의 중심이 결과에서 판단 과정으로 이동하는 장면입니다.",
            "must_know": "앞으로 차이를 만드는 것은 프롬프트 문장 몇 개가 아니라, 목적에 맞게 묻고 결과의 빈틈을 읽어내는 기준입니다.",
            "avoid": "AI 산출물이 근사하다는 이유만으로 배움이 깊어졌다고 보기는 어렵습니다. 완성물은 빠르게 만들어질 수 있지만, 판단력은 천천히 쌓입니다.",
            "check": "이 변화의 핵심은 ‘아이들이 AI를 얼마나 쓰는가’보다 ‘AI가 준 답을 어떻게 대하는가’에 있습니다.",
            "use_for": "그래서 AI 교육은 도구 교육이라기보다, 넘쳐나는 답 앞에서 자기 기준을 세우는 교육에 가깝습니다.",
        },
    },
    {
        "slug": "digital-literacy-parent-source",
        "keyword": "디지털문해력",
        "title": "정보가 넘치는 시대, 공부의 격차는 ‘무엇을 믿는가’에서 벌어집니다",
        "source_name": "디지털 소양 교육 방향 / 학교 현장 미디어 리터러시 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "아이들은 이제 정보를 못 찾아서 막히지 않습니다.\n오히려 너무 쉽게 믿어서 흔들립니다.",
        "body": [
            "검색창과 AI는 아이들에게 빠른 답을 줍니다. 하지만 빠른 답이 늘 좋은 답은 아닙니다.",
            "디지털문해력은 자료를 많이 찾는 기술이 아니라, 누가 어떤 의도로 말하는지 읽어내는 힘에 가깝습니다.",
            "정보의 양이 많아질수록 공부의 핵심은 더 많이 아는 쪽이 아니라, 덜 속고 더 정확히 판단하는 쪽으로 이동합니다.",
        ],
        "slides": [
            ("01", "정보가 넘치는 시대", "공부의 격차는 ‘무엇을 믿는가’에서 벌어집니다."),
            ("02", "표면", "아이들은 더 많은 자료를 더 빨리 찾습니다."),
            ("03", "본질", "중요한 것은 정보량이 아니라 신뢰도를 읽는 힘입니다."),
            ("04", "교육의 장면", "출처와 시점과 관점을 보는 습관이 사고를 단단하게 만듭니다."),
            ("05", "놓치기 쉬운 것", "그럴듯한 문장은 진짜 근거처럼 보일 수 있습니다."),
            ("06", "남는 문장", "디지털문해력은 검색 능력이 아니라 덜 속는 능력입니다."),
        ],
        "expert": {
            "news_frame": "디지털 교육의 핵심은 기기를 능숙하게 다루는 데서 멈추지 않습니다. 정보가 많아질수록, 아이에게 필요한 것은 정보를 고르는 기준입니다.",
            "must_know": "디지털문해력은 검색 속도가 아니라 출처, 시점, 관점, 반대 근거를 함께 읽는 힘입니다.",
            "avoid": "자료를 많이 모았다는 사실만으로 탐구가 깊어졌다고 보기는 어렵습니다. 정보 소비와 정보 판단은 다른 능력입니다.",
            "check": "이 변화의 핵심은 ‘얼마나 찾았는가’보다 ‘왜 그것을 믿을 수 있는가’에 있습니다.",
            "use_for": "결국 디지털문해력은 화면을 잘 다루는 기술이 아니라, 말과 자료와 숫자 앞에서 쉽게 휩쓸리지 않는 태도입니다.",
        },
    },
    {
        "slug": "informatics-parent-why",
        "keyword": "정보교과",
        "title": "정보교과가 커진다는 것은, 아이들이 문제를 설명하는 언어를 배운다는 뜻입니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": ["https://www.moe.go.kr/", "https://www.korea.kr/news/policyNewsView.do?newsId=148905079"],
        "hook": "정보교과가 커진다는 말은\n코딩 진도가 빨라진다는 뜻만은 아닙니다.",
        "body": [
            "코딩은 눈에 잘 보입니다. 그래서 정보교과 이야기가 나오면 사람들은 먼저 진도와 언어 이름을 떠올립니다.",
            "하지만 학교가 길게 보고 키우려는 것은 특정 문법보다 문제를 나누고, 절차를 세우고, 오류를 고쳐가는 사고의 언어입니다.",
            "정보교과는 컴퓨터를 잘 다루는 과목을 넘어, 복잡한 문제를 설명 가능한 형태로 바꾸는 훈련에 가까워지고 있습니다.",
        ],
        "slides": [
            ("01", "정보교과가 커진다는 것", "아이들이 문제를 설명하는 언어를 배운다는 뜻입니다."),
            ("02", "표면", "코딩 시간이 늘어나는 것처럼 보입니다."),
            ("03", "본질", "문제를 나누고 절차로 바꾸는 사고가 중요해집니다."),
            ("04", "교육의 장면", "오류는 실패가 아니라 생각을 고치는 재료가 됩니다."),
            ("05", "놓치기 쉬운 것", "빠른 진도는 깊은 이해를 대신하지 못합니다."),
            ("06", "남는 문장", "정보교과는 코드보다 문제를 다루는 언어에 가깝습니다."),
        ],
        "expert": {
            "news_frame": "정보교육 강화는 코딩 자체를 더 많이 하자는 흐름으로만 읽기 어렵습니다. 학교가 문제를 구조화하고 설명하는 언어를 더 중요하게 보기 시작했다는 신호입니다.",
            "must_know": "코딩을 배운다는 말은 문법을 외운다는 뜻보다, 조건과 순서와 반복과 오류를 다루는 사고방식을 익힌다는 뜻에 가깝습니다.",
            "avoid": "진도만 빠르면 초반에는 잘하는 것처럼 보일 수 있습니다. 그러나 낯선 문제 앞에서 필요한 것은 외운 문법보다 문제를 다시 쪼개는 힘입니다.",
            "check": "이 변화의 핵심은 ‘무슨 언어를 배웠는가’보다 ‘문제를 어떤 구조로 이해하는가’에 있습니다.",
            "use_for": "그래서 정보교과는 코딩 기술 과목이라기보다, 복잡한 세상을 절차와 구조로 읽는 훈련에 가깝습니다.",
        },
    },
    {
        "slug": "career-parent-no-dream",
        "keyword": "진로",
        "title": "꿈이 없다는 말 뒤에는, 아직 이름 붙지 않은 경험들이 숨어 있습니다",
        "source_name": "커리어넷 진로교육 자료 흐름 / 현장 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "아이가 꿈이 없다고 말할 때,\n그 말만으로 진로가 비어 있다고 보기는 어렵습니다.",
        "body": [
            "진로를 직업명 하나로 말하던 시대에는 ‘꿈이 없다’는 말이 크게 들렸습니다.",
            "하지만 지금의 진로는 이름보다 경험의 방향에서 먼저 보이는 경우가 많습니다. 오래 붙잡는 문제, 자주 맡는 역할, 반복해서 고르는 활동이 단서가 됩니다.",
            "아직 직업명으로 정리되지 않았을 뿐, 아이의 경험 안에는 이미 여러 방향의 데이터가 쌓이고 있을 수 있습니다.",
        ],
        "slides": [
            ("01", "꿈이 없다는 말", "진로가 비어 있다는 뜻은 아닐 수 있습니다."),
            ("02", "표면", "아이에게 아직 직업명이 없을 수 있습니다."),
            ("03", "본질", "그러나 경험은 이미 방향을 만들고 있을 수 있습니다."),
            ("04", "교육의 장면", "오래 붙잡는 문제와 반복되는 역할이 단서가 됩니다."),
            ("05", "놓치기 쉬운 것", "빨리 정한 꿈이 늘 깊은 진로는 아닙니다."),
            ("06", "남는 문장", "진로는 선언보다 반복된 경험에서 먼저 자랍니다."),
        ],
        "expert": {
            "news_frame": "진로교육은 직업 정보를 빨리 외우는 과정이 아니라, 아이가 어떤 경험에서 오래 머무는지 읽어내는 과정에 가까워지고 있습니다.",
            "must_know": "진로 단서는 거창한 꿈 선언보다 반복되는 선택, 맡게 되는 역할, 몰입 시간이 더 안정적으로 보여줍니다.",
            "avoid": "직업명을 빨리 정하면 잠깐 안심될 수 있습니다. 하지만 너무 이른 이름 붙이기는 아이의 실제 경험 패턴을 가릴 수 있습니다.",
            "check": "이 변화의 핵심은 ‘무엇이 되고 싶니’라는 한 번의 대답보다, 시간이 지나도 반복해서 남는 경험을 읽는 데 있습니다.",
            "use_for": "그래서 꿈이 없다는 말은 결론이 아니라, 아직 이름 붙지 않은 경험들을 더 섬세하게 읽어야 한다는 신호일 수 있습니다.",
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
            "footer": "짧지만 깊게 읽는 미래교육 칼럼입니다.",
        }
    if index == 2:
        return {
            "kind": "compare",
            "title": "표면과 본질",
            "rows": [
                ("오해", parent_misread(slug)),
                ("실제", expert["must_know"]),
            ],
        }
    if index == 3:
        return {
            "kind": "checklist",
            "title": "교육이 향하는 곳",
            "rows": checklist_rows(slug),
        }
    if index == 4:
        return {
            "kind": "warning",
            "title": "놓치기 쉬운 문장",
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
            ("본질", parent_takeaway(slug)),
            ("문장", body),
        ],
    }


def parent_misread(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "새로운 도구가 들어오면 기술 수업처럼 보입니다.",
        "digital-literacy-parent-source": "자료가 많아지면 공부가 깊어진 것처럼 보입니다.",
        "informatics-parent-why": "코드를 빨리 쓰면 정보교과를 잘하는 것처럼 보입니다.",
        "career-parent-no-dream": "직업명을 말하지 못하면 진로가 없는 것처럼 보입니다.",
    }
    return data.get(slug, "겉으로 보이는 장면과 실제 교육의 본질은 다를 수 있습니다.")


def checklist_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-parent-thinking-trace": [
            ("1", "답을 빨리 받는 능력보다"),
            ("2", "답의 빈틈을 읽어내는 힘"),
            ("3", "자기 기준으로 고치는 경험"),
        ],
        "digital-literacy-parent-source": [
            ("1", "자료의 양보다"),
            ("2", "말하는 사람의 위치를 읽는 힘"),
            ("3", "그럴듯한 정보를 의심하는 감각"),
        ],
        "informatics-parent-why": [
            ("1", "코드의 길이보다"),
            ("2", "문제를 나누어 보는 힘"),
            ("3", "오류를 통해 생각을 고치는 경험"),
        ],
        "career-parent-no-dream": [
            ("1", "직업명보다"),
            ("2", "반복되는 선택과 역할"),
            ("3", "시간이 지나도 남는 몰입의 방향"),
        ],
    }
    return data.get(slug, [])


def lens_rows(slug: str) -> list[tuple[str, str]]:
    data = {
        "ai-parent-thinking-trace": [
            ("전", "도구를 익히는 교육"),
            ("후", "답을 다루는 교육"),
            ("핵심", "기술보다 기준"),
        ],
        "digital-literacy-parent-source": [
            ("전", "검색하는 아이"),
            ("후", "걸러내는 아이"),
            ("핵심", "정보보다 판단"),
        ],
        "informatics-parent-why": [
            ("전", "코드를 쓰는 수업"),
            ("후", "문제를 번역하는 수업"),
            ("핵심", "문법보다 구조"),
        ],
        "career-parent-no-dream": [
            ("전", "꿈을 말하는 아이"),
            ("후", "경험이 쌓이는 아이"),
            ("핵심", "이름보다 방향"),
        ],
    }
    return data.get(slug, [])


def trend_takeaway(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "AI 교육은 도구 사용법에서 답을 다루는 기준으로 이동하고 있습니다.",
        "digital-literacy-parent-source": "디지털문해력은 정보 검색에서 정보 판단으로 이동하고 있습니다.",
        "informatics-parent-why": "정보교과는 코딩 진도에서 문제를 번역하는 힘으로 이동하고 있습니다.",
        "career-parent-no-dream": "진로교육은 직업명에서 경험의 방향을 읽는 일로 이동하고 있습니다.",
    }
    return data.get(slug, "교육 흐름은 겉보기 결과보다 사고력 중심으로 이동하고 있습니다.")


def parent_takeaway(slug: str) -> str:
    data = {
        "ai-parent-thinking-trace": "핵심은 AI를 쓰는 장면이 아니라 AI의 답을 대하는 태도입니다.",
        "digital-literacy-parent-source": "핵심은 많이 아는 장면이 아니라 무엇을 믿는지 고르는 힘입니다.",
        "informatics-parent-why": "핵심은 코드를 쓰는 장면이 아니라 문제를 구조로 바꾸는 힘입니다.",
        "career-parent-no-dream": "핵심은 꿈을 말하는 순간이 아니라 경험이 방향을 갖는 시간입니다.",
    }
    return data.get(slug, "결과보다 아이가 생각한 흔적을 보세요.")


def footer_line(index: int) -> str:
    lines = {
        2: "겉으로 보이는 장면 아래에서 교육의 방향이 바뀝니다.",
        3: "중요한 것은 기능보다 아이에게 남는 사고의 형태입니다.",
        4: "좋은 문장은 불안을 키우지 않고 관점을 바꿉니다.",
        5: "같은 이슈도 어떤 언어로 읽느냐에 따라 전혀 다르게 보입니다.",
        6: "짧게 저장해두고 오래 꺼내 읽을 문장으로 정리했습니다.",
    }
    return lines.get(index, "부모 관점으로 보면 놓치던 신호가 보입니다.")


def build_threads_text_parts(topic: dict, latest_signal: dict | None, content_type: str) -> list[str]:
    expert = topic["expert"]
    if content_type == "education_news_interpretation":
        parts = [
            topic["hook"],
            latest_signal and "최근 교육 이슈를 보면, 같은 방향의 변화가 계속 반복해서 보입니다.",
            expert["news_frame"],
            expert["must_know"],
            expert["check"],
            "교육의 변화는 늘 큰 구호보다 작은 장면에서 먼저 보입니다. 그래서 중요한 건 유행어를 따라가는 일이 아니라, 그 안에서 아이에게 남을 힘을 읽어내는 일입니다.",
        ]
    else:
        parts = [
            topic["hook"],
            "이 이야기는 단순한 교육 정보라기보다, 요즘 교육을 읽는 하나의 렌즈에 가깝습니다.",
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
