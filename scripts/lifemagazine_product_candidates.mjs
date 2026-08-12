export const COUPANG_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

const LOW_RISK_KEYWORDS = [
  "머리끈",
  "수납",
  "정리",
  "파우치",
  "케이블",
  "클립",
  "청소포",
  "행주",
  "욕실",
  "주방",
  "립밤",
  "거치대",
  "트레이",
];

export const PRODUCT_SELECTION_RULES = {
  mustHave: ["product_name", "affiliate_url", "recommendation_reason", "when_to_use"],
  reject: ["성분·사용법을 확인할 수 없는 건강·영양 카테고리", "사용 상황이 없는 단순 최저가 상품", "과장된 효능·치료 표현이 필요한 상품"],
  editorialOrder: ["왜 지금 추천하는지", "언제 꺼내면 좋은지", "어떻게 쓰거나 섭취하는지", "구매 전 확인할 점", "공정위 고지 댓글"],
};

const HOLD_KEYWORDS = [
  "영양제",
  "비타민",
  "다이어트",
  "의료",
  "혈당",
  "관절",
  "탈모",
  "투자",
  "보험",
  "전기장판",
  "온열",
  "칼",
  "가위",
];

function firstText(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function riskLevelFor(text) {
  if (HOLD_KEYWORDS.some((keyword) => text.includes(keyword))) return "hold";
  if (LOW_RISK_KEYWORDS.some((keyword) => text.includes(keyword))) return "low";
  return "medium";
}

function sceneHintFor(text) {
  if (/링티|수분\s*보충|전해질|어린이용\s*(?:음료|식품)/.test(text)) return "더운 날 야외활동 뒤 아이가 땀을 많이 흘렸을 때";
  if (text.includes("머리끈")) return "머리끈 맨날 잃어버리는 사람";
  if (text.includes("케이블") || text.includes("충전")) return "책상 위 충전선이 자꾸 굴러다니는 사람";
  if (text.includes("수납") || text.includes("정리")) return "잔물건이 계속 굴러다니는 공간";
  if (text.includes("파우치")) return "가방 안에서 작은 물건이 사라지는 사람";
  if (text.includes("청소") || text.includes("행주")) return "매일 쓰는 소모품 떨어지면 귀찮은 집";
  return "생활 속 작은 불편이 반복되는 상황";
}

export function normalizeProductCandidate(input = {}, options = {}) {
  const productName = firstText(input.product_name, input.productName, input.itemName, input.name);
  const category = firstText(input.category, input.categoryName, input.keyword, input.group);
  const text = `${productName} ${category}`;
  const riskLevel = riskLevelFor(text);
  const reviewCount = firstNumber(input.review_count, input.reviewCount, input.review_count_text);

  const isHealthSensitive = /링티|수분\s*보충|전해질|영양제|비타민|의료|건강/.test(text);
  const whenToUse = firstText(input.when_to_use, input.whenToUse, input.scene_hint, sceneHintFor(text));
  const recommendationReason = firstText(input.recommendation_reason, input.recommendationReason, input.selection_reason, whenToUse);
  const usageGuidance = firstText(input.usage_guidance, input.usageGuidance, input.how_to_use, input.howToUse);
  const officialSources = Array.isArray(input.official_sources) ? input.official_sources.filter(Boolean) : [];

  return {
    source: firstText(input.source, "coupang_api"),
    product_id: firstText(input.product_id, input.productId, input.itemId, input.id),
    product_name: productName,
    category,
    price: firstNumber(input.price, input.productPrice, input.salePrice),
    rating: firstNumber(input.rating, input.productRating),
    review_count: reviewCount,
    product_url: firstText(input.product_url, input.productUrl, input.url),
    affiliate_url: firstText(input.affiliate_url, input.affiliateUrl, input.shortUrl),
    image_url: firstText(input.image_url, input.productImage, input.imageUrl, input.thumbnail),
    brand: firstText(input.brand, input.brandName),
    description: firstText(input.description, input.productDescription),
    metadata_status: firstText(input.metadata_status, input.metadataStatus),
    metadata_error: firstText(input.metadata_error, input.metadataError),
    collected_at: options.collectedAt || input.collected_at || new Date().toISOString(),
    selection_reason: recommendationReason,
    recommendation_reason: recommendationReason,
    when_to_use: whenToUse,
    usage_guidance: usageGuidance,
    official_sources: officialSources,
    requires_manual_claim_review: isHealthSensitive,
    selection_status: isHealthSensitive ? "manual_review_required" : "brief_required",
    operator_note: firstText(input.operator_note, input.memo, input.note),
    scene_hint: whenToUse,
    usage_status: input.usage_status === "actual_used" ? "actual_used" : "not_confirmed",
    risk_level: riskLevel,
    score: (riskLevel === "low" ? 100 : riskLevel === "medium" ? 50 : -100) + Math.min(reviewCount / 20, 30),
  };
}

export function rankProductCandidates(candidates = []) {
  return candidates
    .map((candidate) => normalizeProductCandidate(candidate))
    .filter((candidate) => candidate.product_name && candidate.affiliate_url)
    .sort((a, b) => b.score - a.score || b.review_count - a.review_count || a.product_name.localeCompare(b.product_name, "ko"));
}

export function fixtureProductCandidates(date = new Date().toISOString().slice(0, 10)) {
  return [
    { productId: `${date}-hair`, productName: "대용량 머리끈 100개", categoryName: "헤어소품", productPrice: 8900, reviewCount: 812, affiliateUrl: "https://link.coupang.com/a/sample-hair", productImage: "https://example.com/hair.jpg" },
    { productId: `${date}-cable`, productName: "케이블 정리 클립", categoryName: "생활용품", productPrice: 6900, reviewCount: 401, affiliateUrl: "https://link.coupang.com/a/sample-cable", productImage: "https://example.com/cable.jpg" },
    { productId: `${date}-pouch`, productName: "작은 소지품 파우치", categoryName: "가방정리", productPrice: 9900, reviewCount: 255, affiliateUrl: "https://link.coupang.com/a/sample-pouch", productImage: "https://example.com/pouch.jpg" },
    { productId: `${date}-tray`, productName: "책상 잔물건 정리 트레이", categoryName: "수납정리", productPrice: 7900, reviewCount: 180, affiliateUrl: "https://link.coupang.com/a/sample-tray", productImage: "https://example.com/tray.jpg" },
  ].map((item) => normalizeProductCandidate(item, { collectedAt: `${date}T00:00:00.000Z` }));
}

export function selectDailyProductCandidates(candidates = [], count = 3) {
  const selected = [];
  const seenNames = new Set();
  const normalized = candidates.map((candidate) => normalizeProductCandidate(candidate));
  const completeBrief = (candidate) => candidate.recommendation_reason && candidate.when_to_use;
  const manual = normalized.filter((candidate) => candidate.source === "manual_queue" && candidate.product_name && candidate.affiliate_url && completeBrief(candidate));
  const automatic = normalized.filter((candidate) => candidate.source !== "manual_queue" && candidate.product_name && candidate.affiliate_url && completeBrief(candidate));
  for (const candidate of [...manual, ...rankProductCandidates(automatic)]) {
    if (candidate.risk_level === "hold" || candidate.requires_manual_claim_review) continue;
    if (seenNames.has(candidate.product_name)) continue;
    selected.push(candidate);
    seenNames.add(candidate.product_name);
    if (selected.length === count) break;
  }
  return selected;
}
