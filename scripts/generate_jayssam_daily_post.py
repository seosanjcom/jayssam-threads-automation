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
    ("excel_certificate_gap", "실무 파일 앞에서 멈추는 이유", "‘선생님, 자격증은 땄는데 실무 파일 보니까 손도 못 대겠어요.’\n수업하다 보면 참 자주 듣는 이야기다.\n\n당연한 결과다. 시험은 잘 정돈된 표를 주고 ‘VLOOKUP을 쓰라’고 알려주지만, 실제 회사 데이터는 셀 병합과 오타, 공백이 엉켜있는 상태로 들어오니까.\n\n자격증이 도구 위치를 익힌 거라면, 실무는 문제의 원인을 찾아 고쳐내는 작업이다. 처음 보는 파일을 받으면 수식부터 넣지 말고 Ctrl + G를 눌러 빈 셀부터 파악해 보는 게 좋다. 병합을 풀고 데이터 형태를 정돈하는 게 함수보다 먼저다."),
    ("excel_function_definition", "엑셀 함수를 다 외워야 하냐는 질문", "엑셀 함수 다 외워야 하냐고 묻는 수강생이 많다. 솔직히 다 외울 필요 없다.\n\n현장에선 검색도 하고 AI한테도 물어본다. 대신 내가 지금 뭘 만들고 싶은지, 어떤 값이 이상한지는 정확히 말할 줄 알아야 한다.\n\n함수 암기보다 문제를 정의하는 힘. 그게 있어야 검색 결과도 검증할 수 있다."),
    ("excel_manual_cleanup", "복붙으로 버티던 엑셀 파일", "직장인 수강생 파일을 보는데 같은 내용을 열두 번 복사해서 붙여넣고 있었다.\n\n처음엔 그냥 빨리 끝내려고 그랬겠지. 그런데 그 방식은 다음 달에도 같은 시간을 또 쓰게 만든다.\n\n엑셀은 표를 예쁘게 만드는 도구가 아니라, 반복되는 일을 덜어내는 도구다. 그 관점이 생기면 함수 하나 배우는 이유도 달라진다."),
    ("excel_wrong_total", "숫자가 맞아도 틀린 보고서", "엑셀 보고서에서 합계는 맞는데 결론이 틀린 경우가 있다.\n\n월별 숫자만 보고 매출이 올랐다고 말했는데, 할인 폭이나 객단가를 같이 안 본 거다. 수식은 틀리지 않았어도 해석은 틀릴 수 있다.\n\n그래서 수업에서는 결과값보다 먼저 묻는다. 이 숫자로 뭘 판단하려는 건지. 그 질문을 빼면 엑셀은 계산기에서 못 벗어난다."),
    ("ppt_pretty_not_persuade", "예쁜 피피티가 설득까지 해주진 않는다", "파워포인트 수업하면 예쁜 템플릿부터 찾는 분들이 많다.\n\n그런데 발표 듣는 사람은 슬라이드가 예쁜지보다, 그래서 내가 뭘 결정하면 되는지를 먼저 본다. 화려한 디자인이 메시지를 대신해주진 않는다.\n\n피피티는 장식하는 도구가 아니라 생각의 순서를 보여주는 도구다. 첫 장을 만들기 전에 결론부터 한 문장으로 정리하는 이유가 여기 있다."),
    ("ppt_one_slide_one_message", "한 장에 다 넣고 싶은 마음", "오늘 피피티 한 장에서 문장 네 줄을 지웠다.\n\n수강생은 중요한 내용을 빼면 불안하다고 했다. 그런데 중요한 말이 너무 많아지면 듣는 사람은 결국 아무것도 못 잡는다.\n\n한 장에 하나만 남기는 건 내용을 줄이는 일이 아니다. 상대가 기억할 한 가지를 고르는 일이다."),
    ("ppt_boss_question", "보고 끝나고 꼭 나오는 질문", "직장인 피피티를 같이 고치다 보면 마지막에 꼭 이런 질문이 나온다. ‘그래서 어떻게 하자는 건데요?’\n\n자료에 숫자도 많고 분석도 많은데, 정작 결정할 문장이 없었던 거다. 보고서는 많이 보여주는 사람보다 판단을 쉽게 만들어주는 사람이 잘 만든다.\n\n피피티에서 제일 먼저 써야 하는 건 목차가 아니라, 이 보고를 보고 상대가 어떤 결정을 하면 되는지다."),
    ("hwp_official_document", "한글 문서가 어려운 진짜 이유", "한글 문서는 기능이 어려워서가 아니라, 누가 읽을 문서인지 생각 안 하고 쓰면 어려워진다.\n\n행정 문서든 안내문이든 내 머릿속 순서대로 적으면 보는 사람은 계속 되묻게 된다. 그래서 문단 정리 전에 제목과 소제목부터 다시 잡는다.\n\n문서는 글을 잘 쓰는 사람이 아니라, 읽는 사람의 시간을 아는 사람이 잘 만든다."),
    ("hwp_template_dependence", "양식만 바꿔 쓰면 생기는 일", "한글 문서 양식만 바꿔 쓰면 편할 것 같지만, 꼭 필요한 내용까지 예전 문장을 따라가게 된다.\n\n오늘도 안내문 하나를 보는데 날짜만 바뀌고 정작 신청자가 알아야 할 내용은 뒤에 숨어 있었다.\n\n양식은 시작점이지 답안지가 아니다. 매번 누가 읽는지 보고 한 번은 다시 손봐야 한다."),
    ("photoshop_pretty_not_sell", "예쁜 디자인보다 먼저 봐야 할 것", "가게를 운영하시는 사장님들께 가장 많이 받는 질문이 있다.\n‘화려하게 디자인해서 광고를 돌렸는데 왜 반응이 없을까요?’\n\n포토샵은 이미지를 보기 좋게 다듬어주는 도구일 뿐, 지갑을 열게 만드는 건 ‘이 상품이 나에게 왜 필요한가’에 대한 설득력이다.\n\n툴 기능을 외우기 전에 내 손님이 진짜 듣고 싶어 하는 말이 무엇인지 찾는 게 먼저다. 한 페이지에 폰트가 3~4개씩 섞이면 시선이 분산되어 읽히지 않는다. 가장 중요한 한 문장만 남기고 폰트 종류를 2개 이하로 줄이는 것부터 시작해 보자."),
    ("photoshop_banner_question", "배너를 만들기 전에 묻는 질문", "포토샵으로 배너를 만들기 전에 나는 늘 묻는다. 이걸 본 사람이 3초 안에 뭘 알아야 하냐고.\n\n사진이 예쁘고 글자가 많아도 답이 안 나오면 그냥 복잡한 이미지가 된다. 할인인지, 예약인지, 신메뉴인지 하나부터 정해야 한다.\n\n디자인 감각은 색을 많이 쓰는 데서 안 나온다. 뺄 말을 고르는 데서 나온다."),
    ("photoshop_copy_not_effect", "효과보다 문장 하나", "포토샵 수업에서 효과를 여러 개 넣은 작업물을 볼 때가 있다.\n\n시간은 정말 많이 들었는데, 막상 무엇을 파는지는 잘 안 보인다. 그럴 땐 효과를 더 가르치기보다 문장 하나부터 고친다.\n\n사람은 반짝이는 글자를 기억하기보다, 자기한테 필요한 말을 기억한다."),
    ("illustrator_logo_before_shape", "로고를 그리기 전에 할 일", "일러스트레이터로 로고부터 그리고 싶어 하는 분들이 많다.\n\n그런데 내 가게가 어떤 손님에게 어떤 느낌으로 기억되고 싶은지 정리 안 하면, 예쁜 도형만 계속 늘어난다. 로고는 그림 솜씨보다 방향이 먼저다.\n\n색을 고르기 전에 내 가게를 한 문장으로 말해보라고 하는 이유도 그래서다."),
    ("illustrator_brand_consistency", "예쁜 시안이 브랜드가 되려면", "명함, 배너, 인스타 이미지가 다 예쁜데 서로 다른 가게처럼 보이는 경우가 있다.\n\n각각 잘 만든 것과 한 브랜드로 보이는 건 다른 문제다. 폰트 하나, 색 하나, 말투 하나가 반복돼야 기억에 남는다.\n\n일러스트레이터는 그림을 만드는 프로그램이지만, 브랜딩 수업에서는 기준을 만들 때 더 많이 쓴다."),
    ("video_effect_not_story", "화려한 편집보다 기획", "영상편집 배우러 오면 다들 자막 효과나 전환부터 물어본다.\n\n그런데 효과가 화려하다고 사람들이 끝까지 보진 않는다. 3분짜리 영상도 왜 봐야 하는지 설득이 안 되면 바로 나간다.\n\n영상 교육은 버튼 누르는 법보다 이야기를 짜는 힘을 먼저 다뤄야 한다. 편집은 그다음에 붙는 기술이다."),
    ("video_cut_for_viewer", "내가 아까운 장면과 보는 사람이 지루한 장면", "영상 편집할 때 찍느라 고생한 장면을 못 자르는 분들이 많다.\n\n내가 아까운 장면과 보는 사람이 필요한 장면은 다를 수 있다. 오늘도 20초짜리 도입을 6초로 줄였더니 영상이 훨씬 빨리 본론으로 들어갔다.\n\n편집은 덜어내는 기술이다. 내가 공들인 것보다 시청자가 끝까지 볼 이유를 남겨야 한다."),
    ("video_audio_first", "영상에서 먼저 고쳐야 하는 것", "영상이 뭔가 어색하면 다들 화면부터 만진다.\n\n그런데 소리가 안 들리거나 말이 너무 빠르면 화면이 아무리 좋아도 못 본다. 시청자는 생각보다 화질보다 흐름과 소리에 먼저 반응한다.\n\n편집 수업에서 자막보다 음량 조절을 먼저 다루는 날이 있는 이유다."),
    ("youtube_title_promise", "유튜브 제목은 낚시가 아니라 약속이다", "자극적인 제목으로 관심을 끌면 일시적인 조회수는 나올지 모른다.\n\n하지만 기대하고 들어온 시청자에게 내용이 미치지 못하면, 속았다는 생각에 그 채널은 다시 찾지 않는다. 제목은 사람을 낚는 도구가 아니라 시청자와 하는 약속이다.\n\n그래서 수업할 때 편집 프로그램을 켜기 전에 제목부터 쉽게 뽑지 못하게 한다. ‘이 영상이 시청자의 문제를 한 가지라도 확실히 해결해 줄 수 있는가?’ 이 질문에 답할 수 없다면 아무리 화려한 편집도 의미를 갖기 어렵다."),
    ("youtube_short_not_easy", "짧은 영상이 더 쉬울 거라는 착각", "쇼츠는 짧으니까 만들기 쉽다고들 한다. 막상 해보면 반대다.\n\n짧을수록 군더더기 하나가 더 크게 보이고, 처음 2초에 왜 봐야 하는지가 나와야 한다. 길이가 줄어든다고 기획까지 줄어드는 건 아니다.\n\n짧은 영상은 대충 만든 긴 영상이 아니라, 핵심만 남긴 다른 형식이다."),
    ("youtube_upload_not_finish", "영상 올렸다고 끝난 게 아니다", "유튜브 영상 하나 올리고 조회수만 보는 건 조금 아쉽다.\n\n어디서 나갔는지, 어떤 댓글이 달렸는지 보면 다음 영상에서 고칠 게 나온다. 올리는 건 발행이고, 배우는 건 그다음부터다.\n\n콘텐츠는 한 번 잘 만드는 것보다 다음 편에서 조금 덜 헤매는 쪽이 오래 간다."),
    ("sns_marketing_post_not_sales", "인스타에 매일 올려도 손님이 안 오는 이유", "SNS 마케팅 수업에서 ‘매일 올리는데 왜 문의가 없죠?’라는 질문을 듣는다.\n\n게시물 수가 부족해서가 아니라, 보는 사람이 왜 지금 내게 와야 하는지가 안 보이는 경우가 많다. 예쁜 사진만으로는 선택할 이유가 생기지 않는다.\n\n오늘 손님이 궁금해할 한 가지를 대신 설명해주는 글. 그게 쌓여야 계정도 가게도 신뢰를 얻는다."),
    ("sns_customer_not_algorithm", "알고리즘보다 먼저 봐야 할 사람", "SNS 하다 보면 알고리즘 얘기부터 나오는데, 나는 손님 얘기부터 한다.\n\n도달 수가 올라가도 엉뚱한 사람에게만 보이면 매출은 안 바뀐다. 내 가게를 찾을 사람이 어떤 말에 멈추는지부터 알아야 한다.\n\n알고리즘은 바뀌어도 손님이 궁금해하는 건 크게 안 바뀐다. 그래서 그쪽부터 공부한다."),
    ("sns_before_after_proof", "후기보다 먼저 보여줘야 할 장면", "SNS에 후기만 올리면 충분하다고 생각하는 사장님들이 있다.\n\n후기는 좋다. 다만 처음 보는 사람은 이 서비스가 자기 문제를 어떻게 바꾸는지 먼저 보고 싶어 한다. 전후 장면이나 과정이 필요한 이유다.\n\n마케팅은 자랑하는 일이 아니라, 상대가 자기 상황을 떠올리게 돕는 일이다."),
    ("smallbiz_product_explanation", "사장님이 자기 상품을 제일 어렵게 설명할 때", "소상공인 마케팅 수업에서 상품 설명을 써보면 의외로 사장님들이 제일 막힌다.\n\n매일 다루는 상품이라 너무 잘 알아서, 처음 보는 손님이 어디에서 궁금해할지를 놓치기 쉽다. 그래서 나는 설명을 멋있게 쓰기보다 손님 질문부터 적게 한다.\n\n좋은 소개글은 어려운 말을 쓰는 글이 아니다. 손님이 물어볼 말을 미리 답해주는 글이다."),
    ("smallbiz_discount_habit", "할인부터 꺼내면 생기는 일", "손님이 줄었다고 바로 할인부터 붙이는 가게가 많다.\n\n할인은 선택을 빠르게 만들 수는 있지만, 왜 이 가게여야 하는지까지 설명해주진 않는다. 가격 말고도 내가 더 잘하는 이유가 있어야 다시 찾아온다.\n\n마케팅은 싸게 파는 기술이 아니다. 내 가게의 가치를 알아듣게 만드는 일이다."),
    ("smallbiz_owner_as_customer", "사장님이 손님 자리에서 보면 달라지는 것", "가게 홍보물을 만들 때 사장님께 손님 입장에서 한 번 읽어보라고 한다.\n\n당연히 알 거라고 생각했던 위치, 가격, 예약 방법이 빠져 있는 경우가 정말 많다. 운영하는 사람에게 익숙한 건 손님에겐 처음 보는 정보다.\n\n내 사업을 제3자 눈으로 보는 연습. 마케팅 수업에서 그게 제일 어렵고 제일 중요하다."),
    ("career_certificate_question", "자격증을 따려는 목적부터 물어야 하는 이유", "진로 특강을 가면 항상 나오는 질문이 있다.\n‘무슨 자격증을 따야 취업이 잘되나요?’\n\n그럴 때 나는 역으로 물어본다. ‘그 자격증을 따서 정확히 어느 업무에 활용하고 싶은가요?’\n\n명확한 목적 없이 남들이 따니까 따라서 취득하는 자격증은 이력서 한 줄에 그치기 쉽다. 회사는 자격증의 개수보다 이 도구로 실제 문제를 해결할 수 있는지를 본다.\n\n가고 싶은 직무의 채용공고 3개를 찾아 우대사항에 적힌 툴이 무엇인지부터 확인해 보자. 필요한 무기를 파악한 뒤에 교육을 시작해도 늦지 않다."),
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
]

PRACTICAL_GUIDES = [
    (("excel_",), [
        "실무 파일을 받으면 Ctrl + G로 빈 셀부터 살펴보는 게 좋다. 병합 셀과 텍스트 숫자를 먼저 정리해두면 수식도 훨씬 안정적으로 들어간다.",
        "수식 넣기 전에 숫자가 왼쪽 정렬돼 있는지부터 봐. 텍스트로 저장된 숫자면 함수가 맞아도 결과가 틀어진다.",
    ], [
        "💬 실무 엑셀 파일 열었을 때 제일 당황했던 순간 있으면 댓글로 남겨봐.",
        "📌 오늘 쓰는 파일 하나를 열어 빈 셀과 병합 셀부터 살펴보세요.",
        "💬 #N/A 때문에 막혔던 적 있으면 어떤 상황이었는지 남겨봐.",
    ]),
    (("ppt_",), [
        "슬라이드마다 ‘그래서 뭘 결정하면 되지?’를 적어봐. 답이 없는 페이지는 먼저 덜어내야 한다.",
        "발표 전 슬라이드 한 장을 3초만 보자. 결론이 바로 보이지 않으면 문장을 조금 덜어내는 편이 낫다.",
    ], [
        "📌 지금 만드는 PPT 한 장에서 ‘그래서 어떻게 하자는 건데?’의 답이 보이는지 살펴보세요.",
        "💬 보고 끝나고 제일 자주 받는 질문이 있으면 댓글로 남겨봐.",
        "📌 다음 발표 자료에서는 한 장에 하나만 남겨보길.",
    ]),
    (("hwp_",), [
        "문서 보내기 전 제목과 소제목만 이어서 읽어봐. 그 순서만으로 내용이 보이지 않으면 본문도 다시 잡아야 한다.",
        "안내문에는 날짜·장소·대상·신청 방법을 먼저 찾아서 표시해봐. 읽는 사람이 다시 물을 부분이 바로 보인다.",
    ], [
        "📌 오늘 보내는 문서 하나가 있으면 제목만 먼저 훑어봐.",
        "💬 문서 작성할 때 가장 자주 되묻는 질문이 있으면 남겨봐.",
        "📌 양식을 복사하기 전에 이번 문서의 독자가 누군지 한 줄로 적어봐.",
    ]),
    (("photoshop_", "illustrator_"), [
        "홍보물 한 장에는 폰트를 두 종류까지만 남겨봐. 강조는 색과 크기보다 먼저 정보의 순서에서 나온다.",
        "만들기 전에 ‘이걸 본 사람이 3초 안에 알아야 할 한 가지’를 먼저 적어봐. 그 문장이 디자인 기준이 된다.",
    ], [
        "📌 지금 쓰는 홍보물에서 폰트가 몇 개인지 먼저 세어봐.",
        "💬 광고 만들 때 제일 결정하기 어려운 정보가 뭔지 댓글로 남겨봐.",
        "📌 오늘 만든 이미지 하나에서 가장 중요한 문장만 남기고 나머지를 한 번 덜어내봐.",
    ]),
    (("video_", "youtube_", "creator_"), [
        "효과 넣기 전에 오디오 파형부터 봐. 말없는 구간과 ‘어…’ 하는 부분만 잘라내도 영상 리듬이 확 달라진다.",
        "업로드 전에 첫 5초만 따로 봐. 이 영상이 누구의 어떤 문제를 해결하는지 바로 안 보이면 도입부터 다시 잡아야 한다.",
    ], [
        "💬 영상 편집에서 제일 오래 붙잡고 있는 작업이 뭔지 댓글로 남겨봐.",
        "📌 다음 영상은 효과 하나 넣기 전에 말없는 구간부터 먼저 잘라봐.",
        "💬 제목과 내용이 어긋났던 영상 경험이 있으면 남겨봐.",
    ]),
    (("sns_", "smallbiz_", "marketing_"), [
        "올리기 전에는 가격·위치·예약 방법이 한눈에 보이는지 먼저 살펴보자. 예쁜 이미지도 필요한 정보가 빠지면 그냥 지나가기 쉽다.",
        "홍보 문장을 쓴 뒤에는 ‘그래서 왜 지금 여기여야 하지?’를 붙여봐. 답이 없으면 상품 설명부터 다시 잡아야 한다.",
    ], [
        "📌 오늘 올릴 홍보글 하나에서 손님 질문 한 가지를 먼저 답해봐.",
        "💬 내 가게 홍보에서 제일 설명하기 어려운 부분이 있으면 댓글로 남겨봐.",
        "📌 손님 입장에서 홍보물을 한 번 읽어보고, 가격·위치·예약 방법이 바로 보이는지 확인해 보세요.",
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
        "💬 처음 실무 엑셀 파일을 열었을 때 가장 막막했던 순간은 언제였나요?",
    ),
    "photoshop_pretty_not_sell": (
        "",
        "📌 지금 제작 중인 홍보물이 있다면 폰트 종류가 몇 개나 쓰였는지 먼저 확인해 보세요.",
    ),
    "youtube_title_promise": (
        "",
        "💬 제목만 보고 들어갔다가 내용에 실망했던 경험이 있다면 이야기해 주세요.",
    ),
    "career_certificate_question": (
        "",
        "📩 준비 중인 직무나 가고 싶은 분야를 댓글로 남겨주시면, 먼저 살펴봐야 할 핵심 도구를 짚어드릴게요.",
    ),
}


def variant_index(seed_id: str, date_text: str, slot: str, size: int, salt: str) -> int:
    signature = f"{seed_id}|{date_text}|{slot}|{salt}"
    return sum((index + 1) * ord(character) for index, character in enumerate(signature)) % size


def practical_finish(seed_id: str, date_text: str, slot: str) -> tuple[str, str]:
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
        }
        for seed_id, title, text in OBSERVATION_SEEDS
    ]
    ordered = sorted(candidates, key=lambda item: item["seed_id"])
    rotated = ordered[seed_number % len(ordered):] + ordered[:seed_number % len(ordered)]
    for candidate in rotated:
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
        "pillar": topic["pillar"],
        "content_type": "practical_education_participation_note",
        "angle": topic["angle"],
        "threads_text": thread_text,
        "thread_comments": [],
        "local_media_paths": [],
        "source_urls": [],
        "source_note": "제이쌤의 실무 교육·소상공인 마케팅·진로 강의 현장에서 나온 생각",
        "created_at": datetime.now(KST).isoformat(timespec="seconds"),
        "editorial_rules": {
            "voice": "상대를 가르치려 들지 않고, 현장을 정확히 짚는 전문성과 품위가 느껴지는 담백한 강사 톤",
            "structure": "실제 수강생 질문 또는 실수 → 왜 현장에서 막히는지 → 차분한 실무 팁 → 예의를 지킨 댓글·행동 유도",
            "avoid": ["아동·학부모 소재", "뉴스 요약", "AI 설명체", "학습지식 해설", "하대형 명령", "공격적·비하 표현", "짚어볼게·체크해봐류 템플릿", "과장된 약속", "같은 종결어 반복"],
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
