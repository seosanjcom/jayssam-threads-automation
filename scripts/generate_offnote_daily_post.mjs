import fs from "node:fs";
import path from "node:path";

function kstDate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input);
  const map = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateKey(date) {
  return date.replaceAll("-", "");
}

function collectText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

function isShoppingRouteTopic(topic) {
  const text = collectText(topic);
  return [
    /제휴\s*링크/,
    /구매\s*링크/,
    /상품\s*링크/,
    /댓글.*(?:링크|정보)/,
    /DM.*링크/,
    /연예인.*(?:제품|착용|사용|추천|템)/,
    /(?:유튜브|인스타|릴스).*나온.*(?:제품|템)/,
    /(?:민경님|소유님|환연|아이돌|배우|셀럽).*템/,
  ].some((pattern) => pattern.test(text));
}

function blogTopics() {
  return [
    {
      slug: "experience-review-savings",
      topicTag: "블로그체험단",
      topic: "블로그를 일기장으로만 쓰는 사람에게",
      hypothesis: "체험단은 거창한 부업보다 먼저 체감되는 블로그 수익화다. 생활비 절약 사례로 접근하면 초보도 바로 이해한다.",
      text:
        "블로그 아직도 일기장처럼만 쓰고 있으면 조금 아까워요.\n\n미용실, 네일샵, 카페, 음식점 전부 체험단으로 갈 수 있습니다. 처음부터 돈 벌려고 하면 막막한데, 한 달에 커트 1번, 네일 1번, 외식 2번만 줄어도 체감이 꽤 커요.\n\n블로그 수익화는 꼭 광고비 입금부터가 아니라 생활비가 덜 나가는 순간부터 시작됩니다. 진짜 처음은 이렇게 가볍게 잡는 게 오래 갑니다.",
      comments: [
        "처음엔 큰 협찬보다 동네 체험단부터 보세요.\n\n미용실\n네일샵\n카페\n음식점\n피부관리\n운동 클래스\n\n이런 건 글 쓰는 난이도도 낮고, 내 일상 사진으로 자연스럽게 풀기 좋습니다.",
        "초보 블로그가 체험단 신청할 때 필요한 건 대단한 방문자보다 글의 성실함이에요.\n\n사진 8장 이상\n방문 전 기대\n이용 과정\n좋았던 점\n아쉬운 점 1개\n재방문할 사람 유형\n\n이렇게만 써도 광고글 느낌이 훨씬 줄어듭니다.",
        "체험단을 돈으로 바꿔 계산해보면 감이 옵니다.\n\n네일 5만원\n커트 4만원\n외식 6만원\n카페 2만원\n\n이걸 한 달에 몇 번만 줄여도 블로그가 생활비 방어를 해주는 셈입니다.",
      ],
      slides: [
        { kicker: "블로그 시작", title: "일기만 쓰기엔 아깝습니다", body: "미용실, 네일샵, 카페, 음식점 체험단만 잘 써도 생활비가 먼저 줄어듭니다.", footer: "@offnote.kr" },
        { kicker: "처음 목표", title: "수익보다 절약부터", body: "광고비 입금보다 쉬운 첫 체감은 내가 쓰던 돈이 덜 나가는 순간입니다.", footer: "블로그 체험단" },
        { kicker: "글 구성", title: "사진, 과정, 좋았던 점, 아쉬운 점", body: "후기글은 솔직한 기준이 있어야 저장되고 믿음이 생깁니다.", footer: "광고글 티 줄이기" },
        { kicker: "계산법", title: "한 달 절약액을 적어보세요", body: "네일, 커트, 외식, 카페 비용을 합치면 블로그의 첫 성과가 숫자로 보입니다.", footer: "생활비 방어" },
      ],
    },
    {
      slug: "experience-review-application",
      topicTag: "체험단신청",
      topic: "체험단 신청 전에 블로그가 준비해야 할 것",
      hypothesis: "체험단 신청은 방문자 수보다 블로그의 기본 신뢰 신호가 먼저다. 초보가 바로 고칠 수 있는 항목으로 알려준다.",
      text:
        "체험단 신청할 때 방문자 수만 보는 줄 아는 분들이 많은데, 초보는 블로그 상태부터 봐야 합니다.\n\n최근 글이 3개월 전이고, 사진은 2장뿐이고, 제목이 전부 감정일기면 업체 입장에선 맡기기 어렵습니다.\n\n어렵게 꾸밀 필요는 없고, 내가 다녀온 곳을 사람 대신 미리 가본 것처럼 써두면 됩니다. 이게 쌓이면 신청할 때 훨씬 덜 민망해요.",
      comments: [
        "신청 전 최소 세팅은 이 정도면 됩니다.\n\n최근 2주 안에 쓴 글 3개\n사진 8장 이상 들어간 후기 2개\n동네명이나 메뉴명이 들어간 제목\n내 돈으로 간 곳의 솔직 후기\n프로필에 관심 분야 한 줄\n\n이 정도만 있어도 훨씬 덜 비어 보입니다.",
        "제목은 감정보다 검색어가 좋아요.\n\n오늘 너무 좋았다 X\n연남동 브런치 카페 혼밥 후기 O\n머리 망한 날 X\n강남 레이어드컷 미용실 상담 후기 O\n\n사람들이 찾는 말로 써야 블로그가 일을 합니다.",
        "초보가 제일 피해야 할 건 전부 좋았다는 글입니다.\n\n좋았던 점 2개\n아쉬웠던 점 1개\n누가 가면 좋을지\n다음에 다시 간다면 뭘 고를지\n\n이렇게 쓰면 협찬이어도 사람이 쓴 글처럼 읽힙니다.",
      ],
      slides: [
        { kicker: "체험단 신청", title: "방문자보다 먼저 보는 게 있습니다", body: "최근 글, 사진 수, 후기 구조가 비어 있으면 초보 블로그처럼 보입니다.", footer: "@offnote.kr" },
        { kicker: "기본 세팅", title: "후기글 3개만 먼저 정리하세요", body: "내 돈으로 간 곳을 체험단 글처럼 써두면 신청할 때 훨씬 자연스럽습니다.", footer: "초보 블로그" },
        { kicker: "제목", title: "감정보다 검색어", body: "좋았다보다 동네명, 메뉴명, 시술명, 상황이 들어간 제목이 오래 갑니다.", footer: "검색 유입" },
        { kicker: "신뢰", title: "아쉬운 점 1개가 글을 살립니다", body: "전부 좋았다는 글보다 기준이 있는 후기가 더 믿음이 갑니다.", footer: "찐 후기" },
      ],
    },
    {
      slug: "review-post-template",
      topicTag: "후기글쓰기",
      topic: "체험단 글이 광고처럼 보이지 않게 쓰는 법",
      hypothesis: "체험단 글도 독자 입장에서 궁금한 순서로 쓰면 광고티가 줄고 검색 유입에도 유리하다.",
      text:
        "체험단 글이 광고처럼 보이는 이유는 대부분 순서 때문입니다.\n\n처음부터 업체 칭찬, 인테리어 칭찬, 메뉴판 사진만 쭉 나오면 읽는 사람은 바로 알아차려요. 사람들은 거기가 예쁜지보다 내가 가도 괜찮을지 알고 싶어합니다.\n\n그래서 첫 문단은 내 상황부터 쓰는 게 좋습니다. 내가 왜 갔는지가 나오면 글이 훨씬 사람 같아져요.",
      comments: [
        "후기글 순서는 이렇게 가면 자연스럽습니다.\n\n왜 찾아봤는지\n예약이나 대기 어땠는지\n가격대가 어떤지\n직접 받은 과정\n좋았던 점\n아쉬웠던 점\n누구에게 맞는지\n\n이 순서면 체험단이어도 정보글처럼 읽힙니다.",
        "예를 들면 이렇게 시작하면 좋아요.\n\n손톱이 너무 잘 깨져서 오래가는 네일샵을 찾고 있었어요.\n회사 근처에서 점심시간에 다녀올 수 있는 곳 위주로 봤고, 예약 가능한 시간이 맞아서 방문했습니다.\n\n이렇게 내 이유가 먼저 나오면 글이 덜 딱딱합니다.",
        "사진도 예쁜 컷만 넣지 말고 정보 컷을 섞으세요.\n\n입구\n가격표\n좌석\n시술 전후\n메뉴 실제 크기\n주차나 화장실\n\n이런 사진이 저장되는 블로그 글을 만듭니다.",
      ],
      slides: [
        { kicker: "후기글", title: "광고처럼 보이는 건 순서 때문입니다", body: "업체 칭찬보다 내가 왜 갔는지부터 쓰면 훨씬 자연스럽습니다.", footer: "@offnote.kr" },
        { kicker: "첫 문단", title: "내 상황을 먼저 꺼내세요", body: "손톱이 깨졌다, 머리가 부스스했다, 조용한 카페가 필요했다처럼 이유가 있어야 읽힙니다.", footer: "사람 냄새" },
        { kicker: "사진", title: "예쁜 컷보다 정보 컷", body: "가격표, 전후, 실제 크기, 주차처럼 독자가 궁금한 장면을 넣으세요.", footer: "저장되는 글" },
        { kicker: "마무리", title: "누구에게 맞는지까지", body: "전부 추천보다 이런 사람에게 맞는다고 정리하면 신뢰가 생깁니다.", footer: "찐 정보" },
      ],
    },
    {
      slug: "blog-savings-ledger",
      topicTag: "생활비절약",
      topic: "블로그 체험단을 생활비 장부처럼 보는 법",
      hypothesis: "체험단을 생활비 절약액으로 기록하면 블로그 초보가 성과를 빨리 느끼고 계속 운영할 동기가 생긴다.",
      text:
        "블로그 체험단은 수익 인증보다 생활비 장부로 보면 더 현실적입니다.\n\n이번 달에 네일 5만원, 외식 7만원, 카페 2만원을 체험단으로 다녀왔다면 현금이 들어온 건 아니어도 14만원을 안 쓴 거예요.\n\n초보일수록 이 숫자를 기록해야 블로그가 계속할 이유가 생깁니다. 생각보다 이 기록이 동기부여가 큽니다. 막연한 부업보다 훨씬 손에 잡혀요.",
      comments: [
        "체험단 장부는 이렇게 적어보세요.\n\n날짜\n업종\n원래 가격\n내가 쓴 비용\n절약액\n글 발행일\n재신청 가능 여부\n\n이렇게 보면 어떤 분야가 나한테 잘 맞는지 보입니다.",
        "분야별로 체감이 다릅니다.\n\n음식점은 글 쓰기 쉽고\n네일샵은 전후 사진이 강하고\n미용실은 금액 체감이 크고\n카페는 초보가 시작하기 편합니다.\n\n처음엔 카페와 음식점부터 가는 게 덜 부담스럽습니다.",
        "단, 억지로 아무거나 신청하면 블로그 결이 흐려집니다.\n\n내 생활에 진짜 필요한 것\n사진 찍기 편한 것\n글로 설명할 수 있는 것\n다시 갈 의향을 말할 수 있는 것\n\n이 기준으로 고르세요.",
      ],
      slides: [
        { kicker: "생활비 장부", title: "체험단도 숫자로 봐야 합니다", body: "현금 입금이 아니어도 원래 쓸 돈이 줄었다면 블로그의 첫 성과입니다.", footer: "@offnote.kr" },
        { kicker: "예시", title: "네일 5만 + 외식 7만 + 카페 2만", body: "이번 달 14만원을 안 쓴 셈입니다. 초보는 이 감각이 중요합니다.", footer: "절약 수익" },
        { kicker: "기록", title: "업종, 원가, 절약액을 남기세요", body: "어떤 체험단이 내 블로그와 잘 맞는지 데이터가 쌓입니다.", footer: "운영 루틴" },
        { kicker: "주의", title: "아무거나 신청하지 마세요", body: "내 생활에 진짜 필요한 것만 골라야 글도 자연스럽고 오래 갑니다.", footer: "블로그 결" },
      ],
    },
    {
      slug: "local-review-blog",
      topicTag: "동네블로그",
      topic: "동네 후기 블로그가 초보에게 좋은 이유",
      hypothesis: "초보 블로그는 전국 단위 경쟁보다 동네 후기부터 시작하는 편이 쓰기 쉽고 체험단 연결도 빠르다.",
      text:
        "블로그 처음 키울 때 전국 맛집, 전국 핫플부터 잡으면 너무 빡세요.\n\n오히려 내가 사는 동네 카페, 미용실, 네일샵, 병원 후기부터 쓰는 게 좋습니다. 사진도 직접 찍기 쉽고, 글도 내 생활에서 나오니까 덜 어색해요.\n\n동네 후기가 쌓이면 체험단 신청할 때도 말이 됩니다. 내 생활권을 기록하는 게 제일 쉬운 시작입니다.",
      comments: [
        "초보에게 좋은 동네 글감은 이런 것들입니다.\n\n역 근처 혼밥\n주차 되는 카페\n퇴근 후 갈 네일샵\n머리 상담 잘해주는 미용실\n아이랑 가기 좋은 식당\n조용한 작업 카페\n\n이건 검색하는 사람이 꽤 구체적입니다.",
        "동네 후기 제목은 이렇게 쓰면 좋아요.\n\n상수역 혼밥 가능한 파스타집 후기\n부천 주차 되는 대형 카페 다녀옴\n강남 레이어드컷 상담 꼼꼼했던 미용실\n\n지역 + 상황 + 업종이 같이 들어가야 찾는 사람이 들어옵니다.",
        "동네 글을 10개 정도 쌓으면 블로그가 훨씬 덜 비어 보입니다.\n\n체험단 신청할 때도 '이 사람은 우리 지역 글을 계속 쓰는구나'라는 신호가 됩니다.",
      ],
      slides: [
        { kicker: "동네 블로그", title: "전국 핫플보다 동네 후기가 쉽습니다", body: "초보는 직접 가기 쉬운 곳부터 써야 사진과 문장이 자연스럽습니다.", footer: "@offnote.kr" },
        { kicker: "글감", title: "카페, 미용실, 네일샵, 음식점", body: "생활 동선 안에 있는 곳이 글감이 되면 블로그가 오래 갑니다.", footer: "초보 루틴" },
        { kicker: "제목", title: "지역 + 상황 + 업종", body: "상수역 혼밥, 부천 주차 카페처럼 찾는 말이 들어가야 유입됩니다.", footer: "검색형 제목" },
        { kicker: "체험단", title: "동네 글 10개가 포트폴리오가 됩니다", body: "지역 후기 기록이 쌓이면 신청할 때도 설득력이 생깁니다.", footer: "신뢰 신호" },
      ],
    },
    {
      slug: "blog-not-diary",
      topicTag: "블로그운영",
      topic: "일기형 블로그에서 정보형 블로그로 바꾸는 법",
      hypothesis: "초보 블로그는 일기 말투를 버리기보다 독자가 가져갈 정보를 한 줄 더 얹는 방식으로 바꾸면 부담이 적다.",
      text:
        "블로그가 전부 일기처럼 보인다고 해서 말투를 싹 바꿀 필요는 없습니다.\n\n다만 마지막에 읽는 사람이 가져갈 정보를 하나씩만 붙이면 돼요. 오늘 좋았다에서 끝내지 말고, 누가 가면 좋은지, 가격은 어땠는지, 다음엔 뭘 고를지까지 적는 겁니다.\n\n그 한 줄 차이가 일기와 정보글을 나눕니다. 어렵게 말고 친구한테 알려주듯 쓰면 됩니다.",
      comments: [
        "일기형 문장을 정보형으로 바꾸면 이렇게 됩니다.\n\n오늘 카페 좋았다\n-> 조용해서 노트북 작업하기 좋았고 콘센트는 창가 쪽에만 있었어요.\n\n머리 마음에 들었다\n-> 숱 많은 분들은 레이어를 조금 더 내도 괜찮을 것 같아요.",
        "글마다 이 3개만 넣어도 달라집니다.\n\n가격이나 메뉴\n누구에게 맞는지\n다음에 다시 간다면 뭘 고를지\n\n이건 어려운 분석이 아니라 친구한테 알려주는 정보에 가깝습니다.",
        "블로그는 전문가처럼 쓰려고 하면 오래 못 갑니다.\n\n내가 먼저 가보고 친구한테 알려준다는 느낌이면 충분합니다. 대신 친구가 진짜 궁금해할 것까지 적어주는 게 포인트예요.",
      ],
      slides: [
        { kicker: "블로그 운영", title: "일기를 버릴 필요는 없습니다", body: "대신 읽는 사람이 가져갈 정보 한 줄을 더 붙이면 됩니다.", footer: "@offnote.kr" },
        { kicker: "차이", title: "좋았다에서 끝내지 마세요", body: "가격, 대상, 다음 선택까지 적으면 일기가 정보글로 바뀝니다.", footer: "정보 한 줄" },
        { kicker: "말투", title: "친구한테 알려주듯이", body: "전문가 말투보다 먼저 가본 사람이 알려주는 느낌이 오래 갑니다.", footer: "쉬운 블로그" },
        { kicker: "루틴", title: "글마다 3개만 넣기", body: "가격, 맞는 사람, 다음 선택. 이 정도면 초보 글도 훨씬 쓸모 있어집니다.", footer: "찐 정보" },
      ],
    },
  ];
}

function makeEditorialTopic({ slug, topicTag, topic, angle, proof, action }) {
  return {
    slug,
    topicTag,
    topic,
    hypothesis: `${angle} ${proof}`,
    text:
      `${topic}\n\n${angle}\n\n${proof}\n\n${action}`,
    comments: [
      `${topicTag} 관점에서 먼저 볼 것은 결과보다 반복 가능한 구조입니다.\n\n어떤 글감이 돈이 되는지보다, 어떤 글감이 계속 쌓이는지부터 보면 블로그 운영이 훨씬 안정적입니다.`,
      `오늘 바로 할 일은 하나만 정해도 됩니다.\n\n글감 3개 적기\n제목 3개 바꿔보기\n수익이나 절약으로 이어질 지점 표시하기\n\n이렇게 작게 시작해야 오래 갑니다.`,
      `오프노트 글은 과장된 수익 인증보다 실제 운영 기록에 가까워야 합니다.\n\n작은 절약\n작은 문의\n작은 신청\n작은 개선\n\n이런 변화가 쌓이는 쪽으로 가겠습니다.`,
    ],
    slides: [
      { kicker: topicTag, title: topic, body: angle, footer: "@offnote.kr" },
      { kicker: "핵심", title: "반복 가능한 구조를 먼저 봅니다", body: proof, footer: "블로그 수익화" },
      { kicker: "실행", title: "오늘 할 일은 작게 잡습니다", body: action, footer: "운영 루틴" },
      { kicker: "주의", title: "수익 보장처럼 말하지 않습니다", body: "오프노트는 과장보다 기록, 인증보다 구조를 우선합니다.", footer: "안전한 톤" },
    ],
  };
}

function editorialTopics() {
  return [
    makeEditorialTopic({
      slug: "blog-profit-map",
      topicTag: "블로그수익화",
      topic: "블로그 수익화는 광고비보다 수익 경로 지도가 먼저입니다",
      angle: "블로그로 돈을 벌겠다고 하면 대부분 애드포스트나 체험단부터 떠올리지만, 먼저 해야 할 일은 내 글이 어디서 돈이나 절약으로 이어지는지 지도를 그리는 것입니다.",
      proof: "후기형 글은 체험단, 정보형 글은 제휴 링크, 지역 글은 문의와 방문, 경험 글은 강의나 상담으로 이어질 수 있습니다.",
      action: "오늘 쓴 글 5개 옆에 체험단, 제휴, 문의, 저장용 정보 중 어디에 가까운지 표시해보세요.",
    }),
    makeEditorialTopic({
      slug: "adpost-before-traffic",
      topicTag: "애드포스트",
      topic: "애드포스트 수익이 적을 때 먼저 볼 것은 방문자 수만이 아닙니다",
      angle: "방문자가 적어서 수익이 낮은 경우도 있지만, 클릭할 이유가 없는 글만 쌓여도 수익은 잘 늘지 않습니다.",
      proof: "검색으로 들어온 사람이 다음 행동을 할 수 있게 가격, 비교, 위치, 준비물, 체크리스트 같은 정보가 있어야 광고도 자연스럽게 보입니다.",
      action: "일기형 글 하나를 골라 가격, 대상, 다음 선택 기준을 한 줄씩 추가해보세요.",
    }),
    makeEditorialTopic({
      slug: "affiliate-without-salesy",
      topicTag: "제휴수익",
      topic: "제휴 링크 글은 팔려고 쓰면 오히려 약해집니다",
      angle: "처음부터 구매를 밀면 글이 광고처럼 보입니다. 먼저 왜 필요했는지, 어떤 기준으로 골랐는지, 누구에게는 안 맞는지를 써야 합니다.",
      proof: "비교 기준이 보이면 링크는 결론이 아니라 참고 자료가 됩니다.",
      action: "추천 글에는 장점 2개와 함께 안 맞는 사람 1가지를 꼭 넣어보세요.",
    }),
    makeEditorialTopic({
      slug: "local-blog-income",
      topicTag: "지역블로그",
      topic: "동네 글은 조회수보다 문의 가능성이 더 중요할 때가 있습니다",
      angle: "전국 키워드보다 내 생활권 키워드가 작아 보여도, 실제 가게와 사람을 연결하기에는 훨씬 구체적입니다.",
      proof: "지역명, 상황, 업종이 같이 들어간 글은 체험단 신청이나 협업 제안에서 블로그 색깔을 보여주기 좋습니다.",
      action: "이번 주 생활권 안에서 카페, 병원, 미용실, 운동, 수리 같은 글감 5개를 적어보세요.",
    }),
    makeEditorialTopic({
      slug: "review-template-income",
      topicTag: "후기템플릿",
      topic: "후기 글은 템플릿이 있어야 수익화까지 이어집니다",
      angle: "매번 기분대로 쓰면 글은 자연스럽지만 쌓이지 않습니다. 같은 순서로 써야 나중에 체험단, 제휴, 지역 문의로 연결하기 쉽습니다.",
      proof: "방문 이유, 선택 기준, 가격, 과정, 좋았던 점, 아쉬운 점, 맞는 사람 순서가 기본 뼈대가 됩니다.",
      action: "최근 후기 하나를 이 순서로 다시 제목만 바꿔보세요.",
    }),
    makeEditorialTopic({
      slug: "content-ledger",
      topicTag: "운영장부",
      topic: "블로그 운영은 수익 인증보다 글 장부가 먼저입니다",
      angle: "초보일수록 얼마 벌었는지보다 어떤 글이 어떤 기회를 만들었는지를 기록해야 합니다.",
      proof: "글 제목, 키워드, 유입, 신청한 체험단, 받은 문의, 절약액을 같이 적으면 다음 글감이 보입니다.",
      action: "엑셀이나 메모장에 글 10개만 운영 장부로 정리해보세요.",
    }),
    makeEditorialTopic({
      slug: "search-title-rewrite",
      topicTag: "검색제목",
      topic: "블로그 제목은 감정보다 검색 상황을 먼저 담아야 합니다",
      angle: "좋았다, 만족했다 같은 제목은 내 감정은 보이지만 검색하는 사람의 상황은 잘 보이지 않습니다.",
      proof: "지역, 대상, 문제, 결과 중 두 가지 이상이 제목에 들어가면 글이 정보처럼 읽힙니다.",
      action: "기존 제목 3개를 지역+상황+업종 구조로 바꿔보세요.",
    }),
    makeEditorialTopic({
      slug: "experience-campaign-filter",
      topicTag: "체험단선별",
      topic: "체험단은 많이 신청하기보다 내 블로그 결에 맞게 골라야 합니다",
      angle: "아무거나 받으면 당장은 글감이 생기지만 블로그 방향은 흐려집니다.",
      proof: "내 생활권, 내가 실제로 쓸 서비스, 사진 찍기 쉬운 장소, 다시 갈 의향을 말할 수 있는 곳이 우선입니다.",
      action: "신청 전에 내 블로그에 이미 있는 글 3개와 이어지는지 확인하세요.",
    }),
    makeEditorialTopic({
      slug: "small-product-review",
      topicTag: "상품후기",
      topic: "작은 상품 후기도 블로그 수익화 연습이 됩니다",
      angle: "고가 제품만 제휴 글감이 되는 것은 아닙니다. 자주 쓰는 작은 물건이 오히려 기준을 설명하기 쉽습니다.",
      proof: "왜 샀는지, 전과 후가 어떻게 달라졌는지, 재구매할지까지 쓰면 단순 후기보다 정보성이 생깁니다.",
      action: "집에서 매주 쓰는 물건 하나를 골라 재구매 기준을 써보세요.",
    }),
    makeEditorialTopic({
      slug: "blog-service-offer",
      topicTag: "서비스문의",
      topic: "블로그가 문의로 이어지려면 내가 도와줄 수 있는 일이 보여야 합니다",
      angle: "글만 많아도 독자는 이 사람이 무엇을 도와줄 수 있는지 모를 수 있습니다.",
      proof: "체험단 기록, 글쓰기 템플릿, 지역 후기 노하우, 제휴 글 구조처럼 내가 반복해서 해결한 문제가 보여야 문의가 생깁니다.",
      action: "프로필과 고정 글에 내가 도와줄 수 있는 일 한 줄을 추가해보세요.",
    }),
    makeEditorialTopic({
      slug: "blog-routine-30min",
      topicTag: "운영루틴",
      topic: "블로그 수익화는 하루 30분 루틴부터 현실적입니다",
      angle: "큰 계획보다 매일 반복 가능한 작은 시간이 더 오래 갑니다.",
      proof: "10분은 글감 수집, 10분은 제목 수정, 10분은 문단 보강으로 나누면 글 하나를 매일 조금씩 앞으로 보낼 수 있습니다.",
      action: "오늘은 새 글을 쓰기보다 기존 글 제목 3개만 고쳐보세요.",
    }),
    makeEditorialTopic({
      slug: "blog-trust-before-money",
      topicTag: "신뢰수익",
      topic: "블로그 수익은 먼저 신뢰가 쌓인 뒤에 따라옵니다",
      angle: "수익 글만 쌓이면 독자는 금방 알아차립니다. 실제 경험, 기준, 아쉬운 점이 같이 있어야 오래 갑니다.",
      proof: "좋은 점만 쓰는 글보다 맞는 사람과 안 맞는 사람을 나눠주는 글이 저장되고 다시 읽힙니다.",
      action: "다음 글에는 꼭 아쉬운 점 하나와 추천하지 않는 경우 하나를 넣어보세요.",
    }),
    makeEditorialTopic({
      slug: "adpost-click-intent",
      topicTag: "애드포스트",
      topic: "애드포스트는 방문자보다 검색 의도와 체류 시간이 먼저입니다",
      angle: "방문자가 조금 늘어도 바로 수익이 커지지는 않습니다. 글을 읽는 사람이 왜 들어왔고 다음에 무엇을 확인하는지가 더 중요합니다.",
      proof: "가격, 비교, 준비물, 기준, 체크리스트처럼 읽을 이유가 분명한 글은 체류와 다음 행동을 만들기 쉽습니다.",
      action: "기존 글 하나에 검색자가 궁금해할 비교 기준 3개를 추가해보세요.",
    }),
    makeEditorialTopic({
      slug: "coupang-partners-blog-start",
      topicTag: "쿠팡파트너스",
      topic: "쿠팡파트너스는 링크보다 먼저 후기 기준을 정해야 합니다",
      angle: "처음부터 링크를 앞세우면 글이 광고처럼 보입니다. 왜 골랐는지, 누구에게 맞는지, 아쉬운 점은 무엇인지가 먼저입니다.",
      proof: "독자는 상품명보다 선택 기준을 저장합니다. 기준이 선명하면 링크는 결론이 아니라 참고 자료가 됩니다.",
      action: "집에서 실제로 쓰는 물건 하나를 골라 재구매 기준과 추천하지 않는 경우를 적어보세요.",
    }),
    makeEditorialTopic({
      slug: "coupang-disclosure-routine",
      topicTag: "제휴고지",
      topic: "쿠팡파트너스 글은 수익 고지와 독자 신뢰를 같이 챙겨야 합니다",
      angle: "제휴 활동은 숨기면 더 위험합니다. 고지는 형식이 아니라 독자와의 약속에 가깝습니다.",
      proof: "글 앞뒤에 제휴 가능성을 분명히 밝히고, 장단점과 비교 기준을 함께 쓰면 광고 느낌을 줄일 수 있습니다.",
      action: "제휴 글 템플릿에 고지 문구, 장점, 단점, 맞는 사람, 안 맞는 사람 항목을 고정해두세요.",
    }),
    makeEditorialTopic({
      slug: "naver-shopping-connect-start",
      topicTag: "쇼핑커넥트",
      topic: "네이버 쇼핑커넥트는 상품 나열보다 비교 기준 글과 잘 맞습니다",
      angle: "쇼핑커넥트를 블로그에 붙일 때는 링크를 많이 넣는 것보다 선택 기준을 설명하는 글이 더 자연스럽습니다.",
      proof: "네이버 검색 사용자는 가격, 배송, 리뷰 수, 옵션, 교체 주기 같은 비교 정보를 기대합니다.",
      action: "생활용품 하나를 정해 가격보다 먼저 비교할 기준 5개를 써보세요.",
    }),
    makeEditorialTopic({
      slug: "afterwork-side-hustle-map",
      topicTag: "퇴근후부업",
      topic: "퇴근 후 부업은 돈 되는 일보다 내가 계속 기록할 수 있는 일부터 골라야 합니다",
      angle: "시간이 적은 직장인은 유행하는 부업보다 반복 가능한 루틴이 먼저입니다.",
      proof: "블로그, 제휴, 전자책, 템플릿, 지역 후기, 중고 거래 기록처럼 글로 남길 수 있는 부업이 블로그와 잘 이어집니다.",
      action: "평일 30분으로 가능한 부업 후보 5개를 적고, 글감이 20개 나오는지 먼저 확인해보세요.",
    }),
    makeEditorialTopic({
      slug: "side-hustle-time-budget",
      topicTag: "부업루틴",
      topic: "직장인 부업은 시간 예산을 먼저 정해야 오래 갑니다",
      angle: "퇴근 후 남는 시간은 생각보다 작습니다. 그래서 부업 계획은 수익 목표보다 시간 예산부터 잡아야 합니다.",
      proof: "하루 30분이면 조사 10분, 기록 10분, 글 보강 10분처럼 쪼개야 지치지 않습니다.",
      action: "이번 주에는 새 부업을 시작하기보다 매일 30분을 어디에 썼는지 기록해보세요.",
    }),
    makeEditorialTopic({
      slug: "blog-digital-product-side",
      topicTag: "디지털상품",
      topic: "블로그 부업은 작은 템플릿과 체크리스트로 확장할 수 있습니다",
      angle: "처음부터 강의나 전자책을 만들 필요는 없습니다. 반복해서 쓰는 표, 체크리스트, 신청 문구도 작은 상품의 씨앗입니다.",
      proof: "블로그 글이 쌓이면 독자가 자주 묻는 질문과 반복되는 양식이 보입니다.",
      action: "최근 글 10개에서 반복되는 체크리스트 하나를 뽑아 무료 자료 형태로 정리해보세요.",
    }),
    makeEditorialTopic({
      slug: "blog-cashflow-mix",
      topicTag: "수익믹스",
      topic: "블로그 수익화는 애드포스트 하나에 기대면 흔들리기 쉽습니다",
      angle: "광고 수익은 시작점이 될 수 있지만, 블로그가 커질수록 수익 경로를 여러 개로 나눠야 안정적입니다.",
      proof: "애드포스트, 제휴, 체험단, 문의, 템플릿, 지역 협업처럼 서로 다른 경로가 있어야 한쪽이 약해져도 버틸 수 있습니다.",
      action: "내 블로그 글을 광고형, 제휴형, 문의형, 자료형으로 나눠보고 비어 있는 칸을 찾으세요.",
    }),
  ];
}

function draftFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) return draftFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

function recentScheduledSlugs(date, windowDays = 21) {
  const target = new Date(`${date}T00:00:00+09:00`);
  const rootDir = path.join("outputs", "afterwork-profit", "automation");
  const recent = new Set();
  for (const file of draftFiles(rootDir)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      const draftDate = String(data.draft_date || data.date || path.basename(path.dirname(file)) || "").slice(0, 10);
      const current = new Date(`${draftDate}T00:00:00+09:00`);
      const days = Math.round((target - current) / 86400000);
      if (days > 0 && days <= windowDays) {
        const id = String(data.id || path.basename(file, ".json"));
        const slug = id.replace(/^OFFNOTE-\d{8}-(?:evening|night)-/, "");
        if (slug) recent.add(slug);
      }
    } catch {
      // Ignore malformed drafts; the dashboard will surface them separately.
    }
  }
  return recent;
}

function pickTopic(date, slot) {
  const seed = [...`${date}-${slot}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const topics = [...blogTopics(), ...editorialTopics()].filter((topic) => !isShoppingRouteTopic(topic));
  if (topics.length === 0) {
    throw new Error("No offnote-safe topics available. Direct affiliate or celebrity-shopping topics must go to lifemagazine_.");
  }
  const used = recentScheduledSlugs(date);
  for (let offset = 0; offset < topics.length; offset += 1) {
    const topic = topics[(seed + offset) % topics.length];
    if (!used.has(topic.slug)) return topic;
  }
  return topics[seed % topics.length];
}

function topicVariant(topic, date, slot) {
  const focuses = [
    "처음 수익 경로 잡기",
    "검색 제목으로 바꾸기",
    "저장되는 정보 만들기",
    "문의로 이어지는 문장",
    "체험단 선별 기준",
    "제휴 글 신뢰도 높이기",
    "운영 장부 만들기",
    "지역 키워드 확장",
    "프로필과 고정글 정리",
    "30분 운영 루틴",
    "후기 글 구조 점검",
    "수익보다 신뢰 먼저 쌓기",
  ];
  const scenes = [
    "오늘 실행",
    "초보 기준",
    "글감 정리",
    "제목 점검",
    "저장용 정보",
    "문의 연결",
    "수익 지도",
    "신뢰 확보",
    "운영 장부",
    "다음 글감",
    "프로필 정리",
    "반복 루틴",
  ];
  const seedText = `${date}-${slot}-${topic.slug}`;
  const seed = [...seedText].reduce((sum, ch, index) => sum + ((index + 1) * ch.charCodeAt(0)), 0);
  const focus = focuses[seed % focuses.length];
  const scene = scenes[(Math.floor(seed / focuses.length) + Number(date.slice(8, 10))) % scenes.length];
  const dateLabel = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ${slot === "night" ? "밤" : "저녁"}`;
  return {
    ...topic,
    topic: `${topic.topic} - ${focus} (${scene} ${dateLabel})`,
    text: `${topic.topic} - ${focus} (${scene} ${dateLabel})\n\n${topic.text}`,
    comments: [
      `오늘 관점은 "${focus}"입니다. 같은 블로그 수익화라도 매번 보는 지점을 바꿔야 글이 반복되지 않습니다.`,
      ...(topic.comments || []),
    ].slice(0, 4),
  };
}

function makeDraft(date, slot) {
  const picked = topicVariant(pickTopic(date, slot), date, slot);
  const id = `OFFNOTE-${dateKey(date)}-${slot}-${picked.slug}`;
  return {
    id,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    date,
    slot,
    topic: picked.topic,
    topic_tag: picked.topicTag,
    status: "approved",
    created_at: new Date().toISOString(),
    source: "github-actions-offnote-generator",
    recommended_publish_time: slot === "night" ? "21:00 KST" : "18:00 KST",
    experiment_hypothesis: picked.hypothesis,
    threads_text: picked.text,
    thread_comments: picked.comments,
    cardnews_slides: picked.slides,
    safety_rules: [
      "No income guarantee.",
      "No account-mixing: publish only when Threads profile username is offnote.kr.",
      "Cardnews optional; use it only for high-density posts.",
      "Auto-publish unless held.",
      "For now, keep Offnote focused on approachable blog, review, experience-campaign, and living-cost content.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const draft = makeDraft(date, slot);
const outDir = path.join("outputs", "afterwork-profit", "automation", date);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${draft.id}.json`);
const portableOutPath = outPath.replaceAll("\\", "/");
const createdFlagPath = path.join("outputs", "afterwork-profit", "preview-created.txt");

if (fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8").replace(/^\uFEFF/, ""));
  const protectedStatuses = new Set(["approved", "pending_approval", "published", "held", "publish_failed", "ready_to_review"]);
  if (protectedStatuses.has(existing.status)) {
    fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
    fs.writeFileSync(createdFlagPath, "false\n", "utf8");
    console.log(JSON.stringify({ ok: true, created: false, draft: outPath, id: existing.id, status: existing.status }, null, 2));
    process.exit(0);
  }
}

fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
fs.writeFileSync(createdFlagPath, "true\n", "utf8");
console.log(JSON.stringify({ ok: true, created: true, draft: outPath, id: draft.id }, null, 2));
