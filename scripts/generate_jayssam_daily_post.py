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

# 제이쌤은 포토샵·영상·엑셀·PPT·한글·마케팅·유튜브·3D·진로를 가르리는 원장이다.
# 글의 핵심은 '툴을 가르쳤다'가 아니라 교육과 현장 사이의 간극을 자기 말로 짚는 것이다.
# 21일 x 하루 2건보다 많은 소재를 둬서 같은 과목·수강생 상황이 바로 반복되지 않게 한다.
OBSERVATION_SEEDS = [
    ("excel_certificate_gap", "실무 파일 앞에서 멈추는 이유", "‘선생님, 자격증은 땄는데 실무 파일 보니까 손도 못 대겠어요.’\n수업하다 보면 참 자주 듣는 이야기야.\n\n그럴 수 있어. 시험은 잘 정돈된 표를 주고 ‘VLOOKUP을 쓰라’고 알려주지만, 실제 회사 데이터는 셀 병합과 오타, 공백이 엉켜있는 상태로 들어오니까.\n\n자격증이 도구 위치를 익힌 거라면, 실무는 문제의 원인을 찾아 고쳐내는 작업이야. 처음 보는 파일을 받으면 수식부터 넣지 말고 Ctrl + G를 눌러 빈 셀부터 살펴봐. 병합을 풀고 데이터 형태를 정돈하는 게 함수보다 먼저야."),
    ("excel_function_definition", "엑셀 함수를 다 외워야 하냐는 질문", "엑셀 함수 다 외워야 하냐고 묻는 수강생이 많다. 솔직히 다 외울 필요 없다.\n\n현장에선 검색도 하고 AI한테도 물어본다. 대신 내가 지금 뭘 만들고 싶은지, 어떤 값이 이상한지는 정확히 말할 줄 알아야 한다.\n\n함수 암기보다 문제를 정의하는 힘. 그게 있어야 검색 결과도 검증할 수 있다."),
    ("excel_manual_cleanup", "복붙으로 버티던 엑셀 파일", "직장인 수강생 파일을 보는데 같은 내용을 열두 번 복사해서 붙여넣고 있었다.\n\n처음엔 그냥 빨리 끝내려고 그랬겠지. 그런데 그 방식은 다음 달에도 같은 시간을 또 쓰게 만든다.\n\n엑셀은 표를 예쁘게 만드는 도구가 아니라, 반복되는 일을 덜어내는 도구다. 그 관점이 생기면 함수 하나 배우는 이유도 달라진다."),
    ("excel_wrong_total", "숫자가 맞아도 틀린 보고서", "엑셀 보고서에서 합계는 맞는데 결론이 틀린 경우가 있다.\n\n월별 숫자만 보고 매출이 올랐다고 말했는데, 할인 폭이나 객단가를 같이 안 본 거다. 수식은 틀리지 않았어도 해석은 틀릴 수 있다.\n\n그래서 수업에서는 결과값보다 먼저 묻는다. 이 숫자로 뭘 판단하려는 건지. 그 질문을 빼면 엑셀은 계산기에서 못 벗어난다."),
    ("ppt_pretty_not_persuade", "예쁜 피피티가 설득까지 해주진 않는다", "파워포인트 수업하면 예쁜 템플릿부터 찾는 분들이 많다.\n\n그런데 발표 듣는 사람은 슬라이드가 예쁜지보다, 그래서 내가 뭘 결정하면 되는지를 먼저 본다. 화려한 디자인이 메시지를 대신해주진 않는다.\n\n피피티는 장식하는 도구가 아니라 생각의 순서를 보여주는 도구다. 첫 장을 만들기 전에 결론부터 한 문장으로 정리하는 이유가 여기 있다."),
    ("ppt_one_slide_one_message", "한 장에 다 넣고 싶은 마음", "오늘 피피티 한 장에서 문장 네 줄을 지웠다.\n\n수강생은 중요한 내용을 빼면 불안하다고 했다. 그런데 중요한 말이 너무 많아지면 듣는 사람은 결국 아무것도 못 잡는다.\n\n한 장에 하나만 남기는 건 내용을 줄이는 일이 아니다. 상대가 기억할 한 가지를 고르는 일이다."),
    ("ppt_boss_question", "보고 끝나고 꼭 나오는 질문", "직장인 피피티를 같이 고치다 보면 마지막에 꼭 이런 질문이 나온다. ‘그래서 어떻게 하자는 건데요?’\n\n자료에 숫자도 많고 분석도 많은데, 정작 결정할 문장이 없었던 거다. 보고서는 많이 보여주는 사람보다 판단을 쉽게 만들어주는 사람이 잘 만든다.\n\n피피티에서 제일 먼저 써야 하는 건 목차가 아니라, 이 보고를 보고 상대가 어떤 결정을 하면 되는지다."),
    ("hwp_official_document", "한글 문서가 어려운 진짜 이유", "한글 문서는 기능이 어려워서가 아니라, 누가 읽을 문서인지 생각 안 하고 쓰면 어려워진다.\n\n행정 문서든 안내문이든 내 머릿속 순서대로 적으면 보는 사람은 계속 되묻게 된다. 그래서 문단 정리 전에 제목과 소제목부터 다시 잡는다.\n\n문서는 글을 잘 쓰는 사람이 아니라, 읽는 사람의 시간을 아는 사람이 잘 만든다."),
    ("hwp_template_dependence", "양식만 바꿔 쓰면 생기는 일", "한글 문서 양식만 바꿔 쓰면 편할 것 같지만, 꼭 필요한 내용까지 예전 문장을 따라가게 된다.\n\n오늘도 안내문 하나를 보는데 날짜만 바뀌고 정작 신청자가 알아야 할 내용은 뒤에 숨어 있었다.\n\n양식은 시작점이지 답안지가 아니다. 매번 누가 읽는지 보고 한 번은 다시 손봐야 한다."),
    ("photoshop_pretty_not_sell", "예쁜 디자인보다 먼저 봐야 할 것", "가게를 운영하는 사장님들께 가장 많이 받는 질문이 있어.\n‘화려하게 디자인해서 광고를 돌렸는데 왜 반응이 없을까요?’\n\n포토샵은 이미지를 보기 좋게 다듬어주는 도구일 뿐이야. 지갑을 열게 만드는 건 ‘이 상품이 나에게 왜 필요한가’에 대한 설득력이고.\n\n툴 기능을 외우기 전에 내 손님이 진짜 듣고 싶어 하는 말이 뭔지 찾는 게 먼저야. 한 페이지에 폰트가 3~4개씩 섞이면 시선이 분산돼서 잘 읽히지 않아. 가장 중요한 한 문장만 남기고 폰트 종류를 2개 이하로 줄이는 것부터 해봐!!"),
    ("photoshop_banner_question", "배너를 만들기 전에 묻는 질문", "포토샵으로 배너를 만들기 전에 나는 늘 묻는다. 이걸 본 사람이 3초 안에 뭘 알아야 하냐고.\n\n사진이 예쁘고 글자가 많아도 답이 안 나오면 그냥 복잡한 이미지가 된다. 할인인지, 예약인지, 신메뉴인지 하나부터 정해야 한다.\n\n디자인 감각은 색을 많이 쓰는 데서 안 나온다. 뺄 말을 고르는 데서 나온다."),
    ("photoshop_copy_not_effect", "효과보다 문장 하나", "포토샵 수업에서 효과를 여러 개 넣은 작업물을 볼 때가 있다.\n\n시간은 정말 많이 들었는데, 막상 무엇을 파는지는 잘 안 보인다. 그럴 땐 효과를 더 가르치기보다 문장 하나부터 고친다.\n\n사람은 반짝이는 글자를 기억하기보다, 자기한테 필요한 말을 기억한다."),
    ("illustrator_logo_before_shape", "로고를 그리기 전에 할 일", "일러스트레이터로 로고부터 그리고 싶어 하는 분들이 많다.\n\n그런데 내 가게가 어떤 손님에게 어떤 느낌으로 기억되고 싶은지 정리 안 하면, 예쁜 도형만 계속 늘어난다. 로고는 그림 솜씨보다 방향이 먼저다.\n\n색을 고르기 전에 내 가게를 한 문장으로 말해보라고 하는 이유도 그래서다."),
    ("illustrator_brand_consistency", "예쁜 시안이 브랜드가 되려면", "명함, 배너, 인스타 이미지가 다 예쁜데 서로 다른 가게처럼 보이는 경우가 있다.\n\n각각 잘 만든 것과 한 브랜드로 보이는 건 다른 문제다. 폰트 하나, 색 하나, 말투 하나가 반복돼야 기억에 남는다.\n\n일러스트레이터는 그림을 만드는 프로그램이지만, 브랜딩 수업에서는 기준을 만들 때 더 많이 쓴다."),
    ("video_effect_not_story", "화려한 편집보다 기획", "영상편집 배우러 오면 다들 자막 효과나 전환부터 물어본다.\n\n그런데 효과가 화려하다고 사람들이 끝까지 보진 않는다. 3분짜리 영상도 왜 봐야 하는지 설득이 안 되면 바로 나간다.\n\n영상 교육은 버튼 누르는 법보다 이야기를 짜는 힘을 먼저 다뤄야 한다. 편집은 그다음에 붙는 기술이다."),
    ("video_cut_for_viewer", "내가 아까운 장면과 보는 사람이 지루한 장면", "영상 편집할 때 찍느라 고생한 장면을 못 자르는 분들이 많다.\n\n내가 아까운 장면과 보는 사람이 필요한 장면은 다를 수 있다. 오늘도 20초짜리 도입을 6초로 줄였더니 영상이 훨씬 빨리 본론으로 들어갔다.\n\n편집은 덜어내는 기술이다. 내가 공들인 것보다 시청자가 끝까지 볼 이유를 남겨야 한다."),
    ("video_audio_first", "영상에서 먼저 고쳐야 하는 것", "영상이 뭔가 어색하면 다들 화면부터 만진다.\n\n그런데 소리가 안 들리거나 말이 너무 빠르면 화면이 아무리 좋아도 못 본다. 시청자는 생각보다 화질보다 흐름과 소리에 먼저 반응한다.\n\n편집 수업에서 자막보다 음량 조절을 먼저 다루는 날이 있는 이유다."),
    ("youtube_title_promise", "유튜브 제목은 낚시가 아니라 약속이야", "자극적인 제목으로 관심을 끌면 조회수는 나올 수 있어.\n\n하지만 기대하고 들어온 시청자에게 내용이 미치지 못하면, 속았다는 생각에 그 채널은 다시 찾지 않아. 제목은 사람을 낚는 도구가 아니라 시청자와 하는 약속이야.\n\n그래서 수업할 때 편집 프로그램을 켜기 전에 제목부터 쉽게 뽑지 못하게 해. ‘이 영상이 시청자의 문제를 한 가지라도 확실히 해결해 줄 수 있는가?’ 이 질문에 답하기 어렵다면 아무리 화려한 편집도 의미가 크지 않아."),
    ("youtube_short_not_easy", "짧은 영상이 더 쉬울 거라는 착각", "쇼츠는 짧으니까 만들기 쉽다고들 한다. 막상 해보면 반대다.\n\n짧을수록 군더더기 하나가 더 크게 보이고, 처음 2초에 왜 봐야 하는지가 나와야 한다. 길이가 줄어든다고 기획까지 줄어드는 건 아니다.\n\n짧은 영상은 대충 만든 긴 영상이 아니라, 핵심만 남긴 다른 형식이다."),
    ("youtube_upload_not_finish", "영상 올렸다고 끝난 게 아니다", "유튜브 영상 하나 올리고 조회수만 보는 건 조금 아쉽다.\n\n어디서 나갔는지, 어떤 댓글이 달렸는지 보면 다음 영상에서 고칠 게 나온다. 올리는 건 발행이고, 배우는 건 그다음부터다.\n\n콘텐츠는 한 번 잘 만드는 것보다 다음 편에서 조금 덜 헤매는 쪽이 오래 간다."),
    ("sns_marketing_post_not_sales", "인스타에 매일 올려도 손님이 안 오는 이유", "SNS 마케팅 수업에서 ‘매일 올리는데 왜 문의가 없죠?’라는 질문을 듣는다.\n\n게시물 수가 부족해서가 아니라, 보는 사람이 왜 지금 내게 와야 하는지가 안 보이는 경우가 많다. 예쁜 사진만으로는 선택할 이유가 생기지 않는다.\n\n오늘 손님이 궁금해할 한 가지를 대신 설명해주는 글. 그게 쌓여야 계정도 가게도 신뢰를 얻는다."),
    ("sns_customer_not_algorithm", "알고리즘보다 먼저 봐야 할 사람", "SNS 하다 보면 알고리즘 얘기부터 나오는데, 나는 손님 얘기부터 한다.\n\n도달 수가 올라가도 엉뚱한 사람에게만 보이면 매출은 안 바뀐다. 내 가게를 찾을 사람이 어떤 말에 멈추는지부터 알아야 한다.\n\n알고리즘은 바뀌어도 손님이 궁금해하는 건 크게 안 바뀐다. 그래서 그쪽부터 공부한다."),
    ("sns_before_after_proof", "후기보다 먼저 보여줘야 할 장면", "SNS에 후기만 올리면 충분하다고 생각하는 사장님들이 있다.\n\n후기는 좋다. 다만 처음 보는 사람은 이 서비스가 자기 문제를 어떻게 바꾸는지 먼저 보고 싶어 한다. 전후 장면이나 과정이 필요한 이유다.\n\n마케팅은 자랑하는 일이 아니라, 상대가 자기 상황을 떠올리게 돕는 일이다."),
    ("smallbiz_product_explanation", "사장님이 자기 상품을 제일 어렵게 설명할 때", "소상공인 마케팅 수업에서 상품 설명을 써보면 의외로 사장님들이 제일 막힌다.\n\n매일 다루는 상품이라 너무 잘 알아서, 처음 보는 손님이 어디에서 궁금해할지를 놓치기 쉽다. 그래서 나는 설명을 멋있게 쓰기보다 손님 질문부터 적게 한다.\n\n좋은 소개글은 어려운 말을 쓰는 글이 아니다. 손님이 물어볼 말을 미리 답해주는 글이다."),
    ("smallbiz_discount_habit", "할인부터 꺼내면 생기는 일", "손님이 줄었다고 바로 할인부터 붙이는 가게가 많다.\n\n할인은 선택을 빠르게 만들 수는 있지만, 왜 이 가게여야 하는지까지 설명해주진 않는다. 가격 말고도 내가 더 잘하는 이유가 있어야 다시 찾아온다.\n\n마케팅은 싸게 파는 기술이 아니다. 내 가게의 가치를 알아듣게 만드는 일이다."),
    ("smallbiz_owner_as_customer", "사장님이 손님 자리에서 보면 달라지는 것", "가게 홍보물을 만들 때 사장님께 손님 입장에서 한 번 읽어보라고 한다.\n\n당연히 알 거라고 생각했던 위치, 가격, 예약 방법이 빠져 있는 경우가 정말 많다. 운영하는 사람에게 익숙한 건 손님에겐 처음 보는 정보다.\n\n내 사업을 제3자 눈으로 보는 연습. 마케팅 수업에서 그게 제일 어렵고 제일 중요하다."),
    ("career_certificate_question", "자격증을 따려는 목적부터 물어야 하는 이유", "진로 특강을 가면 항상 나오는 질문이 있어.\n‘무슨 자격증을 따야 취업이 잘되나요?’\n\n그럴 때 나는 역으로 물어봐. ‘그 자격증을 따서 정확히 어느 업무에 활용하고 싶은가요?’\n\n명확한 목적 없이 남들이 따니까 따라서 취득하는 자격증은 이력서 한 줄에 그치기 쉬워. 회사는 자격증의 개수보다 이 도구로 실제 문제를 해결할 수 있는지를 봐.\n\n가고 싶은 직무의 채용공고 3개를 찾아 우대사항에 적힌 툴이 무엇인지부터 확인해봐!! 필요한 무기를 파악한 뒤에 교육을 시작해도 늦지 않아."),
    ("career_job_title", "직업 이름만 보고 진로를 고르면", "진로 상담에서 멋있어 보이는 직업 이름부터 고르는 경우가 있다.\n\n그런데 같은 직업 안에서도 하는 일은 다 다르다. 사람을 만나며 일하는 게 맞는지, 데이터를 정리하는 게 맞는지, 무언가를 만드는 게 맞는지부터 봐야 한다.\n\n진로는 명함에 적힐 단어를 고르는 일이 아니라, 내가 오래 버틸 방식을 찾는 일이다."),
    ("career_first_portfolio", "포트폴리오는 완벽해야 한다는 생각", "취준생 포트폴리오를 보면 시작도 전에 겁부터 먹는 분들이 있다.\n\n대단한 결과물 열 개보다, 하나를 왜 만들었고 어디를 고쳤는지 설명할 수 있는 작업이 더 낫다. 현장에서는 완성본만 보지 않는다.\n\n처음부터 잘하는 사람처럼 보이려 하지 말고, 문제를 만나면 어떻게 움직이는 사람인지 보여주면 된다."),
    ("career_ai_question", "AI가 있는데 뭘 배워야 하냐는 질문", "요즘은 AI가 있는데 포토샵이나 엑셀을 왜 배우냐는 질문도 받는다.\n\nAI가 초안을 만들어줄 수는 있다. 하지만 그 결과가 내 일에 맞는지, 틀린 건 없는지, 어디를 고쳐야 하는지는 결국 사람이 판단해야 한다.\n\n도구가 바뀌어도 문제를 읽고 결과를 검증하는 사람의 자리는 남는다. 나는 그 힘을 가르치고 싶다."),
    ("jobtalk_experience_language", "경험을 말로 바꾸는 연습", "직업 강연 뒤에 자기 경험이 없어서 할 말이 없다는 이야기를 듣는다.\n\n아르바이트든 팀 과제든, 불편한 일을 어떻게 해결했는지 들여다보면 이미 경험은 있다. 문제는 그걸 직무 언어로 바꿔본 적이 없는 거다.\n\n경험이 없는 사람보다, 경험을 해석하지 못한 사람이 더 많다. 그래서 말로 꺼내보는 연습이 필요하다."),
    ("jobtalk_first_interview", "면접에서 외운 답이 티 나는 순간", "면접 준비할 때 모범 답안부터 외우는 분들이 있다.\n\n말은 매끈한데 한 번만 꼬리 질문이 들어가면 자기 이야기가 없어서 흔들린다. 면접은 정답 발표가 아니라, 내가 실제로 어떻게 일하는 사람인지 보여주는 자리다.\n\n그래서 답변을 길게 쓰기보다 내 경험 하나를 끝까지 설명해보라고 한다."),
    ("three_d_pen_result", "3D펜 수업에서 결과물보다 보는 것", "3D펜 수업은 그냥 재미있는 만들기 시간이라고 생각하기 쉽다.\n\n그런데 선 하나가 왜 무너지는지, 어떤 순서로 쌓아야 형태가 잡히는지 계속 관찰해야 한다. 손으로 만들면서도 결국 문제를 보고 수정하는 연습을 하는 셈이다.\n\n완성품만 들고 가는 수업이면 아쉽다. 실패한 선을 다시 세워본 경험까지 가져가야 한다."),
    ("three_d_printer_file", "3D프린터는 출력 버튼만 누르면 끝이 아니다", "3D프린터 수업에서 제일 많이 나오는 말은 ‘파일은 멀쩡한데 왜 출력이 안 되죠?’다.\n\n화면에서 보이는 것과 실제로 쌓이는 건 다르다. 두께, 방향, 지지대 하나 때문에 결과물이 완전히 달라진다.\n\n그래서 3D프린터는 기계를 다루는 수업이면서, 예상과 결과가 다를 때 원인을 찾는 수업이기도 하다."),
    ("three_d_design_iteration", "첫 출력이 실패했을 때", "3D프린터 첫 출력이 실패하면 수강생들이 속상해한다.\n\n그런데 나는 그때부터 수업이 시작된다고 본다. 어디가 휘었는지, 왜 떨어졌는지 보면 다음 파일에서 바꿔야 할 게 보이기 때문이다.\n\n한 번에 잘 뽑는 것보다 실패를 보고 수정할 줄 아는 사람이 결국 더 멀리 간다."),
    ("practical_task_blank_screen", "실습 시간에 화면만 보고 있는 이유", "수업에서 ‘질문 있으세요?’ 하면 다들 조용하다. 근데 실습 들어가면 어디서부터 손대야 할지 몰라 화면만 보고 있다.\n\n그럴 땐 ‘뭘 모르겠어요’만 하지 말고, 지금까지 어디까지 했는지랑 뭐가 안 되는지부터 말해보라고 한다. 그래야 나도 바로 어디가 꼬였는지 본다.\n\n질문 잘하는 것도 실력이다. 혼자 멍하니 화면만 보고 있는 시간부터 줄여야 한다."),
    ("practical_feedback_bad_habit", "피드백은 칭찬보다 습관을 잡는 일", "수강생 작업물을 보면 잘한 부분부터 말해주고 싶다. 물론 그것도 필요하다.\n\n그런데 나중에 문제를 만들 습관이 보이면 그냥 넘길 수 없다. 파일 이름, 폴더 정리, 수식 범위 같은 작은 것들이 현장에서는 시간을 잡아먹는다.\n\n교육은 기분 좋게 끝내는 것만이 아니다. 나중에 덜 고생할 방법을 미리 알려주는 일도 해야 한다."),
    ("practical_google_before_ask", "검색을 잘하는 사람은 따로 있다", "수업 중 막히면 바로 ‘이거 어떻게 해요?’라고 묻는 분들이 있다.\n\n질문 전에 오류 문장 한 줄, 지금 하려던 작업 한 줄만 적어봐도 답을 찾는 속도가 달라진다. 검색은 많이 하는 사람이 아니라, 정확히 묻는 사람이 잘한다.\n\n혼자 해결하는 힘은 모든 걸 아는 데서 안 나온다. 필요한 정보를 꺼내오는 법을 아는 데서 나온다."),
    ("practical_tool_switch", "툴을 바꾸면 실력이 사라질까", "포토샵 대신 다른 프로그램을 쓰게 되면 처음부터 다시 배워야 하냐는 질문을 받는다.\n\n버튼 위치는 바뀔 수 있다. 하지만 레이어를 나누고, 정보를 정리하고, 보는 사람 기준으로 만들던 생각까지 사라지는 건 아니다.\n\n도구는 바뀌어도 일하는 방식은 남는다. 그래서 기능보다 원리를 같이 가르친다."),
    ("class_owner_standard", "수업을 많이 늘리지 않는 이유", "수업 문의가 들어오면 다 받는 게 사업적으로는 편할 수도 있다.\n\n그런데 피드백을 대충 보내고, 이름도 제대로 못 외우는 수업은 내가 하고 싶은 방식이 아니다. 규모보다 한 사람의 작업을 끝까지 보는 감각을 먼저 지키고 싶다.\n\n교육 사업은 숫자만 늘리는 일이 아니다. 내가 어떤 약속을 지킬 건지 정하는 일이다."),
    ("class_owner_curriculum", "교재 순서보다 현장 순서", "커리큘럼은 미리 짜두지만 그대로만 밀고 가지는 않는다.\n\n같은 질문이 여러 번 나오면 그 단원부터 다시 설명해야 한다. 교재 순서가 맞다고 해서 수강생의 이해 순서까지 맞는 건 아니니까.\n\n수업은 계획대로 끌고 가는 것보다, 어디에서 멈췄는지 보고 다음 걸 고르는 일이 더 많다."),
    ("class_owner_consulting", "상담에서 기술 이름부터 묻지 않는 이유", "상담할 때 ‘포토샵 배울까요, 엑셀 배울까요?’부터 답하지 않는다.\n\n지금 어떤 일을 하고 있고, 무엇이 반복해서 불편한지부터 듣는다. 같은 엑셀도 취준생에게 필요한 것과 자영업자에게 필요한 건 전혀 다르다.\n\n과목은 답이 아니라 수단이다. 내 상황을 먼저 알아야 맞는 수단도 고를 수 있다."),
    ("class_owner_material", "수업 자료에서 지운 설명", "오늘 강의 자료에서 보기 좋은 문장 몇 개를 지웠다.\n\n읽을 때는 그럴듯했는데 수강생이 바로 해볼 수 있는 안내는 아니었다. 자료는 저장되는 것보다, 수업 중 실제로 쓰이는 쪽이 낫다.\n\n설명을 멋있게 만드는 것보다 다음 행동이 보이게 만드는 데 더 신경 쓴다."),
    ("smallbiz_real_customer", "내가 좋아하는 디자인과 손님이 고르는 디자인", "사장님이 좋아하는 디자인이 손님에게도 잘 먹히는 건 아니다.\n\n오늘도 예쁜 색 조합보다 가격과 예약 방법을 더 크게 보여주자고 했다. 손님은 작품을 보러 온 게 아니라, 자기 문제를 해결하러 들어온다.\n\n브랜드 감성도 중요하다. 다만 구매하는 사람이 바로 알아야 할 정보보다 앞설 수는 없다."),
    ("office_automation_time", "직장인이 배우는 건 기능이 아니라 시간", "직장인 수강생이 엑셀이나 PPT를 배우는 이유는 대단한 작품을 만들기 위해서만은 아니다.\n\n매달 반복되는 보고서, 회의 전날의 야근, 누구한테 물어봐야 할지 몰라 멈추는 시간을 줄이고 싶은 거다.\n\n나는 기능 하나를 알려줄 때마다 이게 다음 달 내 시간을 얼마나 덜 쓰게 하는지도 같이 말한다. 실무 교육은 결국 시간을 돌려주는 일이니까."),
    ("office_automation_template", "서식 하나보다 중요한 것", "회사에서 쓰는 서식을 그대로 따라 만드는 수업을 부탁받을 때가 있다.\n\n그 서식이 왜 그런 순서인지 이해하지 못하면 담당자가 바뀌는 순간 또 막힌다. 그래서 똑같이 만들기 전에 구조부터 같이 본다.\n\n양식을 복제하는 사람보다, 새 양식이 와도 원리를 읽는 사람이 현장에서 오래 간다."),
    ("marketing_owner_voice", "사장님 말투가 사라진 홍보글", "마케팅 글을 같이 쓰다 보면 너무 그럴듯한 문장으로 바꾸고 싶어질 때가 있다.\n\n그런데 실제 가게에서 손님을 맞는 말투와 온라인 글의 말투가 너무 다르면 금방 티가 난다. 사장님이 직접 말할 법한 표현이 남아 있어야 한다.\n\n홍보글은 멋있어 보이는 글보다, 손님이 ‘여긴 진짜 이런 곳이구나’ 하고 믿게 만드는 글이 더 세다."),
    ("creator_delivery", "영상에 내 얘기만 많을 때", "유튜브 강의에서 영상을 보면 내가 하고 싶은 얘기만 가득한 경우가 있다.\n\n만드는 사람에겐 중요한 이야기여도 보는 사람은 자기한테 뭐가 남는지 먼저 찾는다. 그래서 도입부에서 시청자가 얻을 걸 분명히 하자고 한다.\n\n전달력은 말을 많이 하는 기술이 아니다. 상대가 끝까지 들을 이유를 만드는 기술이다."),
    ("career_non_linear", "돌아가는 경력이 무의미하지 않은 이유", "진로 특강에서 전공이랑 다른 일을 해도 되냐는 질문을 받는다.\n\n당연히 된다. 다만 이전 경험에서 내가 익힌 방식이 새 일에 어떻게 연결되는지는 설명할 수 있어야 한다. 돌아온 길도 그냥 사라지는 건 아니다.\n\n경력은 직선으로 예쁘게 이어져야만 쓸모 있는 게 아니다. 내가 어떤 문제를 잘 다뤄왔는지가 남는다."),
    ("b_workplace_file_first", "회사 파일을 받자마자 해야 하는 일", "수강생이 가져온 회사 파일을 열었는데 함수부터 넣으려고 하더라.\n\n그런데 표 위쪽에는 제목이 몇 줄씩 있고, 중간중간 합쳐진 셀도 있고, 숫자처럼 보이는데 문자로 들어온 값도 있었다. 이 상태에서 수식을 넣으면 맞는 답을 내도 다음 달에 다시 틀린다.\n\n실무 파일은 정답을 맞히는 것보다 먼저 구조를 읽어야 한다는 얘기를 오래 했다."),
    ("b_excel_monthly_report", "매달 같은 보고서를 새로 만드는 이유", "직장인 수강생이 매달 보고서 만들 때마다 원본 파일을 복사해서 처음부터 다시 작업하고 있었다.\n\n지난달 파일을 복사하는 건 빠른데, 어디를 바꿨는지 기억이 안 나고 담당자가 바뀌면 더 설명하기 어려워진다.\n\n엑셀을 잘한다는 건 함수를 많이 아는 것보다 다음 사람이 열어도 흐름이 보이는 파일을 만드는 데 가깝다."),
    ("b_excel_invoice_cleanup", "숫자는 맞는데 합계가 이상한 파일", "정산 파일의 숫자는 다 맞아 보이는데 합계가 자꾸 어긋난다는 문의를 받았다.\n\n몇 줄을 보니 금액 뒤에 공백이 붙은 값과 숫자 서식이 섞여 있었다. 수식이 틀린 게 아니라 입력된 모양이 달랐던 거다.\n\n실무에서 오류를 잡는 순서는 함수를 더 넣는 게 아니라 값이 같은 모양으로 들어왔는지 확인하는 데서 시작한다."),
    ("b_ppt_decision_slide", "보고서에서 제일 먼저 지운 문장", "직장인 수강생의 발표 자료를 보는데 숫자와 설명이 한 장에 너무 많이 들어가 있었다.\n\n무엇을 조사했는지는 잘 보이는데, 이걸 보고 팀장이 어떤 결정을 해야 하는지는 안 보였다. 그래서 설명 몇 줄을 덜어내고 결론을 제목으로 올렸다.\n\n보고서가 어려운 건 내용이 부족해서가 아니라, 판단할 문장이 뒤에 숨어 있어서인 경우가 많다."),
    ("b_photoshop_store_banner", "사장님이 만든 배너에서 빠진 것", "소상공인 수업에서 직접 만든 메뉴 배너를 봤는데 색도 예쁘고 사진도 괜찮았다. 그런데 어디서 주문하는지는 한참 찾아야 했다.\n\n사장님은 손님이면 당연히 알 거라고 생각했는데, 처음 보는 사람은 메뉴 이름만 보고 주문 방법까지 알 수 없다.\n\n홍보물은 만든 사람에게 익숙한 정보보다 처음 보는 사람이 바로 묻는 정보를 앞에 두는 게 먼저다."),
    ("b_video_first_cut", "편집을 잘하는데 영상이 길어지는 이유", "영상편집 수강생 작업을 같이 보다가 자막보다 컷을 먼저 건드렸다.\n\n말은 잘하는데 같은 내용을 다른 표현으로 두 번 설명하고, 도입부에서 본론까지 가는 시간이 길었다. 효과를 더하면 잠깐은 화려해져도 지루한 구간은 그대로 남는다.\n\n편집 실력이 늘었다는 건 기능이 많아진 게 아니라 버릴 장면을 고르는 속도가 빨라진다는 뜻일 때가 있다."),
    ("b_hwp_notice_reader", "한글 안내문을 읽는 사람이 되어서", "한글 문서 수업에서 안내문 하나를 같이 봤다. 작성자는 친절하게 쓴다고 내용을 많이 넣었는데, 신청 방법이 중간에 묻혀 있었다.\n\n문장을 고치기 전에 제목 아래에 대상, 날짜, 방법만 먼저 꺼냈다. 그랬더니 새로 쓴 부분보다 순서를 바꾼 게 더 크게 보였다.\n\n문서는 많이 설명하는 사람이 아니라 읽는 사람의 다음 행동을 생각한 사람이 편하게 만든다."),
    ("b_career_job_posting_tool", "자격증 이름부터 고르지 않는 상담", "진로 상담에서 자격증 이름을 여러 개 적어온 수강생이 있었다. 그런데 정작 가고 싶은 회사의 채용공고는 아직 열어보지 않았더라.\n\n공고 세 개에서 담당 업무와 우대 툴만 따로 적어보게 했다. 그제야 지금 필요한 공부와 나중에 필요한 공부가 조금 나뉘었다.\n\n무엇을 배울지는 자격증 목록보다 내가 들어가고 싶은 일의 문장에서 먼저 보이는 경우가 많다."),
    ("b_ai_result_check", "AI가 만들어준 파일을 바로 쓰지 않는 이유", "AI로 엑셀 수식을 만들어봤다는 수강생 파일을 열었다. 수식 자체는 그럴듯한데 실제 표의 열 이름과 맞지 않아 다른 값을 보고 있었다.\n\nAI가 틀렸다고만 하기엔 질문에 들어간 조건도 빠져 있었다. 원하는 결과와 현재 데이터 모양을 같이 적으니 다시 나온 답은 훨씬 쓸 만했다.\n\n도구를 잘 쓰는 사람은 결과를 빨리 받는 사람이 아니라, 결과가 맞는지 확인할 기준을 가진 사람이다."),
    ("b_three_d_print_repair", "출력물이 휘었을 때 바로 고치지 않는 것", "3D프린터 수업에서 출력물이 한쪽으로 휘어 나온 적이 있다. 수강생은 파일을 다시 만들려고 했는데 먼저 출력판에 붙은 상태와 바닥 면을 확인했다.\n\n온도 때문인지 지지대 때문인지 원인을 나누지 않으면 새 파일을 만들어도 같은 실패가 반복된다.\n\n만드는 수업일수록 결과물을 예쁘게 만드는 시간보다 왜 그렇게 나왔는지 보는 시간이 더 중요하다."),
    ("a_tool_excel_workflow", "새 툴은 기능표보다 내 파일로 시험한다", "새로운 업무 툴을 소개받으면 기능 목록부터 외우지는 않는다. 실제로 매주 하던 엑셀 정리 파일을 넣고, 기존 방식에서 몇 단계가 줄어드는지부터 확인한다.\n\n멋진 대시보드가 있어도 매일 쓰는 부분이 불편하면 오래 못 간다. 반대로 눈에 띄지 않는 기능 하나가 반복 작업을 줄이면 손이 계속 간다.\n\n툴은 설명보다 내 일에 붙여봤을 때 성격이 보인다."),
    ("a_tool_ai_editor", "AI 편집툴을 써보고 남은 것", "AI로 영상 자막을 정리해주는 툴을 며칠 써봤다. 초안 만드는 시간은 확실히 줄었는데, 고유명사랑 말끝을 그대로 믿고 쓰기에는 검수가 필요했다.\n\n그래도 처음부터 듣고 옮기는 일은 덜어줘서 긴 영상 작업에는 꽤 쓸 만했다. 잘한다고 말하기보다 어디까지 맡기고 어디부터 직접 볼지를 정하는 게 먼저였다.\n\n협업으로 받은 툴도 결국 내 작업 안에서 며칠 굴려봐야 할 말이 생긴다."),
    ("a_tool_template_market", "템플릿을 직접 써보면 보이는 것", "보기 좋은 템플릿을 받아서 실제 수업 자료에 적용해봤다. 첫 화면은 깔끔했는데 내용을 조금만 바꾸니 줄 간격이 무너지고 글을 줄여야만 들어갔다.\n\n템플릿은 예쁜 샘플보다 내가 가진 내용을 얼마나 덜 괴롭히는지가 중요하다. 그래서 새 템플릿을 볼 때는 빈 화면보다 내용이 많은 페이지부터 확인한다.\n\n실제로 써본 뒤에야 추천할 말과 말리지 말아야 할 이유가 같이 생긴다."),
    ("a_tool_font_asset", "폰트 하나를 바꾸면 생기는 일", "디자인 에셋을 받아서 같은 문장을 폰트만 바꿔 여러 장 만들어봤다. 분위기는 달라졌는데 작은 화면에서 읽히는 정도는 또 달랐다.\n\n예쁜 시안 한 장만 보고 고르면 실제 게시물에서 글자가 묻힐 수 있다. 그래서 협업 제품을 볼 때는 작업 파일과 휴대폰 화면을 번갈아 확인한다.\n\n광고 문구보다 사용 과정에서 남는 불편을 먼저 말할 수 있어야 오래 같이 일할 수 있다."),
    ("a_tool_nocode_form", "노코드 도구를 써보고 남긴 질문", "노코드로 신청 폼과 안내 페이지를 연결해봤다. 만드는 과정은 빨랐는데, 신청자가 제출한 뒤 어디로 안내되는지가 애매해서 그 부분을 다시 손봤다.\n\n기능을 만들 수 있는지보다 사용자가 다음에 무엇을 해야 하는지가 더 중요했다. 화면 하나가 늘어날수록 운영자가 확인할 일도 같이 늘어나니까.\n\n도구를 소개할 때는 만들 수 있다는 말보다 실제 운영까지 이어지는지를 보게 된다."),
    ("c_solo_content_routine", "혼자 일하는 사람의 콘텐츠 루틴", "혼자 일하는 분들은 콘텐츠를 못 만들어서가 아니라, 일 끝나고 다시 처음부터 생각해야 해서 지치는 경우가 많다.\n\n그래서 작업하면서 생긴 질문과 수정 전후 화면을 바로 모아두고, 주말에 한 번만 글로 정리하는 방식을 같이 잡아봤다.\n\n매일 새로 만들지 않아도 이미 한 일을 다시 꺼내 쓸 수 있으면 콘텐츠가 조금 덜 무거워진다."),
    ("c_solo_brand_page", "1인 사업자 페이지에서 먼저 보는 것", "혼자 일하는 분이 만든 소개 페이지를 보는데 하고 싶은 일은 많은데 처음 온 사람이 무엇을 맡길 수 있는지는 잘 안 보였다.\n\n서비스를 전부 늘어놓기보다 지금 가장 잘하는 일과 문의 전에 필요한 정보부터 앞에 두었다. 페이지를 예쁘게 만드는 일보다 선택하기 쉽게 만드는 일이 먼저였다.\n\n1인 사업자는 혼자 다 할 수 있다는 걸 보여주는 것보다, 무엇을 맡기면 좋은지 분명하게 보여주는 편이 오래 간다."),
    ("c_solo_price_sheet", "견적서를 만들 때 빠지기 쉬운 것", "프리랜서 견적서를 같이 보다가 작업 항목은 많은데 수정 범위와 전달물이 빠져 있는 걸 봤다.\n\n처음에는 금액을 어떻게 보일지가 고민이었는데, 그보다 서로 무엇을 기대하는지가 먼저 정리돼야 했다.\n\n혼자 일할수록 가격표보다 약속의 범위를 문서로 남겨두는 일이 마음을 덜 쓰게 한다."),
    ("c_solo_channel_stack", "채널을 여러 개 운영할 때 생기는 착각", "블로그, 인스타, 유튜브를 한꺼번에 하겠다는 계획을 세우면 처음엔 부지런해진 기분이 든다. 그런데 같은 내용을 세 번 새로 만들기 시작하면 금방 지친다.\n\n하나의 작업에서 긴 글, 짧은 글, 영상 재료를 나누는 순서를 먼저 만들었다. 채널을 늘리는 것보다 한 번 만든 일을 여러 방식으로 쓰는 게 혼자 할 때는 훨씬 현실적이다.\n\n혼자 운영하는 사람에게 필요한 건 의지보다 다시 쓸 수 있는 구조일 때가 많다."),
    ("d_curriculum_repeated_question", "같은 질문이 계속 나올 때", "수업에서 같은 질문이 반복되면 수강생이 못 따라온다고만 생각하기 쉽다. 그런데 설명 순서나 자료에 빠진 단계가 있는 경우도 많다.\n\n이번에는 질문이 나온 순간의 화면과 앞에서 설명한 순서를 같이 적어봤다. 어느 지점에서 길이 끊겼는지 보이니까 다음 수업 자료도 달라졌다.\n\n강사는 답을 많이 하는 사람보다, 질문이 생긴 위치를 찾아 수업을 바꾸는 사람에 가까운 것 같다."),
    ("d_class_material_cut", "강의 자료에서 덜어낸 페이지", "강의 자료를 만들다 보면 넣고 싶은 설명이 계속 늘어난다. 이번에는 수강생이 실습 중 바로 찾지 못하는 페이지부터 뺐다.\n\n내용을 줄였더니 처음엔 허전했는데, 수업 중 멈춰서 자료를 넘기는 시간이 줄었다. 자료는 많이 담는 것보다 필요한 순간에 찾아지는 게 더 중요하다.\n\n강의 자료를 고치는 일은 글을 잘 쓰는 일보다 수강생의 손이 어디에서 멈추는지 보는 일에 가깝다."),
    ("d_feedback_pattern", "피드백을 모으면 수업이 달라지는 부분", "수강생 피드백을 모아보면 각자 다른 질문 같아도 자꾸 같은 지점에서 막힌다. 기능을 몰라서가 아니라 파일을 처음 열었을 때 무엇부터 봐야 하는지 몰라서였다.\n\n그래서 다음 과정에서는 기능 설명을 앞에 두지 않고 첫 파일을 읽는 순서부터 넣었다. 수업 하나를 바꾸는 데 거창한 개편보다 반복되는 한 문장이 더 도움이 될 때가 있다.\n\n현장 기록은 나중에 커리큘럼을 고칠 때 제일 정확한 자료가 된다."),
    ("d_platform_course_review", "온라인 강의에서 빠지기 쉬운 장면", "온라인 강의는 촬영할 때 설명이 잘 되면 끝난 것처럼 보인다. 그런데 실제로 따라 하는 사람은 파일을 어디서 받아야 하는지, 오류가 났을 때 어디부터 확인해야 하는지에서 멈춘다.\n\n그래서 강의 영상을 다시 볼 때 설명보다 멈춤 지점을 먼저 표시한다. 화면 밖에서 생기는 질문까지 들어가야 온라인 과정이 현장 수업처럼 움직인다.\n\n강의는 찍는 사람의 말보다 듣는 사람이 멈추는 순간을 얼마나 줄였는지가 더 오래 남는다."),
    ("d_workshop_format", "잘 가르치는 사람보다 다시 해보게 하는 수업", "수업이 끝난 뒤 고개를 끄덕이는 것과 다음 날 혼자 다시 해보는 건 다른 일이다.\n\n그래서 설명을 길게 하기보다 한 번 따라 하고, 일부러 작은 오류를 만나고, 그걸 다시 고치는 순서를 넣어보려 한다. 그때 질문이 더 구체적으로 바뀐다.\n\n교육은 이해했다는 말을 듣는 데서 끝나는 게 아니라, 혼자 다시 열어보게 만드는 데서 확인되는 것 같다."),
]

PRACTICAL_GUIDES = [
    (("excel_",), [
        "실무 파일 열었을 때 수식부터 넣지 말고 빈 셀이나 병합된 부분부터 한번 보라고 해. 그거 정리하고 나면 생각보다 길이 보일 때가 있거든 ㅎㅎ",
        "숫자가 갑자기 텍스트로 인식돼서 수식 에러 나면 진짜 당황스럽지ㅠ 그럴 땐 왼쪽 정렬인지 먼저 확인해보는 게 편해.",
    ], [
        "💬 처음 실무 파일 열었을 때 막막했던 적 있지? 알려줘~!",
        "📌 오늘 쓰는 파일 하나 열어서 빈 셀이랑 병합된 곳부터 가볍게 체크해봐.",
        "💬 #N/A 에러 때문에 고생했던 적 있으면 어떤 상황이었는지 얘기해줘~!",
    ]),
    (("ppt_",), [
        "발표 자료 만들 때 ‘이 페이지에서 사람들이 진짜 알아야 하는 게 뭐지?’ 하고 한 번만 짚어보면 훨씬 깔끔해져 ㅎㅎ",
        "슬라이드에 글씨가 너무 많으면 오히려 집중이 안 되더라고. 결론만 딱 남기고 나머지는 말로 풀어주는 게 낫지.",
    ], [
        "📌 지금 만드는 PPT 페이지에서 핵심 내용이 3초 만에 눈에 들어오는지 봐봐.",
        "💬 발표 끝나고 제일 자주 받는 질문 있으면 댓글로 남겨봐~!",
        "📌 다음 발표 자료는 한 장에 딱 한 가지만 남겨보기 어때?",
    ]),
    (("hwp_",), [
        "문서 보내기 전에 제목이랑 소제목만 쭉 이어 읽어보면 어색한 부분이 바로 눈에 띄더라고.",
        "안내문은 날짜나 장소처럼 손님이 제일 먼저 찾아야 하는 정보를 위쪽에 배치해주는 게 센스야.",
    ], [
        "📌 오늘 보내는 문서 있으면 제목만 먼저 가볍게 훑어봐.",
        "💬 문서 작성할 때 가장 자주 되묻는 질문 있으면 얘기해줘~!",
        "📌 양식 복사하기 전에 이번 글을 읽을 사람이 누군지 먼저 떠올려봐.",
    ]),
    (("photoshop_", "illustrator_"), [
        "홍보물 만들 때 폰트 종류만 두 개 이하로 줄여도 디자인이 훨씬 정돈돼 보여 ㅎㅎ",
        "만들기 전에 ‘이걸 본 사람이 3초 안에 알아야 할 한 가지’가 뭔지 먼저 정해두면 훨씬 수월해.",
    ], [
        "📌 지금 쓰는 홍보물에 폰트 몇 개나 쓰였는지 한번 세어봐.",
        "💬 광고 만들 때 제일 고민되는 부분이 뭔지 댓글로 남겨봐~!",
        "📌 오늘 만든 이미지에서 진짜 중요한 한 문장만 남기고 나머지는 조금 덜어내봐.",
    ]),
    (("video_", "youtube_", "creator_"), [
        "효과 신나게 넣기 전에 오디오 파형부터 먼저 보는 게 편해. 말없는 구간이나 ‘어…’ 하는 부분만 깔끔하게 쳐내도 영상 리듬이 확 살아나거든.",
        "업로드하기 전에 첫 5초만 따로 봐봐. 이 영상이 누구한테 필요한지 바로 안 보이면 도입을 살짝 손보는 게 좋아.",
    ], [
        "💬 영상 편집할 때 제일 시간 오래 걸리는 작업이 뭔지 얘기해줘~!",
        "📌 다음 영상은 효과 하나 넣기 전에 말없는 구간부터 먼저 깔끔하게 잘라봐.",
        "💬 썸네일이나 제목 보고 들어왔다가 아쉬웠던 적 있지?",
    ]),
    (("sns_", "smallbiz_", "marketing_"), [
        "홍보글 올리기 전에 가격이나 위치, 예약 방법이 한눈에 들어오는지 꼭 확인해봐야 해. 예쁘게 만들어도 모바일에서 찾기 힘들면 그냥 나가버리더라고ㅠ",
        "문장 쓰기 전에 ‘손님이 여기서 제일 궁금해할 게 뭘까’ 먼저 적어보면 글이 훨씬 선명해져.",
    ], [
        "💬 오늘 올릴 홍보글에서 손님이 가장 먼저 궁금해할 점에 답해봐.",
        "💬 내 가게 홍보하면서 제일 설명하기 까다로웠던 적 있지? 알려줘~!",
        "📌 손님 입장에서 내 홍보물을 한번 읽어봐봐.",
    ]),
    (("career_", "jobtalk_"), [
        "관심 있는 채용공고 세 개를 열고 담당 업무와 우대사항만 적어봐. 그다음에 필요한 자격증을 고르면 늦지 않다.",
        "이력서에 적을 경험 하나를 골라서 ‘문제-내가 한 행동-결과’ 순서로 세 줄만 써봐. 거기서부터 내 이야기가 시작된다.",
    ], [
        "💬 지금 준비 중인 직무나 가고 싶은 분야가 있으면 댓글로 남겨봐.",
        "📌 자격증 검색하기 전에 채용공고 세 개부터 열어보길.",
        "💬 이력서에서 설명하기 제일 어려운 경험이 있으면 남겨봐.",
    ]),
    (("three_d_",), [
        "출력 전에 슬라이서 미리보기에서 레이어와 지지대를 먼저 살펴보자. 화면에서는 멀쩡해 보여도 실제 출력은 다르게 나올 수 있다.",
        "첫 출력이 틀어지면 바로 새 파일부터 만들지 말고, 휜 지점과 바닥에서 떨어진 지점부터 표시해봐. 다음 수정이 훨씬 빨라진다.",
    ], [
        "💬 3D 출력에서 제일 많이 실패하는 부분이 있으면 댓글로 남겨봐.",
        "📌 다음 출력 전에는 지지대를 한 번 더 살펴보세요. 바닥에서 떨어지는 문제를 줄이는 데 도움이 된다.",
        "💬 첫 실패를 어떻게 수정했는지 경험 있으면 나눠봐.",
    ]),
    (("practical_", "office_", "class_owner_"), [
        "막히는 순간에는 지금까지 한 것, 안 된 것, 해보고 싶은 걸 한 줄씩 적어봐. 질문도 답도 훨씬 빨라진다.",
        "같은 질문이 세 번 나오면 개인 문제가 아니라 수업이나 업무 흐름의 문제일 수 있다. 그 지점부터 다시 봐야 한다.",
    ], [
        "💬 실무에서 혼자 막혔던 순간이 있으면 어떤 파일이었는지 남겨봐.",
        "📌 오늘 막힌 일 하나를 ‘한 것-안 된 것-다음 시도’로 적어봐.",
        "💬 수업이나 업무에서 반복되는 질문이 있으면 댓글로 알려줘.",
    ]),
]


SPECIFIC_PRACTICAL_GUIDES = {
    "excel_certificate_gap": (
        "",
        "💬 처음 실무 엑셀 파일을 열었을 때 제일 막막했던 순간 언제였어?? 알려줘~!",
    ),
    "photoshop_pretty_not_sell": (
        "",
        "📌 지금 만드는 홍보물 있으면 폰트 종류가 몇 개인지 확인해봐!!",
    ),
    "youtube_title_promise": (
        "",
        "💬 제목만 보고 들어갔다가 내용에 실망했던 적 있어?? 알려줘~!",
    ),
    "career_certificate_question": (
        "",
        "📩 준비 중인 직무나 가고 싶은 분야 있으면 댓글로 알려줘~! 먼저 봐야 할 툴 같이 찾아보자ㅎㅎ",
    ),
}


def variant_index(seed_id: str, date_text: str, slot: str, size: int, salt: str) -> int:
    signature = f"{seed_id}|{date_text}|{slot}|{salt}"
    return sum((index + 1) * ord(character) for index, character in enumerate(signature)) % size


def persona_axis_for(seed_id: str) -> str:
    """B를 중심으로 A·C·D를 보조하는 협업형 강사 축을 결정한다."""
    if seed_id.startswith("a_"):
        return "A"
    if seed_id.startswith("c_"):
        return "C"
    if seed_id.startswith("d_"):
        return "D"
    # 기존 교육·상담·마케팅 소재는 현장 실무 컨설턴트(B)로 이어진다.
    if seed_id.startswith((
        "b_", "excel_", "ppt_", "hwp_", "photoshop_", "illustrator_", "video_",
        "youtube_", "sns_", "smallbiz_", "marketing_", "career_", "jobtalk_",
        "three_d_", "office_", "practical_",
    )):
        return "B"
    return "D"


PERSONA_LABELS = {
    "A": "현장형 실무 툴·템플릿 테스터",
    "B": "직장인·소상공인 실무 스킬 컨설턴트",
    "C": "1인 사업자·솔로프리너 커리큘럼 디자이너",
    "D": "현장 소통형 프로 클래스 마스터",
}


PERSONA_FINISHES = {
    "A": ("", ""),
    "B": ("", ""),
    "C": ("", ""),
    "D": ("", ""),
}


def practical_finish(seed_id: str, date_text: str, slot: str) -> tuple[str, str]:
    axis = persona_axis_for(seed_id)
    if seed_id.startswith(("a_", "b_", "c_", "d_")):
        return PERSONA_FINISHES[axis]
    if seed_id in SPECIFIC_PRACTICAL_GUIDES:
        return SPECIFIC_PRACTICAL_GUIDES[seed_id]
    for prefixes, tips, ctas in PRACTICAL_GUIDES:
        if seed_id.startswith(prefixes):
            tip = tips[variant_index(seed_id, date_text, slot, len(tips), "tip")]
            cta = ctas[variant_index(seed_id, date_text, slot, len(ctas), "cta")]
            return tip, cta
    return (
        "오늘 다루는 도구가 어떤 문제를 덜어주는지 한 번만 더 적어봐. 그 기준이 있어야 배우는 순서도 정리된다.",
        "💬 지금 배우는 도구로 해결하고 싶은 일이 있으면 댓글로 남겨봐.",
    )


ANGLES = [("afternoon", "교육 현장 메모"), ("night", "원장님의 수업 생각")]
PERSONA_ROTATION = ("B", "B", "B", "A", "B", "C", "B", "D")


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
            if not timedelta(days=0) <= target - scheduled <= timedelta(days=RECENT_DEDUPE_DAYS):
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


def pillar_for(seed_id: str) -> str:
    if seed_id.startswith(("excel_", "ppt_", "hwp_", "photoshop_", "illustrator_", "video_", "youtube_", "three_d_", "office_")):
        return "practical_tool_education"
    if seed_id.startswith(("sns_", "smallbiz_", "marketing_", "creator_")):
        return "small_business_marketing_education"
    if seed_id.startswith(("career_", "jobtalk_")):
        return "career_lecture_judgment"
    return "education_business_judgment"


def topic_tag_for(seed_id: str) -> str:
    """Return one precise Threads topic tag; the publisher sends it separately from body text."""
    tag_rules = (
        (("excel_", "office_"), "엑셀 실무"),
        (("ppt_",), "파워포인트"),
        (("hwp_",), "한글 문서"),
        (("photoshop_",), "포토샵"),
        (("illustrator_",), "일러스트레이터"),
        (("video_",), "영상 편집"),
        (("youtube_", "creator_"), "유튜브"),
        (("sns_", "smallbiz_", "marketing_"), "소상공인 마케팅"),
        (("career_", "jobtalk_"), "진로 상담"),
        (("three_d_pen_",), "3D펜"),
        (("three_d_printer_", "three_d_design_"), "3D프린터"),
        (("practical_", "class_owner_"), "직무 교육"),
    )
    for prefixes, tag in tag_rules:
        if seed_id.startswith(prefixes):
            return tag
    return "실무 교육"


def pick_topic(date_text: str, slot: str) -> dict:
    seed_number = int(date_text.replace("-", "")) + (1 if slot == "night" else 0)
    recent_seed_ids = {seed_id_from_identity(identity) for identity in recent_content_ids(date_text)} - {""}
    angle_label = dict(ANGLES).get("night" if slot == "night" else "afternoon", "교육 현장 메모")
    candidates = [
        {
            "content_id": content_id_for(seed_id, slot),
            "seed_id": seed_id,
            "title": title,
            "text": text,
            "angle": angle_label,
            "pillar": pillar_for(seed_id),
            "persona_axis": persona_axis_for(seed_id),
            "persona_label": PERSONA_LABELS[persona_axis_for(seed_id)],
        }
        for seed_id, title, text in OBSERVATION_SEEDS
    ]
    ordered = sorted(candidates, key=lambda item: item["seed_id"])
    rotated = ordered[seed_number % len(ordered):] + ordered[:seed_number % len(ordered)]
    preferred_axis = PERSONA_ROTATION[seed_number % len(PERSONA_ROTATION)]
    axis_order = [preferred_axis] + [axis for axis in ("B", "A", "C", "D") if axis != preferred_axis]
    for axis in axis_order:
        axis_candidates = [candidate for candidate in rotated if candidate["persona_axis"] == axis]
        for candidate in axis_candidates:
            if candidate["seed_id"] not in recent_seed_ids:
                return candidate
    raise RuntimeError("최근 21일 안에 재사용하지 않을 제이쌤 교육 소재가 부족합니다. 새 소재를 추가한 뒤 다시 실행하세요.")


def existing_draft_for_slot(date_text: str, slot: str) -> Path | None:
    out_dir = OUT_ROOT / date_text
    if not out_dir.exists():
        return None
    prefix = f"JAY-{date_text.replace('-', '')}-{slot}-"
    for draft_path in sorted(out_dir.glob(f"{prefix}*.json")):
        draft = read_json(draft_path, {})
        if str(draft.get("status")) in {"approved", "published", "held", "publish_failed"}:
            return draft_path
    return None


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

    tip, cta = practical_finish(topic["seed_id"], date_text, slot)
    suffix_parts = ([f"📌 {tip}"] if tip else []) + [cta]
    suffix = "\n\n".join(suffix_parts)
    thread_text = f"{topic['text']}\n\n{suffix}"
    if len(thread_text) > 500:
        available_body = 500 - len(suffix) - len("\n\n…")
        thread_text = f"{topic['text'][:available_body].rstrip()}…\n\n{suffix}"
    draft = {
        "id": draft_id,
        "content_id": topic["content_id"],
        "date": date_text,
        "slot": slot,
        "account": os.environ.get("THREADS_USER_ID", ""),
        "status": "approved",
        "title": topic["title"],
        "topic": topic["title"],
        "topic_tag": topic_tag_for(topic["seed_id"]),
        "pillar": topic["pillar"],
        "persona_axis": topic.get("persona_axis", "B"),
        "persona_label": topic.get("persona_label", PERSONA_LABELS["B"]),
        "collaboration_fit": {
            "B": ["교육 플랫폼", "러닝 커뮤니티", "기업 실무교육", "직무 전환 프로그램"],
            "A": ["SaaS", "오피스·디자인 툴", "템플릿 마켓", "교육용 장비"],
            "C": ["1인 사업자 커뮤니티", "코워킹 브랜드", "노코드·생산성 서비스"],
            "D": ["온라인 클래스", "교육 출판", "강의 제작·운영 파트너"],
        }.get(topic.get("persona_axis", "B"), []),
        "content_type": "practical_education_participation_note",
        "angle": topic["angle"],
        "threads_text": thread_text,
        "thread_comments": [],
        "local_media_paths": [],
        "source_urls": [],
        "source_note": "제이쌤의 실무 교육·소상공인 마케팅·진로 강의 현장에서 나온 생각",
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "editorial_rules": {
            "strategy_skill": "jayssam-threads-content-strategy",
            "voice": "30대 초반 여성 강사의 따뜻하고 편안한 대화체 (ㅎㅎ, ㅠㅠ, 있거든, 그런 거지, ~해, 알려줘~!)",
            "persona_mix": "B 55% 내외, A 15%, C 15%, D 15%; 같은 과목이 아니라 문제 장면 기준으로 순환",
            "structure": "첫 장면의 문제 → 현장에서 드러난 원인 → 강사가 바꾼 판단 또는 작업 순서 → 독자가 다음 장면을 상상할 수 있는 끝",
            "collaboration_rule": "제품·플랫폼을 먼저 칭찬하지 않고 실제 파일·수강생 반응·운영 장면에서 필요성이 생길 때만 언급",
            "topic_tag_policy": "본문 해시태그 나열 없이 내용과 가장 가까운 Threads 토픽 태그 한 개만 API에 전달",
            "avoid": ["아동·학부모 소재", "뉴스 요약", "AI 설명체", "학습지식 해설", "하대형 명령", "공격적·비하 표현", "과장된 약속", "같은 종결어 반복"],
            "dedupe_days": RECENT_DEDUPE_DAYS,
        },
    }
    draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT_ROOT / "latest-draft-path.txt").write_text(f"{draft_path.as_posix()}\n", encoding="utf-8")
    return draft_path


def main() -> None:
    date_text = os.environ.get("JAYSSAM_DATE") or (os.sys.argv[1] if len(os.sys.argv) > 1 else kst_today())
    slot = os.environ.get("JAYSSAM_SLOT") or (os.sys.argv[2] if len(os.sys.argv) > 2 else "afternoon")
    existing = existing_draft_for_slot(date_text, slot)
    if existing:
        (OUT_ROOT / "latest-draft-path.txt").write_text(f"{existing.as_posix()}\n", encoding="utf-8")
        print(existing)
        return
    print(write_draft(pick_topic(date_text, slot), date_text, slot))


if __name__ == "__main__":
    main()
