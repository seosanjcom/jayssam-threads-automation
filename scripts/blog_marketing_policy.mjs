export const MIN_DAILY_BLOG_POSTS = 5;
export const MIN_AEO_SCORE = 85;

export const QUALITY_RULES = {
  SUA: {
    label: "Search-User-Action",
    checks: [
      "검색자가 실제로 입력할 질문이나 키워드를 제목과 첫 문단에 반영한다.",
      "읽는 사람의 상황을 한 문장으로 좁힌다.",
      "읽고 바로 할 수 있는 다음 행동을 본문에 넣는다."
    ]
  },
  AU: {
    label: "Authority-Usefulness",
    checks: [
      "공식 출처, 가격, 조건, 기준, 후기 수 중 하나 이상을 넣는다.",
      "추상적인 조언보다 사이트명, 절차, 숫자, 선택 기준을 우선한다."
    ]
  },
  GU: {
    label: "Gain-Use",
    checks: [
      "읽는 사람이 얻는 이득을 저장 가능한 체크리스트나 판단 기준으로 만든다.",
      "구매, 신청, 검색, 비교 중 다음 행동이 분명해야 한다."
    ]
  }
};

export const DISCLOSURES = {
  coupang: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.",
  naver_shopping_connect: "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."
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

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function scoreAeo(post) {
  const title = String(post.title || "").trim();
  const body = String(post.body || "").trim();
  const text = `${title}\n${body}\n${(post.tags || []).join(" ")}`;
  const reasons = [];
  let score = 0;

  if (title.length >= 18 && includesAny(title, [/기준|방법|비교|추천|고르는|체크|2026|오늘|실전|선점/])) score += 15;
  else reasons.push("title needs search intent and a concrete angle.");

  const firstLines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3).join(" ");
  if (firstLines.length >= 60 && includesAny(firstLines, [/먼저|기준|봐야|줄일 수|정리|바로/])) score += 15;
  else reasons.push("first 3 lines need a direct answer.");

  if (includesAny(text, [/비교 기준|가격|후기|조건|공식|사이트|절차|신청|구매|리뷰 수|검색량/])) score += 15;
  else reasons.push("authority/usefulness evidence is missing.");

  if (includesAny(text, [/체크리스트|1\.|2\.|3\.|Q\.|FAQ|자주 묻는/])) score += 15;
  else reasons.push("checklist or FAQ structure is missing.");

  if (includesAny(text, [/다음 행동|검색하세요|비교하세요|확인하세요|신청하세요|저장|링크/])) score += 15;
  else reasons.push("next action is missing.");

  if (body.length >= 900) score += 10;
  else reasons.push("body is too short for blog AEO.");

  if (Array.isArray(post.tags) && post.tags.length >= 5) score += 5;
  else reasons.push("at least 5 tags are needed.");

  const rules = post.quality_rules || {};
  if (rules.SUA === true && rules.AU === true && rules.GU === true) score += 10;
  else reasons.push("SUA/AU/GU gates are incomplete.");

  return {
    score,
    publishable: score >= MIN_AEO_SCORE,
    reasons
  };
}

function isPlaceholderUrl(url) {
  return !url || /example\.com|replace-with|placeholder|localhost/i.test(String(url));
}

function candidateScore(product) {
  const price = Number(product.price || product.productPrice || 0);
  const reviewCount = Number(product.reviewCount || 0);
  let score = 0;
  if (product.platform === "coupang") score += 8;
  if (product.platform === "naver_shopping_connect") score += 6;
  if (price >= 15000) score += 8;
  if (price >= 50000) score += 8;
  if (reviewCount >= 300) score += 8;
  if (reviewCount >= 1000) score += 8;
  if (String(product.productName || product.name || "").length >= 5) score += 4;
  return score;
}

export function selectAffiliateCandidates({ contentType, products = [], limit = 2 }) {
  if (!requiresCpa(contentType)) return [];
  return products
    .filter((product) => DISCLOSURES[product.platform])
    .filter((product) => !isPlaceholderUrl(product.url || product.affiliateUrl))
    .map((product) => ({
      platform: product.platform,
      label: product.label || product.productName || product.name,
      url: product.url || product.affiliateUrl,
      price: Number(product.price || product.productPrice || 0),
      reviewCount: Number(product.reviewCount || 0),
      score: candidateScore(product),
      status: "ready"
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function validateBlogPost(post) {
  const errors = [];
  const text = `${post.title || ""}\n${post.body || ""}\n${(post.tags || []).join(" ")}`;
  const rules = post.quality_rules || {};
  const aeo = post.aeo || scoreAeo(post);
  const isBlocked = String(post.status || "").startsWith("blocked_");

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
  if (!isBlocked && aeo.score < MIN_AEO_SCORE) {
    errors.push(`AEO score must be at least ${MIN_AEO_SCORE}.`);
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
      if (!isBlocked && isPlaceholderUrl(link.url)) {
        errors.push("publishable CPA post cannot use a placeholder affiliate link.");
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
  const posts = Array.isArray(queue.posts) ? queue.posts : [];
  const readyCount = posts.filter((post) => post.status === "ready_to_review").length;
  if (readyCount < MIN_DAILY_BLOG_POSTS) {
    errors.push(`daily blog queue requires at least ${MIN_DAILY_BLOG_POSTS} publishable posts.`);
  }
  for (const [index, post] of posts.entries()) {
    for (const error of validateBlogPost(post)) {
      errors.push(`posts[${index}]: ${error}`);
    }
  }
  return errors;
}
