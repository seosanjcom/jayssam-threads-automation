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

function pickTopic(date, slot) {
  const seed = [...`${date}-${slot}`].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const topics = [
    {
      slug: "search-intent-first",
      topic: "블로그/유튜브 부업에서 먼저 잡아야 할 검색 의도",
      hypothesis: "플랫폼 선택보다 '검색자가 이미 돈을 쓰려는 순간'을 잡으면 저장과 댓글이 같이 오른다.",
      text:
        "퇴근 후 콘텐츠 부업을 시작할 때 제일 먼저 정할 건 블로그냐 유튜브냐가 아닙니다. 먼저 봐야 할 건 '이 사람이 검색한 뒤 무엇을 사거나 신청할 수 있는가'예요. 예를 들어 '유튜브 시작하는 법'은 넓지만, '쇼츠 제품리뷰 영상 구성'은 바로 촬영, 비교, 구매 링크까지 이어집니다. 저는 이런 식으로 조회수용 글과 수익으로 이어지는 글을 구분해서 볼 겁니다.",
      comments: [
        "1. 돈이 붙는 검색 의도는 보통 3가지입니다. 비교하기 전, 구매 직전, 실패해서 다시 찾는 순간. 이 셋 중 하나가 없으면 저장은 돼도 수익까지 가기 어렵습니다.",
        "2. 넓은 주제가 나쁜 이유는 검색량이 커서가 아닙니다. 읽는 사람이 '이건 내 상황이다'라고 느끼는 장면이 흐려지기 때문입니다. 장면이 흐리면 댓글도 질문도 약해집니다.",
        "3. 첫 글감은 '내가 잘 아는 분야 + 사람들이 이미 돈을 쓰는 문제 + 30분 안에 실행할 수 있는 기준'이 겹치는 곳에서 잡는 게 좋습니다.",
      ],
      slides: [
        {
          kicker: "OFFNOTE",
          title: "콘텐츠 부업은 플랫폼보다 돈이 붙는 순간을 먼저 봅니다",
          body: "블로그, 유튜브, 쇼츠는 도구입니다. 먼저 잡을 것은 검색자가 이미 비교하거나 구매하려는 장면입니다.",
          footer: "플랫폼 선택 전 체크",
        },
        {
          kicker: "기준 1",
          title: "넓은 키워드가 어려운 진짜 이유",
          body: "검색량이 커서가 아니라 읽는 사람의 상황이 흐립니다. '유튜브 부업'보다 '쇼츠 제품리뷰 영상 구성'이 행동이 선명합니다.",
          footer: "장면이 선명해야 댓글이 붙습니다",
        },
        {
          kicker: "기준 2",
          title: "수익형 글감은 구매 직전 질문을 잡습니다",
          body: "비교, 가격, 실패, 세팅, 후기처럼 돈 쓰기 전에 확인하는 질문이 좋습니다. 그냥 궁금한 질문은 조회수만 남을 수 있습니다.",
          footer: "조회수와 수익 의도를 분리",
        },
        {
          kicker: "기준 3",
          title: "첫 주제는 30분 안에 실행 기준이 보여야 합니다",
          body: "읽고 바로 제목을 바꾸거나, 촬영 순서를 고치거나, 글 구조를 바꿀 수 있어야 저장할 이유가 생깁니다.",
          footer: "저장되는 정보의 조건",
        },
      ],
    },
    {
      slug: "shorts-review-system",
      topic: "유튜브 쇼츠 제품 리뷰를 부업으로 볼 때의 구조",
      hypothesis: "쇼츠 부업 관심층은 막연한 수익보다 촬영-검증-전환 기준을 더 오래 저장한다.",
      text:
        "쇼츠로 부업을 한다고 하면 대부분 조회수부터 봅니다. 그런데 제품 리뷰형 쇼츠는 조회수보다 '사람이 멈춘 이유'와 '다음 행동'을 봐야 합니다. 첫 2초는 문제 장면, 중간은 비교 기준, 마지막은 누가 사면 좋은지로 끝나야 전환이 생깁니다. 그냥 예쁘게 찍은 영상은 콘텐츠고, 비교 기준이 있는 영상은 수익형 자산에 가깝습니다.",
      comments: [
        "1. 제품 리뷰 쇼츠는 장점 나열보다 '누구에게 맞고 누구에게 안 맞는지'가 있어야 합니다. 이 문장이 있어야 댓글 질문이 구체적으로 바뀝니다.",
        "2. 첫 2초는 제품명이 아니라 문제 장면이 먼저입니다. 예: '퇴근 후 촬영할 때 조명이 누렇게 뜨면'처럼 보는 사람이 자기 상황을 바로 떠올려야 합니다.",
        "3. 저장되는 리뷰는 스펙 정리가 아니라 선택 기준입니다. 가격, 대체품, 실패 포인트, 사용 조건 중 최소 2개는 들어가야 합니다.",
      ],
      slides: [
        {
          kicker: "SHORTS",
          title: "쇼츠 리뷰는 조회수가 아니라 다음 행동으로 봐야 합니다",
          body: "잘 찍은 영상과 팔리는 영상은 다릅니다. 팔리는 영상에는 선택 기준과 제외 기준이 같이 들어갑니다.",
          footer: "제품 리뷰형 쇼츠 구조",
        },
        {
          kicker: "구조 1",
          title: "첫 2초는 제품명이 아니라 문제 장면",
          body: "제품 이름부터 말하면 광고처럼 보입니다. 보는 사람이 겪는 불편을 먼저 보여주면 멈출 이유가 생깁니다.",
          footer: "멈춤의 이유",
        },
        {
          kicker: "구조 2",
          title: "중간에는 비교 기준이 있어야 합니다",
          body: "좋다/별로다보다 A는 이런 사람, B는 이런 사람에게 맞다는 기준이 댓글 질문을 만듭니다.",
          footer: "저장되는 리뷰의 조건",
        },
        {
          kicker: "구조 3",
          title: "마지막은 사야 할 사람과 안 살 사람",
          body: "전환은 추천에서 생기는 게 아니라 판단을 대신해줄 때 생깁니다. 제외 기준까지 말해야 신뢰가 남습니다.",
          footer: "수익형 콘텐츠의 끝맺음",
        },
      ],
    },
    {
      slug: "blog-profit-filter",
      topic: "블로그 부업 글감에서 수익 가능성을 거르는 기준",
      hypothesis: "초보자는 글쓰기보다 글감 필터가 더 큰 병목이라, 기준형 카드뉴스가 저장을 만든다.",
      text:
        "블로그로 부업을 하려면 '글을 많이 쓰자'보다 먼저 해야 할 게 있습니다. 글감이 돈으로 이어질 수 있는지 거르는 겁니다. 저는 세 가지를 봅니다. 검색한 사람이 결정을 앞두고 있는가, 내가 실제 기준을 줄 수 있는가, 글 끝에 다음 행동이 자연스러운가. 이 셋이 없으면 열심히 써도 방문자만 지나가고 수익은 안 남습니다.",
      comments: [
        "1. 검색한 사람이 결정을 앞두고 있다는 건 이런 뜻입니다. 가격 비교, 후기 확인, 방법 선택, 도구 추천처럼 글을 읽은 뒤 뭔가를 고를 가능성이 있는 상태입니다.",
        "2. 내가 실제 기준을 줄 수 있어야 합니다. '좋아요'가 아니라 왜 좋은지, 누구에게 맞는지, 어떤 경우엔 피해야 하는지를 말할 수 있어야 합니다.",
        "3. 다음 행동은 억지 판매가 아닙니다. 체크리스트 저장, 비교표 보기, 제품 확인, 상담 신청처럼 글 내용과 자연스럽게 이어지는 행동입니다.",
      ],
      slides: [
        {
          kicker: "BLOG",
          title: "블로그 부업은 글쓰기 전에 글감을 걸러야 합니다",
          body: "방문자만 모으는 글과 수익으로 이어지는 글은 시작 질문부터 다릅니다.",
          footer: "글감 필터 3가지",
        },
        {
          kicker: "필터 1",
          title: "검색자가 결정을 앞두고 있는가",
          body: "가격, 후기, 비교, 추천, 실패 해결 같은 질문은 다음 행동이 생길 가능성이 높습니다.",
          footer: "검색 의도 확인",
        },
        {
          kicker: "필터 2",
          title: "내가 판단 기준을 줄 수 있는가",
          body: "정보 모음만으로는 약합니다. 맞는 사람, 안 맞는 사람, 선택 순서를 말할 수 있어야 전문가처럼 보입니다.",
          footer: "전문성의 형태",
        },
        {
          kicker: "필터 3",
          title: "글 끝에 자연스러운 다음 행동이 있는가",
          body: "저장, 비교, 신청, 구매 확인처럼 글의 결론과 이어지는 행동이 있어야 수익 구조가 생깁니다.",
          footer: "전환 설계",
        },
      ],
    },
  ];
  return topics[seed % topics.length];
}

function makeDraft(date, slot) {
  const picked = pickTopic(date, slot);
  const id = `OFFNOTE-${dateKey(date)}-${slot}-${picked.slug}`;
  return {
    id,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    topic: picked.topic,
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
      "Cardnews required before publish.",
      "Use approval-based Telegram publishing.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const draft = makeDraft(date, slot);
const outDir = path.join("outputs", "afterwork-profit", "automation", date);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${draft.id}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${outPath}\n`, "utf8");
console.log(JSON.stringify({ ok: true, draft: outPath, id: draft.id }, null, 2));
