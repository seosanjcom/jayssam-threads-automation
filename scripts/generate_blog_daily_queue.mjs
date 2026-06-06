import fs from "node:fs";
import path from "node:path";
import {
  DISCLOSURES,
  MIN_DAILY_BLOG_POSTS,
  normalizeDateKst,
  requiresCpa,
  scoreAeo,
  validateDailyQueue
} from "./blog_marketing_policy.mjs";

const accountsPath = path.join("config", "blog-accounts.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateKey(date) {
  return date.replaceAll("-", "");
}

function accountByKey(key) {
  const config = readJson(accountsPath);
  const account = (config.accounts || []).find((item) => item.accountKey === key);
  if (!account) throw new Error(`Unknown blog account: ${key}`);
  return account;
}

const titleMap = {
  search_answer: "이번 주 선점할 생활형 검색 키워드 5개와 글감 구조",
  shopping_cpa_coupang: "쿠팡 파트너스 글은 상품보다 구매 상황을 먼저 잡아야 합니다",
  shopping_cpa_naver_shopping_connect: "네이버 쇼핑 커넥트 글은 링크보다 비교 기준이 먼저입니다",
  comparison_guide: "블로그 글 하나로 수익을 만들려면 비교표가 먼저입니다",
  experience_review: "체험단 글은 후기보다 신청 전 준비물이 중요합니다",
  how_to: "퇴근 후 블로그 글을 30분 안에 완성하는 실전 구조",
  backup_search_answer: "오늘 바로 쓰는 검색형 블로그 글 구조 5단계",
  backup_how_to: "AI 티 안 나게 블로그 첫 문단을 쓰는 방법"
};

function platformFor(index) {
  return index % 2 === 0 ? "coupang" : "naver_shopping_connect";
}

function bodyFor({ title, contentType, platform }) {
  const cpaLine = requiresCpa(contentType)
    ? `\n\n${DISCLOSURES[platform]}\n\n추천 링크는 실제 발행 직전에 승인된 상품 링크만 넣습니다. 링크가 없거나 임시 링크라면 이 글은 발행하지 않고 대체 글로 슬롯을 채웁니다.`
    : "";
  return [
    `${title}`,
    "",
    "먼저 결론부터 말하면, 수익형 블로그 글은 예쁜 문장보다 검색자가 지금 바로 비교할 기준을 먼저 줘야 합니다. 초보가 가장 많이 막히는 지점은 정보가 부족한 것이 아니라, 어떤 순서로 확인해야 하는지 모르는 것입니다. 그래서 이 글은 제목, 첫 문단, 비교 기준, 다음 행동까지 한 번에 정리합니다.",
    "",
    "오늘 봐야 할 기준은 세 가지입니다. 첫째, 검색자가 실제로 어떤 상황에서 이 키워드를 입력하는지입니다. 둘째, 읽은 사람이 오늘 바로 실행할 수 있는 절차가 있는지입니다. 셋째, 구매나 신청으로 이어질 만한 판단 기준이 본문 안에 충분히 보이는지입니다.",
    "",
    "비교 기준: 검색 의도, 가격대, 후기 수, 신청 조건, 사용 상황, 대체 상품 여부, 공식 사이트 확인 여부를 함께 봅니다. 단순히 조회수가 좋아 보이는 키워드보다 읽는 사람이 저장하고 다시 열어볼 수 있는 글이 링크 클릭과 전환에 더 가깝습니다.",
    "",
    "체크리스트",
    "1. 제목에 검색자가 실제로 입력할 문장이 들어갔는지 확인합니다.",
    "2. 첫 3줄 안에 결론과 읽는 사람의 상황이 보이는지 확인합니다.",
    "3. 본문 중간에 가격, 사이트명, 후기 수, 조건 중 하나 이상이 있는지 확인합니다.",
    "4. 마지막에 검색, 비교, 신청, 구매, 저장 중 다음 행동이 있는지 확인합니다.",
    "5. 제휴 링크가 들어간다면 고지 문구와 실제 승인 링크가 본문 안에 있는지 확인합니다.",
    "",
    "실전 순서는 간단합니다. 먼저 네이버 검색창에 제목 후보를 그대로 넣고, 첫 화면에 어떤 글이 뜨는지 봅니다. 광고 글만 가득하면 초보 블로그가 바로 이기기 어렵습니다. 대신 개인 후기, 비교 글, 질문형 글이 섞여 있으면 들어갈 틈이 있습니다.",
    "",
    "본문에는 경험처럼 읽히는 정보와 판단 기준을 같이 넣습니다. 상품 글이라면 가격만 적지 말고 왜 이 상황에서 필요한지, 어떤 경우에는 피해야 하는지, 비슷한 상품과 비교할 때 어디를 봐야 하는지를 정리합니다. 체험단 글이라면 좋았다는 말보다 신청 전 준비물, 사진 구성, 방문 전 확인할 점을 넣습니다.",
    "",
    "FAQ",
    "Q. 조회수가 높은 키워드만 쓰면 되나요?",
    "A. 아닙니다. 수익형 블로그는 조회수보다 검색 의도와 다음 행동이 있는 글이 중요합니다.",
    "Q. 제휴 글은 링크만 넣으면 되나요?",
    "A. 아닙니다. 상품 링크보다 구매 상황과 비교 기준이 먼저 있어야 클릭이 생깁니다.",
    "",
    "다음 행동: 오늘 발행 전 제목, 첫 문단, 비교 기준, FAQ, 링크와 고지 상태를 확인하세요. 이 다섯 가지가 맞으면 글은 그냥 흘러가는 일기보다 훨씬 강해집니다.",
    cpaLine
  ].join("\n");
}

function makeAffiliateLinks({ contentType, platform }) {
  if (!requiresCpa(contentType)) return [];
  return [
    {
      platform,
      label: platform === "coupang" ? "검수 필요 쿠팡 상품 링크" : "검수 필요 네이버 쇼핑 커넥트 링크",
      url: "https://example.com/replace-with-approved-affiliate-link",
      status: "needs_real_link"
    }
  ];
}

function makePost({ account, date, index, contentType, backup = false }) {
  const platform = platformFor(index);
  const titleKey = contentType === "shopping_cpa" ? `shopping_cpa_${platform}` : contentType;
  const title = titleMap[backup ? `backup_${contentType}` : titleKey] || titleMap.search_answer;
  const affiliateLinks = makeAffiliateLinks({ contentType, platform });
  const disclosure = requiresCpa(contentType) ? DISCLOSURES[platform] : "";
  const status = affiliateLinks.some((link) => link.status === "needs_real_link")
    ? "blocked_cpa_link_required"
    : "ready_to_review";
  const post = {
    id: `${account.accountKey}-${dateKey(date)}-${String(index + 1).padStart(2, "0")}-${backup ? "backup-" : ""}${contentType}`,
    accountKey: account.accountKey,
    channel: account.channel,
    status,
    publish_time_kst: account.defaultPublishTimesKst[index % account.defaultPublishTimesKst.length],
    content_type: contentType,
    title,
    body: bodyFor({ title, contentType, platform }),
    tags: ["블로그수익화", "부업블로그", "제휴마케팅", "쇼핑커넥트", "쿠팡파트너스", "AEO"],
    quality_rules: { SUA: true, AU: true, GU: true },
    affiliate_links: affiliateLinks,
    disclosure,
    marketing_notes: [
      "본문은 검색 의도, 읽는 사람의 상황, 오늘 행동을 먼저 보여준다.",
      "CPA 글은 실제 승인 링크가 들어가기 전에는 발행 금지다.",
      "상품명 나열보다 비교 기준과 구매 상황을 먼저 만든다."
    ]
  };
  post.aeo = scoreAeo(post);
  if (post.status === "ready_to_review" && !post.aeo.publishable) {
    post.status = "blocked_aeo_rewrite_required";
  }
  return post;
}

function addReplacementPosts({ account, date, posts }) {
  const out = [...posts];
  let readyCount = out.filter((post) => post.status === "ready_to_review").length;
  let index = out.length;
  const replacements = ["search_answer", "how_to", "comparison_guide", "experience_review"];
  while (readyCount < MIN_DAILY_BLOG_POSTS) {
    const contentType = replacements[index % replacements.length];
    const replacement = makePost({ account, date, index, contentType, backup: true });
    replacement.replacement_for = "blocked_or_unpublishable_daily_slot";
    out.push(replacement);
    if (replacement.status === "ready_to_review") readyCount += 1;
    index += 1;
  }
  return out;
}

export function buildDailyBlogQueue({ accountKey, date = normalizeDateKst() }) {
  const account = accountByKey(accountKey);
  const mix = Array.isArray(account.contentMix) && account.contentMix.length ? account.contentMix : [];
  const initialPosts = Array.from({ length: Math.max(MIN_DAILY_BLOG_POSTS, account.dailyMinimumPosts || 0) }, (_, index) =>
    makePost({ account, date, index, contentType: mix[index % mix.length] || "search_answer" })
  );
  const posts = addReplacementPosts({ account, date, posts: initialPosts });
  return {
    accountKey: account.accountKey,
    displayName: account.displayName,
    date,
    dailyMinimumPosts: MIN_DAILY_BLOG_POSTS,
    monthlyRevenueTargetKrw: account.monthlyRevenueTargetKrw || null,
    dailyAffiliateClickTarget: account.dailyAffiliateClickTarget || null,
    posts
  };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("generate_blog_daily_queue.mjs");
if (isDirectRun) {
  const accountKey = process.argv[2] || "taemomjo";
  const date = process.argv[3] || normalizeDateKst();
  const queue = buildDailyBlogQueue({ accountKey, date });
  const errors = validateDailyQueue(queue);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  const outPath = path.join("outputs", "blog", accountKey, "automation", date, `${accountKey}-${dateKey(date)}-daily-queue.json`);
  writeJson(outPath, queue);
  console.log(JSON.stringify({ ok: true, output: outPath, posts: queue.posts.length }, null, 2));
}
