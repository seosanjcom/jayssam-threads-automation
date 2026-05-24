from __future__ import annotations

import json
import os
import random
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
        "title": "AI 디지털교과서 논의는 이제 ‘AI 교육자료’라는 더 넓은 틀로 봐야 합니다",
        "source_name": "교육부 AI 디지털 기반 교육혁신 방향 / 2026 교육부 업무계획의 AI 교육자료 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "AI 디지털교과서를 볼 때\n이제는 ‘교과서냐 아니냐’만 보면 부족합니다.",
        "body": [
            "처음에는 AI 디지털교과서가 수학·영어·정보·특수교육 국어를 중심으로 논의됐습니다. 그런데 최근 정책 문맥은 더 넓어졌습니다.",
            "교육부는 AI 교육자료를 구 AI 디지털교과서, 코스웨어, 에듀테크 등을 포함하는 말로 쓰고 있습니다. 핵심이 ‘한 권의 교과서’에서 ‘학습을 지원하는 AI 도구 묶음’으로 넓어진 것입니다.",
            "그래서 부모가 봐야 할 쟁점도 달라집니다. 화면 교과서냐 아니냐보다, 어떤 데이터가 남고 어떤 피드백이 아이에게 돌아오는지가 더 중요해집니다.",
        ],
        "slides": [
            ("01", "AI 교육자료", "AI 디지털교과서보다 넓은 틀로 봐야 합니다."),
            ("02", "정책 언어", "구 AI 디지털교과서, 코스웨어, 에듀테크까지 묶입니다."),
            ("03", "핵심", "한 권의 교과서보다 학습지원 도구 생태계에 가깝습니다."),
            ("04", "수업 변화", "풀이, 반복, 오답, 수준 변화가 데이터로 남습니다."),
            ("05", "놓치기 쉬운 것", "맞춤형이라는 말보다 피드백 기준이 중요합니다."),
            ("06", "남는 문장", "AI 교육자료의 본질은 화면이 아니라 학습 데이터와 피드백입니다."),
        ],
        "expert": {
            "news_frame": "AI 디지털교과서 논의는 이제 교과서 한 종류의 문제가 아니라 AI 교육자료 전반의 문제로 읽어야 합니다. 정책 언어도 구 AI 디지털교과서, 코스웨어, 에듀테크를 함께 묶는 쪽으로 넓어졌습니다.",
            "must_know": "AI 교육자료의 핵심은 콘텐츠 제공이 아니라 학생의 풀이, 반복, 오답, 수준 변화를 기록하고 피드백으로 연결하는 구조입니다.",
            "avoid": "‘맞춤형 학습’이라는 말만 보면 좋아 보이지만, 어떤 데이터가 수집되고 어떤 기준으로 피드백되는지를 보지 않으면 절반만 이해한 것입니다.",
            "check": "이 변화의 핵심은 ‘화면으로 공부한다’가 아니라 ‘학습 과정이 데이터로 남고 피드백으로 돌아온다’입니다.",
            "use_for": "그래서 AI 교육자료는 교재 변화가 아니라 평가와 피드백 방식의 변화로 읽어야 합니다.",
        },
    },
    {
        "slug": "digital-literacy-parent-source",
        "keyword": "디지털문해력",
        "title": "디지털문해력은 ‘검색’이 아니라 출처·시점·관점·이해관계를 읽는 능력입니다",
        "source_name": "디지털 소양 교육 방향 / 학교 현장 미디어 리터러시 흐름",
        "source_urls": ["https://www.moe.go.kr/"],
        "hook": "디지털문해력을 검색 능력으로 이해하면\n요즘 교육의 절반을 놓칩니다.",
        "body": [
            "검색과 AI가 쉬워질수록 아이들은 자료를 더 빨리 모읍니다. 문제는 자료의 양이 아니라 자료의 질입니다.",
            "디지털문해력에서 중요한 네 가지는 출처, 시점, 관점, 이해관계입니다. 누가 말했는지, 언제 말했는지, 어떤 입장에서 말했는지, 누구에게 유리한 정보인지 보는 힘입니다.",
            "탐구보고서와 발표의 질은 자료 개수보다 이 네 가지를 다룬 흔적에서 갈립니다.",
        ],
        "slides": [
            ("01", "디지털문해력", "검색 능력이 아니라 정보의 조건을 읽는 능력입니다."),
            ("02", "출처", "누가 만든 자료인지 확인해야 합니다."),
            ("03", "시점", "언제 나온 자료인지에 따라 의미가 달라집니다."),
            ("04", "관점", "어떤 입장에서 쓰였는지 읽어야 합니다."),
            ("05", "이해관계", "누구에게 유리한 정보인지 봐야 합니다."),
            ("06", "남는 문장", "자료를 많이 찾는 것과 정보를 제대로 읽는 것은 다릅니다."),
        ],
        "expert": {
            "news_frame": "디지털 교육의 핵심은 기기 활용보다 정보 판단으로 이동하고 있습니다. 특히 AI가 그럴듯한 문장을 빠르게 만들어내는 환경에서는 더 그렇습니다.",
            "must_know": "디지털문해력은 검색 속도가 아니라 출처, 시점, 관점, 이해관계를 함께 읽는 능력입니다.",
            "avoid": "자료를 많이 모았다는 사실만으로 탐구가 깊어졌다고 보기는 어렵습니다. 출처 없는 요약은 탐구가 아니라 복사에 가까워질 수 있습니다.",
            "check": "이 변화의 핵심은 ‘얼마나 찾았는가’보다 ‘그 자료를 믿을 조건이 있는가’입니다.",
            "use_for": "그래서 디지털문해력은 화면을 다루는 기술이 아니라, 말과 자료와 숫자의 신뢰도를 판단하는 학습 역량입니다.",
        },
    },
    {
        "slug": "informatics-parent-why",
        "keyword": "정보교과",
        "title": "2022 개정 교육과정에서 정보교육 확대는 코딩 열풍과 다른 이야기입니다",
        "source_name": "교육부 2022 개정 교육과정 / 정보교육 종합계획",
        "source_urls": ["https://www.moe.go.kr/", "https://www.korea.kr/news/policyNewsView.do?newsId=148905079"],
        "hook": "2022 개정 교육과정에서 정보교육은 확대됐지만,\n이걸 코딩 진도로만 보면 핵심을 놓칩니다.",
        "body": [
            "2022 개정 교육과정은 정보교육 확대를 분명히 담고 있습니다. 초등은 실과 안의 정보 영역, 중·고등은 정보 교과목과 학교자율시간을 통해 연결됩니다.",
            "그런데 이 변화의 핵심은 특정 언어를 빨리 배우는 것이 아닙니다. 문제를 나누고, 절차를 만들고, 오류를 수정하는 컴퓨팅 사고를 학교 교육 안에 더 깊게 넣는 것입니다.",
            "정보교과는 코딩을 배우는 과목을 넘어, 복잡한 문제를 구조화해 설명하는 언어를 배우는 과목에 가까워지고 있습니다.",
        ],
        "slides": [
            ("01", "정보교육 확대", "2022 개정 교육과정의 중요한 변화 중 하나입니다."),
            ("02", "초등", "실과 안에서 정보 영역 경험이 강화됩니다."),
            ("03", "중·고등", "정보 교과목과 학교자율시간으로 이어집니다."),
            ("04", "본질", "핵심은 코딩 진도가 아니라 컴퓨팅 사고입니다."),
            ("05", "컴퓨팅 사고", "문제를 나누고 절차화하고 오류를 수정하는 방식입니다."),
            ("06", "남는 문장", "정보교과는 코드를 외우는 과목이 아니라 문제를 구조화하는 과목입니다."),
        ],
        "expert": {
            "news_frame": "2022 개정 교육과정의 정보교육 확대는 코딩 사교육 확대와 같은 말이 아닙니다. 학교 교육과정 안에 디지털 기초소양과 컴퓨팅 사고를 더 명확히 넣는 변화입니다.",
            "must_know": "정보교과의 핵심은 문법 암기가 아니라 자료, 조건, 반복, 오류를 다루며 문제를 구조화하는 힘입니다.",
            "avoid": "진도만 빠르면 초반에는 잘하는 것처럼 보일 수 있습니다. 그러나 낯선 문제 앞에서 필요한 것은 외운 문법보다 문제를 다시 쪼개는 힘입니다.",
            "check": "이 변화의 핵심은 ‘무슨 언어를 배웠는가’보다 ‘문제를 어떤 구조로 이해하는가’입니다.",
            "use_for": "그래서 정보교과는 코딩 기술 과목이라기보다, 복잡한 문제를 절차와 구조로 읽는 기초 교과에 가깝습니다.",
        },
    },
    {
        "slug": "career-parent-no-dream",
        "keyword": "진로",
        "title": "진로교육에서 중요한 것은 직업명보다 ‘경험 데이터’를 읽는 일입니다",
        "source_name": "커리어넷 진로교육 자료 흐름 / 현장 진로교육 경험 기반",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "아이가 꿈이 없다고 말할 때,\n진로가 비어 있다고 단정하기는 이릅니다.",
        "body": [
            "진로교육에서 직업 정보는 여전히 필요합니다. 하지만 더 먼저 읽어야 할 것은 아이의 경험 데이터입니다.",
            "오래 붙잡는 문제, 자주 맡는 역할, 반복해서 선택하는 활동, 스스로 찾아보는 주제는 모두 진로 단서가 됩니다.",
            "아직 직업명으로 정리되지 않았을 뿐, 아이의 경험 안에는 흥미, 역량, 가치관의 흔적이 쌓이고 있을 수 있습니다.",
        ],
        "slides": [
            ("01", "진로교육의 관점", "직업명보다 경험 데이터를 먼저 읽어야 합니다."),
            ("02", "흥미", "아이가 오래 붙잡는 문제가 단서가 됩니다."),
            ("03", "역량", "자주 맡는 역할이 강점의 힌트가 됩니다."),
            ("04", "가치관", "반복해서 선택하는 활동이 방향을 보여줍니다."),
            ("05", "주의", "빨리 정한 직업명이 깊은 진로를 보장하지는 않습니다."),
            ("06", "남는 문장", "진로는 선언보다 경험의 반복에서 먼저 보입니다."),
        ],
        "expert": {
            "news_frame": "진로교육은 직업 정보를 많이 아는 것에서 끝나지 않습니다. 아이의 경험 속에서 흥미, 역량, 가치관이 어떻게 반복되는지 읽는 과정이 중요해지고 있습니다.",
            "must_know": "진로 단서는 거창한 꿈 선언보다 반복되는 선택, 맡게 되는 역할, 몰입 시간이 더 안정적으로 보여줍니다.",
            "avoid": "직업명을 빨리 정하면 잠깐 안심될 수 있습니다. 하지만 너무 이른 이름 붙이기는 아이의 실제 경험 패턴을 가릴 수 있습니다.",
            "check": "이 변화의 핵심은 ‘무엇이 되고 싶니’라는 한 번의 대답보다, 시간이 지나도 반복해서 남는 경험을 읽는 데 있습니다.",
            "use_for": "그래서 꿈이 없다는 말은 결론이 아니라, 아직 직업명으로 번역되지 않은 경험 데이터를 더 읽어야 한다는 신호일 수 있습니다.",
        },
    },
]


TOPICS = [
    {
        "slug": "careernet-free-tests",
        "keyword": "무료진로검사",
        "title": "아이 진로가 막막할 때, 커리어넷 무료 진로심리검사부터 확인해보세요",
        "source_name": "커리어넷 진로심리검사 / 한국직업능력연구원 진로정보망",
        "source_urls": ["https://www.career.go.kr/"],
        "hook": "아이 진로가 막막할 때\n먼저 볼 만한 무료 공식 검사가 있습니다.",
        "body": [
            "커리어넷은 초등학생, 중학생, 고등학생 대상별 진로심리검사를 제공합니다.",
            "초등은 아로주니어, 중·고등은 직업흥미·직업적성·진로성숙도 같은 검사를 활용할 수 있습니다.",
            "검사 결과를 직업명으로 바로 결론 내기보다 흥미, 적성, 가치관이 어디서 반복되는지 보는 용도로 쓰면 좋습니다.",
        ],
        "slides": [
            ("01", "무료 진로검사", "커리어넷 진로심리검사는 먼저 확인할 만한 공식 자료입니다."),
            ("02", "사이트", "career.go.kr 에서 진로심리검사를 찾으세요."),
            ("03", "초등", "아로주니어, 아로주니어 플러스를 확인하세요."),
            ("04", "중·고등", "직업흥미, 직업적성, 진로성숙도 검사를 보세요."),
            ("05", "활용법", "직업명보다 반복되는 흥미와 가치관을 읽으세요."),
            ("06", "저장팁", "검색어: 커리어넷 진로심리검사"),
        ],
        "resource": {
            "site": "커리어넷",
            "url_label": "career.go.kr",
            "free": "초·중·고 대상별 진로심리검사",
            "menu": "진로심리검사 > 학년/대상 선택",
            "use": "흥미, 적성, 가치관 결과를 비교해 진로 대화의 출발점으로 쓰기",
            "check": "검사 1개로 결론 내리지 말고 2개 이상 결과의 공통점을 보기",
            "caution": "추천 직업명은 정답이 아니라 탐색 후보로만 보기",
            "search": "커리어넷 진로심리검사",
        },
        "expert": {
            "news_frame": "진로 고민을 감으로만 붙잡기보다, 무료 공식 검사를 먼저 활용하면 아이의 흥미와 적성을 구조적으로 볼 수 있습니다.",
            "must_know": "커리어넷은 초등학생부터 고등학생까지 대상별 진로심리검사를 제공하는 공식 진로정보망입니다.",
            "avoid": "검사 결과에 나온 직업명을 그대로 목표로 정하면 오히려 진로를 좁게 볼 수 있습니다.",
            "check": "좋은 활용법은 검사 결과의 직업명보다 흥미, 적성, 가치관이 반복되는 방향을 읽는 것입니다.",
            "use_for": "오늘 저장할 팁: 검색창에 ‘커리어넷 진로심리검사’를 입력하고 아이 학년에 맞는 검사를 확인하세요.",
        },
    },
    {
        "slug": "schoolinfo-parent-check",
        "keyword": "학교알리미",
        "title": "학교 선택 전, 학교알리미에서 꼭 봐야 할 공시 항목이 있습니다",
        "source_name": "학교알리미 초·중등학교 정보공시 서비스",
        "source_urls": ["https://www.schoolinfo.go.kr/"],
        "hook": "학교 분위기를 소문으로만 판단하기 전에\n공식 공시자료부터 확인할 수 있습니다.",
        "body": [
            "학교알리미는 초·중등학교 정보공시 서비스입니다.",
            "학생·교원현황, 학교폭력 발생현황, 교육여건, 급식, 학업성취 등 주요 정보를 확인할 수 있습니다.",
            "특정 항목 하나보다 최근 몇 년 흐름과 주변 학교와의 비교를 함께 보는 것이 더 유용합니다.",
        ],
        "slides": [
            ("01", "학교알리미", "학교 정보를 소문이 아니라 공시자료로 확인하세요."),
            ("02", "사이트", "schoolinfo.go.kr 에서 학교명을 검색하세요."),
            ("03", "기본", "학생수, 학급당 학생수, 교원 현황을 봅니다."),
            ("04", "환경", "교육여건, 급식, 시설, 위생 정보를 확인합니다."),
            ("05", "주의", "학교폭력·학업성취는 단년도가 아니라 흐름으로 봅니다."),
            ("06", "저장팁", "검색어: 학교알리미 학교명"),
        ],
        "resource": {
            "site": "학교알리미",
            "url_label": "schoolinfo.go.kr",
            "free": "학교별 공식 공시자료 조회",
            "menu": "학교명 검색 > 공시정보 항목별 확인",
            "use": "학생수, 교원현황, 교육여건, 학교폭력, 학업성취 흐름 확인",
            "check": "단일 숫자보다 최근 공시 흐름과 주변 학교 비교를 함께 보기",
            "caution": "소문 확인용이 아니라 객관 자료를 먼저 잡는 용도로 쓰기",
            "search": "학교알리미 + 학교명",
        },
        "expert": {
            "news_frame": "학교 선택이나 전학 고민이 있을 때는 커뮤니티 후기보다 먼저 공식 공시자료를 확인하는 편이 안전합니다.",
            "must_know": "학교알리미에서는 학생·교원현황, 시설, 학교폭력 발생현황, 교육여건, 급식, 학업성취 같은 주요 학교 정보를 볼 수 있습니다.",
            "avoid": "학교를 한 가지 수치나 소문만으로 판단하면 실제 교육환경을 놓칠 수 있습니다.",
            "check": "좋은 활용법은 같은 항목을 최근 몇 년 흐름과 주변 학교 비교로 보는 것입니다.",
            "use_for": "오늘 저장할 팁: ‘학교알리미 + 학교명’으로 검색해 공시자료부터 확인하세요.",
        },
    },
    {
        "slug": "ebsi-free-tests",
        "keyword": "무료학습검사",
        "title": "EBSi에는 학습유형검사와 진로탐색검사가 무료로 열려 있습니다",
        "source_name": "EBSi 학습유형검사 / EBSi 진로탐색검사",
        "source_urls": [
            "https://www.ebsi.co.kr/ebs/xip/learnStyle/learnStyleHome.ebs",
            "https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs",
        ],
        "hook": "고등 자녀 공부 방향이 애매할 때\nEBSi 무료 검사를 한 번 활용해볼 수 있습니다.",
        "body": [
            "EBSi에는 학습유형검사와 진로탐색검사가 있습니다.",
            "학습유형검사는 학습 특성과 추천 학습전략을, 진로탐색검사는 흥미·능력·적성에 맞는 학과와 직업 정보를 확인하는 데 도움을 줍니다.",
            "검사 결과는 공부법을 단정하는 자료가 아니라 아이가 어떤 방식에서 흔들리는지 대화하는 자료로 쓰는 것이 좋습니다.",
        ],
        "slides": [
            ("01", "EBSi 무료검사", "학습유형검사와 진로탐색검사를 확인하세요."),
            ("02", "학습유형검사", "학습 특성과 추천 학습전략을 볼 수 있습니다."),
            ("03", "진로탐색검사", "흥미, 능력, 적성 관련 학과·직업 정보를 봅니다."),
            ("04", "문항수", "학습유형 120문항, 진로탐색 192문항 구성입니다."),
            ("05", "활용법", "결과명보다 학습전략과 약한 지점을 보세요."),
            ("06", "저장팁", "검색어: EBSi 학습유형검사"),
        ],
        "resource": {
            "site": "EBSi",
            "url_label": "ebsi.co.kr",
            "free": "학습유형검사, 진로탐색검사",
            "menu": "EBSi > 학습유형/진로탐색검사",
            "use": "학습전략, 흥미, 적성, 추천 학과·직업을 참고자료로 확인",
            "check": "결과 유형명보다 추천 학습전략과 반복되는 약점을 보기",
            "caution": "검사 결과를 성적 예측이나 진로 확정 자료로 쓰지 않기",
            "search": "EBSi 학습유형검사",
        },
        "expert": {
            "news_frame": "공부법이나 진로 방향이 애매할 때 유료 검사부터 찾기보다 EBSi 무료 검사를 먼저 활용할 수 있습니다.",
            "must_know": "EBSi 학습유형검사는 120문항, 진로탐색검사는 192문항으로 구성되어 학습 특성과 진로 정보를 확인할 수 있습니다.",
            "avoid": "검사 유형명을 아이 성향의 딱지처럼 붙이면 오히려 도움이 되지 않습니다.",
            "check": "좋은 활용법은 결과 유형보다 추천 학습전략과 반복되는 어려움을 보는 것입니다.",
            "use_for": "오늘 저장할 팁: ‘EBSi 학습유형검사’ 또는 ‘EBSi 진로탐색검사’를 검색해보세요.",
        },
    },
    {
        "slug": "ncic-curriculum-check",
        "keyword": "교육과정확인",
        "title": "교육과정이 궁금할 때는 블로그 요약보다 NCIC 원문을 먼저 보세요",
        "source_name": "NCIC 국가교육과정정보센터 / 2022 개정 교육과정 자료",
        "source_urls": ["https://ncic.re.kr/"],
        "hook": "2022 개정 교육과정이 헷갈릴 때\n가장 먼저 볼 공식 사이트가 있습니다.",
        "body": [
            "NCIC 국가교육과정정보센터에서는 교육과정 원문과 해설서, 2022 개정 교육과정 자료를 확인할 수 있습니다.",
            "학년별로 무엇을 배우는지 궁금할 때 블로그 요약만 보지 말고, 교과별 교육과정 문서의 성취기준을 함께 확인하면 좋습니다.",
            "특히 정보, 진로, AI 관련 이야기는 과목명보다 성취기준에 어떤 행동이 들어갔는지를 보면 훨씬 정확합니다.",
        ],
        "slides": [
            ("01", "NCIC", "교육과정 원문을 확인할 수 있는 공식 사이트입니다."),
            ("02", "사이트", "ncic.re.kr 에서 교육과정 자료실을 봅니다."),
            ("03", "볼 것", "2022 개정 교육과정 원문과 해설서를 확인하세요."),
            ("04", "핵심", "과목명보다 성취기준의 행동 표현을 보세요."),
            ("05", "활용법", "정보·진로·AI 이슈를 원문 기준으로 확인합니다."),
            ("06", "저장팁", "검색어: NCIC 2022 개정 교육과정"),
        ],
        "resource": {
            "site": "NCIC 국가교육과정정보센터",
            "url_label": "ncic.re.kr",
            "free": "교육과정 원문, 해설서, 2022 개정 교육과정 자료",
            "menu": "교육과정 자료실 > 교육과정 원문 및 해설서",
            "use": "교과별 성취기준을 확인해 실제로 무엇을 배우는지 보기",
            "check": "과목명보다 성취기준 속 행동 표현을 확인하기",
            "caution": "블로그 요약만 보고 교육과정 변화를 단정하지 않기",
            "search": "NCIC 2022 개정 교육과정",
        },
        "expert": {
            "news_frame": "교육과정 변화는 요약글만 보면 과장되거나 단순화되기 쉽습니다. 원문을 확인할 수 있는 공식 사이트를 알아두는 것이 좋습니다.",
            "must_know": "NCIC 국가교육과정정보센터에서는 교육과정 원문 및 해설서, 2022 개정 교육과정 자료를 확인할 수 있습니다.",
            "avoid": "과목명이 바뀌었다는 말만 보고 실제 학습 내용을 판단하면 오해가 생길 수 있습니다.",
            "check": "좋은 활용법은 교과별 성취기준에 어떤 행동 표현이 들어갔는지 보는 것입니다.",
            "use_for": "오늘 저장할 팁: ‘NCIC 2022 개정 교육과정’을 검색해 원문 자료실을 확인하세요.",
        },
    },
]


TOPICS = [
    {
        "slug": "career-direct-free-tests",
        "keyword": "무료진로검사",
        "title": "아이 진로검사, 돈 내기 전에 이 무료 공식검사부터 해보세요",
        "source_name": "커리어넷 진로심리검사 / EBSi 진로탐색검사",
        "source_urls": [
            "https://www.career.go.kr/inspct/web/psycho/vocation",
            "https://www.career.go.kr/inspct/web/psycho/value2",
            "https://www.career.go.kr/inspct/web/psycho/grow2",
            "https://www.career.go.kr/inspct/web/psycho/interest",
            "https://www.career.go.kr/inspct/web/psycho/holland",
            "https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs",
        ],
        "hook": "진로검사, 처음부터 돈 내고 받을 필요 없습니다.\n공식 무료검사부터 먼저 해보세요.",
        "body": [
            "커리어넷에는 직업적성검사, 직업가치관검사, 진로성숙도검사, 직업흥미검사가 무료로 열려 있습니다.",
            "EBSi 진로탐색검사는 고등학생이 흥미, 능력, 적성에 맞는 학과와 직업을 확인할 때 참고하기 좋습니다.",
            "검사 결과는 정답표가 아니라 아이의 흥미와 적성을 비교해보는 출발점으로 쓰면 됩니다.",
        ],
        "slides": [
            ("01", "무료 진로검사", "사설검사 전에 공식 무료검사부터 확인하세요."),
            ("02", "직업적성검사", "career.go.kr/inspct/web/psycho/vocation"),
            ("03", "직업가치관검사", "career.go.kr/inspct/web/psycho/value2"),
            ("04", "진로성숙도검사", "career.go.kr/inspct/web/psycho/grow2"),
            ("05", "직업흥미검사", "interest 또는 holland 링크를 확인하세요."),
            ("06", "EBSi 진로탐색", "ebsi.co.kr/ebs/xip/career/careerHome.ebs"),
        ],
        "resource": {
            "site": "커리어넷 + EBSi",
            "url_label": "career.go.kr/inspct/web/psycho/vocation",
            "free": "직업적성, 직업가치관, 진로성숙도, 직업흥미, EBSi 진로탐색검사",
            "menu": "커리어넷 진로심리검사 또는 EBSi 진로탐색검사",
            "use": "검사 2개 이상을 해보고 반복되는 흥미, 적성, 가치관을 비교하기",
            "check": "직업명보다 흥미·적성·가치관 결과의 공통점 보기",
            "caution": "검사 결과를 진로 확정표처럼 쓰지 말고 탐색 후보로만 보기",
            "search": "커리어넷 직업적성검사 / EBSi 진로탐색검사",
        },
        "expert": {
            "news_frame": "진로검사는 처음부터 유료 검사로 갈 필요가 없습니다. 공식 무료검사만 제대로 써도 아이의 흥미와 적성을 볼 자료가 생깁니다.",
            "must_know": "커리어넷에는 직업적성검사, 직업가치관검사, 진로성숙도검사, 직업흥미검사가 무료로 제공됩니다. EBSi 진로탐색검사도 함께 확인할 수 있습니다.",
            "avoid": "검사 결과에 나온 추천 직업을 그대로 목표로 정하면 아이의 가능성을 좁힐 수 있습니다.",
            "check": "좋은 활용법은 검사 여러 개에서 반복되는 흥미, 적성, 가치관의 공통점을 보는 것입니다.",
            "use_for": "저장할 링크: career.go.kr/inspct/web/psycho/vocation, career.go.kr/inspct/web/psycho/value2, career.go.kr/inspct/web/psycho/grow2, ebsi.co.kr/ebs/xip/career/careerHome.ebs",
        },
    },
    {
        "slug": "career-interest-tests",
        "keyword": "직업흥미검사",
        "title": "아이가 좋아하는 일을 모르겠다면, 커리어넷 직업흥미검사부터 보세요",
        "source_name": "커리어넷 직업흥미검사(K) / 직업흥미검사(H)",
        "source_urls": [
            "https://www.career.go.kr/inspct/web/psycho/interest",
            "https://www.career.go.kr/inspct/web/psycho/holland",
        ],
        "hook": "아이가 뭘 좋아하는지 모르겠다면\n직업명부터 묻지 말고 흥미검사부터 보세요.",
        "body": [
            "커리어넷 직업흥미검사(K)는 직업과 관련된 흥미를 확인하는 데 쓸 수 있습니다.",
            "직업흥미검사(H)는 흥미 유형과 관련 직업을 함께 볼 때 유용합니다.",
            "결과는 직업을 고르는 정답이 아니라 아이가 반복해서 끌리는 활동을 찾는 자료로 쓰는 편이 좋습니다.",
        ],
        "slides": [
            ("01", "흥미검사", "좋아하는 일을 모를 때 먼저 볼 검사입니다."),
            ("02", "K 검사", "career.go.kr/inspct/web/psycho/interest"),
            ("03", "H 검사", "career.go.kr/inspct/web/psycho/holland"),
            ("04", "볼 것", "추천 직업보다 흥미 유형을 먼저 봅니다."),
            ("05", "활용법", "반복해서 끌리는 활동을 기록하세요."),
            ("06", "저장팁", "검색어: 커리어넷 직업흥미검사"),
        ],
        "resource": {
            "site": "커리어넷",
            "url_label": "career.go.kr/inspct/web/psycho/interest",
            "free": "직업흥미검사(K), 직업흥미검사(H)",
            "menu": "진로심리검사 > 직업흥미검사",
            "use": "흥미 유형과 추천 직업을 비교해 아이가 끌리는 활동군 찾기",
            "check": "추천 직업보다 흥미 유형과 활동 키워드 먼저 보기",
            "caution": "흥미검사 결과를 아이의 한계로 해석하지 않기",
            "search": "커리어넷 직업흥미검사",
        },
        "expert": {
            "news_frame": "진로 고민의 시작은 직업명을 정하는 것이 아니라 아이가 어떤 활동에 반복해서 끌리는지 보는 일입니다.",
            "must_know": "커리어넷 직업흥미검사(K/H)는 직업 관련 흥미와 유형을 확인할 수 있는 무료 공식 검사입니다.",
            "avoid": "추천 직업 목록만 보고 진로를 결정하면 흥미 유형을 제대로 활용하지 못합니다.",
            "check": "결과표에서 먼저 볼 것은 직업명보다 아이가 어떤 활동군에 반응하는지입니다.",
            "use_for": "저장할 링크: career.go.kr/inspct/web/psycho/interest, career.go.kr/inspct/web/psycho/holland",
        },
    },
    {
        "slug": "ebsi-career-test-direct",
        "keyword": "EBSi진로검사",
        "title": "고등학생 진로검사는 EBSi 진로탐색검사도 같이 보면 좋습니다",
        "source_name": "EBSi 진로탐색검사 / EBSi 학습유형검사",
        "source_urls": [
            "https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs",
            "https://www.ebsi.co.kr/ebs/xip/learnStyle/learnStyleHome.ebs",
        ],
        "hook": "고등학생이라면 커리어넷만 보지 말고\nEBSi 진로탐색검사도 같이 확인해보세요.",
        "body": [
            "EBSi 진로탐색검사는 직업적 흥미, 능력, 적성에 맞는 학과와 직업을 확인하는 검사입니다.",
            "EBSi 학습유형검사는 학습 특성과 추천 학습전략을 보는 데 도움이 됩니다.",
            "진로와 공부 방향이 같이 흔들릴 때 두 검사를 함께 보면 대화할 자료가 더 구체적입니다.",
        ],
        "slides": [
            ("01", "EBSi 무료검사", "고등학생 진로·학습 방향을 같이 볼 수 있습니다."),
            ("02", "진로탐색검사", "ebsi.co.kr/ebs/xip/career/careerHome.ebs"),
            ("03", "학습유형검사", "ebsi.co.kr/ebs/xip/learnStyle/learnStyleHome.ebs"),
            ("04", "문항수", "진로탐색 192문항, 학습유형 120문항입니다."),
            ("05", "활용법", "학과·직업 추천과 학습전략을 함께 봅니다."),
            ("06", "저장팁", "검색어: EBSi 진로탐색검사"),
        ],
        "resource": {
            "site": "EBSi",
            "url_label": "ebsi.co.kr/ebs/xip/career/careerHome.ebs",
            "free": "진로탐색검사, 학습유형검사",
            "menu": "EBSi > 진로탐색검사 / 학습유형검사",
            "use": "진로 추천과 학습전략을 함께 확인해 고등학생 상담 자료로 쓰기",
            "check": "추천 학과·직업과 학습전략이 서로 연결되는지 보기",
            "caution": "검사 결과를 성적 예측이나 진로 확정 자료로 쓰지 않기",
            "search": "EBSi 진로탐색검사",
        },
        "expert": {
            "news_frame": "고등학생은 진로와 공부 전략이 함께 움직이는 시기라 진로검사와 학습유형검사를 같이 보면 도움이 됩니다.",
            "must_know": "EBSi 진로탐색검사는 192문항, 학습유형검사는 120문항으로 구성되어 무료로 확인할 수 있습니다.",
            "avoid": "추천 학과나 직업을 정답처럼 받아들이면 검사 활용도가 떨어집니다.",
            "check": "좋은 활용법은 진로 추천과 학습전략이 어디서 겹치는지 보는 것입니다.",
            "use_for": "저장할 링크: ebsi.co.kr/ebs/xip/career/careerHome.ebs, ebsi.co.kr/ebs/xip/learnStyle/learnStyleHome.ebs",
        },
    },
]


TOPICS = [
    {
        "slug": "careernet-holland-interest",
        "keyword": "직업흥미검사",
        "title": "우리 아이가 어떤 직업에 흥미 있는지 알고 계시나요?",
        "source_name": "커리어넷 직업흥미검사(H)",
        "source_urls": ["https://www.career.go.kr/inspct/web/psycho/holland"],
        "hook": "우리 아이가 어떤 직업에 흥미 있는지 알고 계시나요?\n검색해보면 진로검사 프로그램이 11만~16만 원대인 곳도 보입니다.\n먼저 커리어넷 무료 공식검사부터 해보셔도 됩니다.",
        "body": [
            "커리어넷 직업흥미검사(H)는 아이의 흥미 유형과 관련 직업을 확인하는 무료 공식 검사입니다.",
            "결과에서 바로 직업명을 고르기보다 아이가 어떤 활동군에 더 끌리는지 보는 데 쓰면 좋습니다.",
            "진로가 막막할 때 직업명부터 정하려고 하기보다, 흥미의 방향을 먼저 확인하는 검사로 활용하세요.",
        ],
        "slides": [
            ("01", "직업흥미검사(H)", "아이의 흥미 유형과 관련 직업을 볼 수 있는 무료 검사입니다."),
            ("02", "바로가기", "career.go.kr/inspct/web/psycho/holland"),
            ("03", "무엇을 보나요", "아이가 어떤 직업 활동에 흥미를 보이는지 확인합니다."),
            ("04", "어떻게 쓰나요", "추천 직업보다 흥미 유형을 먼저 읽으세요."),
            ("05", "주의할 점", "결과를 진로 확정표처럼 쓰면 안 됩니다."),
            ("06", "저장팁", "직업명보다 반복되는 흥미 방향을 보세요."),
        ],
        "resource": {
            "site": "커리어넷 직업흥미검사(H)",
            "url_label": "https://www.career.go.kr/inspct/web/psycho/holland",
            "free": "흥미 유형과 관련 직업 확인",
            "menu": "바로가기 링크 접속 후 검사 진행",
            "use": "추천 직업명보다 흥미 유형과 활동군을 먼저 보기",
            "check": "아이의 말, 놀이, 과제 선택에서 반복되는 흥미와 비교하기",
            "caution": "검사 결과를 아이의 한계나 정답으로 해석하지 않기",
            "search": "커리어넷 직업흥미검사 H",
        },
        "expert": {
            "news_frame": "직업흥미검사(H)는 아이가 어떤 직업 활동에 흥미를 보이는지 확인할 수 있는 커리어넷 무료 검사입니다.",
            "must_know": "이 검사는 직업명을 정해주는 검사가 아니라, 흥미 유형과 관련 직업을 통해 아이가 끌리는 활동의 방향을 보는 검사입니다.",
            "avoid": "결과에 나온 추천 직업을 그대로 목표로 정하면 오히려 진로 탐색이 좁아질 수 있습니다.",
            "check": "결과표에서는 직업명보다 흥미 유형, 활동군, 반복해서 끌리는 키워드를 먼저 보세요.",
            "use_for": "바로가기: https://www.career.go.kr/inspct/web/psycho/holland",
        },
    },
    {
        "slug": "careernet-vocation-aptitude",
        "keyword": "직업적성검사",
        "title": "흥미검사만 보면 놓치는 게 있습니다",
        "source_name": "커리어넷 직업적성검사",
        "source_urls": ["https://www.career.go.kr/inspct/web/psycho/vocation"],
        "hook": "흥미검사만 보면 놓치는 게 있습니다.\n좋아하는 것과 잘하는 것이 꼭 같지는 않기 때문입니다.\n커리어넷에는 이걸 같이 볼 수 있는 무료 직업적성검사가 있습니다.",
        "body": [
            "커리어넷 직업적성검사는 아이가 직업과 관련된 여러 능력 영역에서 어떤 강점 신호를 보이는지 확인하는 무료 검사입니다.",
            "중요한 건 점수가 높은 영역 하나를 직업으로 바로 연결하지 않는 것입니다.",
            "흥미검사 결과와 적성검사 결과를 나란히 놓고, 아이가 좋아하는 활동과 실제 강점 신호가 겹치는지 보는 데 의미가 있습니다.",
        ],
        "slides": [
            ("01", "흥미검사 다음", "좋아하는 것과 잘하는 것을 같이 봐야 합니다."),
            ("02", "바로가기", "career.go.kr/inspct/web/psycho/vocation"),
            ("03", "왜 필요할까요", "흥미만 보면 하고 싶은 일만 보이고 강점은 놓칠 수 있습니다."),
            ("04", "어떻게 쓰나요", "흥미검사 결과와 적성검사 결과를 나란히 보세요."),
            ("05", "주의할 점", "높게 나온 영역 하나로 진로를 정하지 마세요."),
            ("06", "저장팁", "좋아하는 활동과 강점 신호가 겹치는 지점을 보세요."),
        ],
        "resource": {
            "site": "커리어넷 직업적성검사",
            "url_label": "https://www.career.go.kr/inspct/web/psycho/vocation",
            "free": "직업 관련 능력 영역과 강점 신호 확인",
            "menu": "바로가기 링크 접속 후 검사 진행",
            "use": "흥미검사 결과와 나란히 놓고 좋아하는 활동과 강점 신호가 겹치는 지점 찾기",
            "check": "높게 나온 능력 영역이 실제 생활 속 선택과도 연결되는지 보기",
            "caution": "높게 나온 영역 하나를 아이의 진로 정답처럼 받아들이지 않기",
            "search": "커리어넷 직업적성검사",
        },
        "expert": {
            "news_frame": "직업적성검사는 아이가 직업과 관련된 여러 능력 영역에서 어떤 강점 신호를 보이는지 확인하는 무료 검사입니다.",
            "must_know": "흥미검사는 아이가 끌리는 방향을 보여주고, 적성검사는 그 방향을 뒷받침할 수 있는 강점 신호를 보여줍니다.",
            "avoid": "높게 나온 영역을 직업 정답처럼 받아들이면 검사 활용이 오히려 좁아질 수 있습니다.",
            "check": "결과표에서는 높은 능력 영역이 실제 활동 선택과도 이어지는지 확인해보세요.",
            "use_for": "바로가기: https://www.career.go.kr/inspct/web/psycho/vocation",
        },
    },
    {
        "slug": "ebsi-career-exploration",
        "keyword": "EBSi진로탐색",
        "title": "고등학생 진로가 애매할 때, EBSi 무료 진로탐색검사를 써보세요",
        "source_name": "EBSi 진로탐색검사",
        "source_urls": ["https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs"],
        "hook": "고등학생 자녀 진로가 애매하신가요?\n유료 검사부터 찾기 전에, EBSi에서 무료로 해볼 수 있는 진로탐색검사가 있습니다.",
        "body": [
            "EBSi 진로탐색검사는 직업적 흥미와 능력, 적성에 맞는 학과와 직업을 확인하는 검사입니다.",
            "총 192문항으로 구성되어 있고, 고등학생이 학과와 직업 방향을 함께 볼 때 참고하기 좋습니다.",
            "추천 학과나 직업을 정답으로 보기보다 아이가 어떤 분야에 반복해서 반응하는지 보는 자료로 쓰세요.",
        ],
        "slides": [
            ("01", "EBSi 진로탐색검사", "고등학생이 학과와 직업 방향을 참고할 수 있는 무료 검사입니다."),
            ("02", "바로가기", "ebsi.co.kr/ebs/xip/career/careerHome.ebs"),
            ("03", "무엇을 보나요", "흥미, 능력, 적성에 맞는 학과와 직업을 봅니다."),
            ("04", "문항수", "총 192문항으로 구성되어 있습니다."),
            ("05", "어떻게 쓰나요", "추천 학과보다 반복되는 분야를 보세요."),
            ("06", "주의할 점", "결과는 확정이 아니라 탐색 자료입니다."),
        ],
        "resource": {
            "site": "EBSi 진로탐색검사",
            "url_label": "https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs",
            "free": "흥미, 능력, 적성 기반 학과·직업 정보 확인",
            "menu": "바로가기 링크 접속 후 검사 진행",
            "use": "추천 학과와 직업을 보고 반복되는 분야 키워드 찾기",
            "check": "흥미, 능력, 적성 결과가 같은 방향을 가리키는지 보기",
            "caution": "추천 학과와 직업을 진로 확정으로 받아들이지 않기",
            "search": "EBSi 진로탐색검사",
        },
        "expert": {
            "news_frame": "EBSi 진로탐색검사는 고등학생이 흥미, 능력, 적성을 바탕으로 학과와 직업 정보를 확인할 수 있는 무료 검사입니다.",
            "must_know": "이 검사는 총 192문항으로 구성되어 있으며, 학과와 직업 방향을 함께 참고할 때 유용합니다.",
            "avoid": "추천 학과나 직업을 그대로 확정하면 아이의 탐색 폭이 좁아질 수 있습니다.",
            "check": "결과표에서는 추천명보다 반복되는 분야와 활동 키워드를 먼저 보세요.",
            "use_for": "바로가기: https://www.ebsi.co.kr/ebs/xip/career/careerHome.ebs",
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
        row_height = 166 if len(text) > 34 else 106
        draw.rounded_rectangle((82, y, 998, y + row_height), radius=18, fill="#f5f6f8", outline="#e5e7eb", width=2)
        draw_badge(draw, 110, y + 32, label, accent)
        is_url = "http://" in text or "https://" in text or ".go.kr/" in text or ".ebs/" in text or ".co.kr/" in text
        row_font = font(22 if is_url else 29, True)
        draw_multiline(draw, (250, y + 24), text, row_font, "#161616", 720, 10)
        y += row_height + 22
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
    text_parts = build_threads_text_parts(topic, latest_signal, content_type, date_text, slot)
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


def slide_payload(topic: dict, index: int, label: str, heading: str, body: str) -> dict:
    expert = topic["expert"]
    resource = topic.get("resource", {})
    if index == 1:
        return {
            "kind": "cover",
            "eyebrow": topic["keyword"],
            "title": heading,
            "subtitle": body,
            "footer": "저장해두고 바로 써먹는 교육정보입니다.",
        }
    if index == 2:
        return {
            "kind": "compare",
            "title": "어디서 보나요?",
            "rows": [
                ("사이트", resource.get("site", "")),
                ("주소", resource.get("url_label", "")),
            ],
        }
    if index == 3:
        return {
            "kind": "checklist",
            "title": "무료로 되는 것",
            "rows": [
                ("제공", resource.get("free", expert["must_know"])),
                ("메뉴", resource.get("menu", "")),
            ],
        }
    if index == 4:
        return {
            "kind": "warning",
            "title": "이렇게 쓰세요",
            "rows": [
                ("활용", resource.get("use", expert["check"])),
                ("확인", resource.get("check", expert["must_know"])),
            ],
        }
    if index == 5:
        return {
            "kind": "lens",
            "title": "주의할 점",
            "rows": [
                ("주의", resource.get("caution", expert["avoid"])),
                ("검색", resource.get("search", topic["keyword"])),
            ],
        }
    return {
        "kind": "summary",
        "title": "저장용 한 줄",
        "rows": [
            ("어디", resource.get("site", "")),
            ("무엇", resource.get("free", "")),
            ("검색", resource.get("search", "")),
        ],
    }


def footer_line(index: int) -> str:
    lines = {
        2: "사이트 이름과 검색어까지 저장해두세요.",
        3: "무료로 확인 가능한 항목만 골랐습니다.",
        4: "검사와 자료는 결론이 아니라 대화의 출발점입니다.",
        5: "추천 결과를 정답처럼 쓰지 않는 것이 핵심입니다.",
        6: "오늘은 이 검색어 하나만 저장해도 충분합니다.",
    }
    return lines.get(index, "바로 써먹을 수 있는 교육정보입니다.")


def hashtags_for_topic(topic: dict, date_text: str = "", slot: str = "") -> str:
    slug = topic.get("slug", "")
    keyword = topic.get("keyword", "")
    broad_tags = [
        "#육아",
        "#교육",
        "#교육정보",
        "#자녀교육",
        "#초등맘",
        "#중등맘",
        "#고등맘",
        "#부모공감",
    ]
    if slug == "careernet-holland-interest":
        core_tags = ["#진로교육", "#진로검사", "#커리어넷"]
    elif slug == "careernet-vocation-aptitude":
        core_tags = ["#진로교육", "#진로검사", "#커리어넷"]
    elif slug == "ebsi-career-exploration":
        core_tags = ["#고등학생진로", "#진로교육", "#EBSi"]
    elif "AI" in keyword or "ai" in slug.lower():
        core_tags = ["#AI교육", "#미래교육", "#디지털교육"]
    elif "코딩" in keyword or "coding" in slug.lower() or "info" in slug.lower():
        core_tags = ["#코딩교육", "#정보교육", "#미래교육"]
    else:
        core_tags = ["#미래교육", "#진로교육"]
    rng = random.Random(f"{date_text}:{slot}:{slug}:{keyword}")
    tags = rng.sample(broad_tags, 2) + rng.sample(core_tags, min(2, len(core_tags)))
    return " ".join(dict.fromkeys(tags))


def build_threads_text_parts(topic: dict, latest_signal: dict | None, content_type: str, date_text: str = "", slot: str = "") -> list[str]:
    expert = topic["expert"]
    resource = topic.get("resource", {})
    field_note = ""
    if topic.get("slug") in {"careernet-holland-interest", "careernet-vocation-aptitude", "ebsi-career-exploration"}:
        field_note = "꿈길 인증 진로체험 현장에서 보면, 검사 결과는 정답이 아니라 아이와 대화를 시작하는 자료에 가깝습니다."
    parts = [
        topic["hook"],
        f"바로가기: {resource.get('url_label', '')}",
        field_note,
        expert["must_know"],
        f"정확히는: {resource.get('free', '')}",
        f"이렇게 쓰세요: {resource.get('use', expert['check'])}",
        f"주의할 점: {resource.get('caution', expert['avoid'])}",
        hashtags_for_topic(topic, date_text, slot),
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
