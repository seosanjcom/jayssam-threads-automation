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
      slug: "cooling-bedding-keywords",
      topicTag: "블로그수익화",
      topic: "여름 냉감침구 검색어 선점",
      hypothesis: "여름 상품은 추천보다 실패 회피 검색어가 강하다. 단점, 세탁, 실제 체감 키워드로 들어가면 저장과 클릭을 동시에 노릴 수 있다.",
      text:
        "이번 주엔 이 키워드 미리 선점하세요.\n\n`냉감패드 세탁`\n`냉감이불 단점`\n`여름 침구 추천`\n\n더워지면 냉감침구 검색이 바로 붙습니다. 그냥 추천글로 쓰면 너무 흔해요. 먼저 잡을 건 \"사기 전 불안\"입니다. 세탁하면 기능이 줄어드는지, 몸에 달라붙는지, 에어컨 없이도 체감되는지. 이 3개를 비교하면 쇼츠도 블로그도 훨씬 오래 갑니다.",
      comments: [
        "1. 검색어는 이렇게 묶으면 됩니다.\n\n메인: 냉감패드 세탁\n서브: 냉감이불 단점 / 여름 침구 추천\n구매형: 냉감패드 추천 / 쿨매트 추천\n비교형: 냉감패드 쿨매트 차이\n\n이 조합이면 블로그 2개, 쇼츠 3개까지 바로 나옵니다.",
        "2. 쇼츠 제목은 이렇게 가세요.\n\n냉감패드 사기 전에 꼭 보는 3가지\n냉감이불 세탁하면 진짜 덜 시원할까\n쿨매트랑 냉감패드 뭐가 다른지 30초 정리\n\n제품명보다 사람들이 사기 전에 걱정하는 말을 앞에 두는 게 좋습니다.",
        "3. 블로그는 이 5개 표만 넣어도 됩니다.\n\n세탁 가능 여부\n몸에 달라붙는지\n에어컨 없이 체감되는지\n먼지 붙는 정도\n가격대\n\n이렇게 비교하면 단순 상품 나열보다 저장할 이유가 생깁니다.",
      ],
      slides: [
        {
          kicker: "이번 주 선점어",
          title: "냉감침구는 추천보다 세탁과 단점으로 잡으세요",
          body: "사람들은 바로 사는 게 아니라 사기 전에 불안을 검색합니다. 냉감패드 세탁, 냉감이불 단점, 쿨매트 차이를 먼저 보세요.",
          footer: "@offnote.kr",
        },
        {
          kicker: "검색어 묶음",
          title: "메인은 냉감패드 세탁",
          body: "서브는 냉감이불 단점, 여름 침구 추천. 구매형은 냉감패드 추천, 쿨매트 추천. 비교형은 냉감패드 쿨매트 차이.",
          footer: "블로그 2개 + 쇼츠 3개",
        },
        {
          kicker: "쇼츠 제목",
          title: "제품명보다 걱정하는 말을 앞에 둡니다",
          body: "냉감패드 사기 전에 꼭 보는 3가지 / 세탁하면 덜 시원할까 / 쿨매트랑 뭐가 다른지 30초 정리",
          footer: "누르기 쉬운 제목",
        },
        {
          kicker: "블로그 표",
          title: "세탁, 달라붙음, 체감, 먼지, 가격",
          body: "이 5개 기준으로 비교하면 단순 추천글보다 오래 갑니다. 여름 침구는 실패하지 않으려는 검색이 강합니다.",
          footer: "저장되는 비교 기준",
        },
      ],
    },
    {
      slug: "ai-document-automation-keywords",
      topicTag: "AI부업",
      topic: "AI 문서 자동화 검색어 선점",
      hypothesis: "AI 부업은 넓게 말하면 약하다. 직장인이 매주 반복하는 문서 작업 하나를 줄이는 키워드가 전자책, 템플릿, 강의까지 연결된다.",
      text:
        "이번 주엔 이 키워드 미리 선점하세요.\n\n`회의록 자동 정리`\n`PDF 요약 자동화`\n`엑셀 보고서 자동화`\n\nAI 부업을 말할 때 \"챗GPT로 돈 벌기\"로 쓰면 너무 흔합니다. 지금은 직장인이 퇴근 전에 진짜 귀찮아하는 문서 하나를 줄여주는 쪽이 낫습니다. 회의록, PDF, 엑셀 보고서는 검색 의도가 선명해서 블로그와 쇼츠 둘 다 만들기 좋습니다.",
      comments: [
        "1. 검색어는 이렇게 묶으세요.\n\n메인: 회의록 자동 정리\n서브: 녹취록 요약 / PDF 요약 자동화\n구매형: AI 회의록 앱 / 업무 자동화 템플릿\n비교형: 클로바노트 챗GPT 정리 / 노션 AI 회의록\n\n이건 블로그, 템플릿, 전자책까지 이어지기 쉽습니다.",
        "2. 쇼츠 제목은 이렇게 갑니다.\n\n회의록 정리 30분 줄이는 방법\nPDF 20장 3분 만에 요약하는 순서\n엑셀 보고서 매주 반복하면 이렇게 자동화하세요\n\nAI 자체보다 시간이 줄어드는 장면을 보여주는 게 더 강합니다.",
        "3. 본문에는 순서를 넣어야 합니다.\n\n녹취 파일 받기\n텍스트로 변환\n핵심 결정사항만 뽑기\n담당자와 기한으로 나누기\n노션이나 구글문서에 붙이기\n\n이 정도까지 보여줘야 저장됩니다.",
      ],
      slides: [
        {
          kicker: "이번 주 선점어",
          title: "AI 부업은 회의록 자동 정리부터 잡으세요",
          body: "넓은 AI 주제보다 반복 업무 하나를 줄이는 검색어가 더 잘 먹힙니다. 회의록, PDF, 엑셀 보고서 쪽을 보세요.",
          footer: "@offnote.kr",
        },
        {
          kicker: "검색어 묶음",
          title: "메인은 회의록 자동 정리",
          body: "녹취록 요약, PDF 요약 자동화, AI 회의록 앱, 업무 자동화 템플릿까지 이어집니다.",
          footer: "블로그 + 템플릿",
        },
        {
          kicker: "쇼츠 제목",
          title: "AI보다 줄어드는 시간을 앞에 둡니다",
          body: "회의록 정리 30분 줄이는 방법 / PDF 20장 3분 요약 / 엑셀 보고서 자동화처럼 구체적으로 가세요.",
          footer: "효과가 먼저",
        },
        {
          kicker: "본문 순서",
          title: "녹취, 변환, 요약, 담당자, 문서화",
          body: "순서를 보여줘야 저장됩니다. 도구 이름만 나열하면 검색하면 나오는 글이 됩니다.",
          footer: "실행 순서까지",
        },
      ],
    },
    {
      slug: "rainy-shoe-odor-keywords",
      topicTag: "쇼츠부업",
      topic: "장마철 신발 냄새 검색어 선점",
      hypothesis: "장마 시작 전 불편 검색어를 먼저 잡으면 쇼츠와 블로그에서 빠른 반응을 만들 수 있다. 냄새 제거, 말리는 법, 건조기 단점을 같이 묶는다.",
      text:
        "이번 주엔 이 키워드 미리 선점하세요.\n\n`장마철 신발 냄새`\n`운동화 냄새 제거`\n`신발 건조기 단점`\n\n비 오기 시작하면 사람들이 생각보다 빨리 찾는 쪽입니다. 포인트는 탈취제 추천이 아니라 \"왜 냄새가 다시 나는지\"예요. 말리는 시간, 깔창 분리, 신발 건조기 사용 조건까지 같이 잡으면 쇼츠도 블로그도 바로 만들 수 있습니다.",
      comments: [
        "1. 검색어는 이렇게 묶으세요.\n\n메인: 장마철 신발 냄새\n서브: 운동화 냄새 제거 / 신발 말리는 법\n구매형: 신발 건조기 / 신발 탈취제 / 신발 제습제\n비교형: 신발 건조기 단점 / 신발 탈취제 효과\n\n이 조합이면 블로그 2개, 쇼츠 3개까지 나옵니다.",
        "2. 쇼츠 제목은 이렇게 쓰면 됩니다.\n\n장마철 운동화 냄새가 계속 나는 이유\n신발 건조기 사기 전에 보는 3가지\n탈취제 뿌렸는데 냄새 다시 나는 이유\n\n제품명보다 사람들이 지금 겪는 상황을 먼저 꺼내야 합니다.",
        "3. 블로그에는 이 표를 넣으세요.\n\n건조 시간\n소음\n냄새 제거 정도\n신발 손상 가능성\n보관 크기\n\n이 5개만 비교해도 단순 추천글보다 훨씬 실전형으로 보입니다.",
      ],
      slides: [
        {
          kicker: "이번 주 선점어",
          title: "장마철 신발 냄새를 미리 잡아두세요",
          body: "비가 오기 시작하면 운동화 냄새 제거, 신발 말리는 법, 신발 건조기 단점 검색이 같이 붙습니다.",
          footer: "@offnote.kr",
        },
        {
          kicker: "검색어 묶음",
          title: "메인은 장마철 신발 냄새",
          body: "서브는 운동화 냄새 제거, 신발 말리는 법. 구매형은 신발 건조기, 탈취제, 제습제. 비교형은 건조기 단점.",
          footer: "블로그 2개 + 쇼츠 3개",
        },
        {
          kicker: "쇼츠 제목",
          title: "지금 겪는 상황을 제목에 넣으세요",
          body: "장마철 운동화 냄새가 계속 나는 이유 / 신발 건조기 사기 전에 보는 3가지 / 탈취제 뿌려도 다시 나는 이유",
          footer: "문제 상황 먼저",
        },
        {
          kicker: "블로그 표",
          title: "건조 시간, 소음, 냄새, 손상, 크기",
          body: "이 5개 기준으로 비교하면 단순 추천글보다 훨씬 실전형으로 보입니다. 장마 키워드는 미리 잡는 쪽이 유리합니다.",
          footer: "저장되는 비교 기준",
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
  const protectedStatuses = new Set(["pending_approval", "published", "held", "publish_failed"]);
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
