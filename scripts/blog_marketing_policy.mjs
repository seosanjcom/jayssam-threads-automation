export const MIN_DAILY_BLOG_POSTS = 5;

export const QUALITY_RULES = {
  SUA: {
    label: "Search-User-Action",
    checks: [
      "검색자가 실제로 입력할 만한 질문/키워드를 제목과 첫 문단에 반영한다.",
      "독자의 상황을 한 문장으로 좁힌다.",
      "읽고 바로 할 수 있는 행동을 본문에 넣는다."
    ]
  },
  AU: {
    label: "Authority-Usefulness",
    checks: [
      "공식 출처, 가격, 조건, 기준, 비교표 중 하나 이상을 넣는다.",
      "추상적인 조언보다 사이트명, 절차, 숫자, 선택 기준을 우선한다."
    ]
  },
  GU: {
    label: "Gain-Use",
    checks: [
      "독자가 얻는 이득을 저장 가능한 체크리스트나 판단 기준으로 만든다.",
      "구매/신청/검색/비교 중 다음 행동이 분명해야 한다."
    ]
  }
};

export const DISCLOSURES = {
  coupang: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  naver_shopping_connect:
    "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."
};

export function requiresCpa(contentType) {
  return ["shopping_cpa", "product_comparison", "deal_guide"].includes(contentType);
}

export function normalizeDateKst(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function validateBlogPost(post) {
  const errors = [];
  const text = `${post.title || ""}\n${post.body || ""}\n${(post.tags || []).join(" ")}`;
  const rules = post.quality_rules || {};

  for (const key of Object.keys(QUALITY_RULES)) {
    if (rules[key] !== true) errors.push(`${key} quality rule is missing.`);
  }

  if (!post.title || String(post.title).trim().length < 12) {
    errors.push("title is too short.");
  }
  if (!post.body || String(post.body).trim().length < 900) {
    errors.push("body must be at least 900 characters for blog publishing.");
  }
  if (!Array.isArray(post.tags) || post.tags.length < 5) {
    errors.push("at least 5 tags are required.");
  }
  if (requiresCpa(post.content_type)) {
    const links = Array.isArray(post.affiliate_links) ? post.affiliate_links : [];
    if (links.length === 0) errors.push("CPA/shopping post requires affiliate_links.");
    for (const link of links) {
      if (!link.platform || !DISCLOSURES[link.platform]) {
        errors.push(`unsupported affiliate platform: ${link.platform || "missing"}.`);
      }
      if (!link.url || !/^https?:\/\//.test(String(link.url))) {
        errors.push("affiliate link URL is missing or invalid.");
      }
    }
    if (!post.disclosure || !text.includes(post.disclosure)) {
      errors.push("affiliate disclosure must be included in the post body.");
    }
  }

  return errors;
}

export function validateDailyQueue(queue) {
  const errors = [];
  if (!queue.accountKey) errors.push("accountKey is missing.");
  if (!queue.date) errors.push("date is missing.");
  if (!Array.isArray(queue.posts)) errors.push("posts must be an array.");
  if (Array.isArray(queue.posts) && queue.posts.length < MIN_DAILY_BLOG_POSTS) {
    errors.push(`daily blog queue requires at least ${MIN_DAILY_BLOG_POSTS} posts.`);
  }
  for (const [index, post] of (queue.posts || []).entries()) {
    for (const error of validateBlogPost(post)) {
      errors.push(`posts[${index}]: ${error}`);
    }
  }
  return errors;
}
