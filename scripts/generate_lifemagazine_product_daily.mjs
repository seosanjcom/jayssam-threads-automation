import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { selectDailyProductCandidates } from "./lifemagazine_product_candidates.mjs";
import { searchCoupangPartnerProducts } from "./coupang_partners_api.mjs";
import { generateLifemagazineDraft, saveLifemagazineDraft } from "./generate_lifemagazine_draft.mjs";
import { loadManualProductQueue } from "./lifemagazine_telegram_product_queue.mjs";
import { sendLifemagazinePreview } from "./send_lifemagazine_preview_telegram.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";

export const DAILY_PRODUCT_SLOTS = [
  { slot: "morning", time: "11:30", label: "오전 생활템" },
  { slot: "evening", time: "18:00", label: "저녁 생활템" },
];

// 상품명만으로도 용도와 추천 근거를 과장 없이 설명할 수 있는 생활용품만 자동 검색한다.
// 건강·영양·어린이·의료·고위험 카테고리는 후보 선별기에서 다시 차단한다.
export const SAFE_COUPANG_QUERY_ROTATION = [
  {
    keyword: "케이블 정리 클립",
    recommendation_reason: "충전선이 책상 위에서 계속 굴러다니는 불편을 정리할 수 있는 생활템이라서",
    when_to_use: "재택근무 책상이나 침대 옆 충전선이 자꾸 엉킬 때",
    usage_guidance: "케이블 굵기와 부착 위치를 먼저 확인한 뒤 필요한 곳에만 붙여 써",
  },
  {
    keyword: "책상 정리 트레이",
    recommendation_reason: "매일 쓰는 작은 물건의 자리를 한곳에 잡아두기 좋은 정리템이라서",
    when_to_use: "리모컨·열쇠·이어폰처럼 자주 찾는 물건이 계속 흩어질 때",
    usage_guidance: "올려둘 물건의 크기를 재고, 동선 가까운 곳에 하나만 두고 써",
  },
  {
    keyword: "여행용 소지품 파우치",
    recommendation_reason: "가방 속 자잘한 물건을 한 번에 꺼내기 쉽게 정리할 수 있어서",
    when_to_use: "립밤·보조배터리·이어폰처럼 가방 안에서 자꾸 사라지는 물건이 있을 때",
    usage_guidance: "평소 들고 다니는 물건을 먼저 펼쳐 보고 크기에 맞는 파우치를 골라",
  },
  {
    keyword: "옷걸이 연결 고리",
    recommendation_reason: "옷장 안에서 같은 종류의 옷을 세로로 정리할 때 공간을 덜 차지하게 해줘서",
    when_to_use: "셔츠나 얇은 옷이 늘어나 옷장 자리가 부족할 때",
    usage_guidance: "옷걸이 무게와 옷장 높이를 먼저 확인하고 가벼운 옷부터 걸어 써",
  },
  {
    keyword: "수납 정리 바구니",
    recommendation_reason: "자주 쓰는 물건을 종류별로 묶어두기 쉬운 기본 생활템이라서",
    when_to_use: "욕실·주방·현관처럼 작은 물건이 계속 늘어나는 곳을 정리할 때",
    usage_guidance: "넣을 물건의 양을 먼저 정하고, 너무 큰 바구니 하나보다 용도별로 나눠 써",
  },
  {
    keyword: "싱크대 수세미 거치대",
    recommendation_reason: "설거지 뒤 젖은 수세미를 싱크대 주변에 그대로 두는 불편을 줄여줘서",
    when_to_use: "수세미나 행주 둘 자리가 애매해서 싱크대가 쉽게 어수선해질 때",
    usage_guidance: "싱크대 폭과 설치 방식, 물 빠짐 구조를 확인한 뒤 골라",
  },
];

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function kstDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function rotationStartIndex(date) {
  const digits = String(date || "").replace(/\D/g, "");
  const numeric = Number(digits.slice(-4)) || 0;
  return numeric % SAFE_COUPANG_QUERY_ROTATION.length;
}

function isCoupangAffiliateUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "link.coupang.com";
  } catch {
    return false;
  }
}

export function buildCoupangCandidate(product, brief) {
  const affiliateUrl = String(product.product_url || "").trim();
  if (!isCoupangAffiliateUrl(affiliateUrl)) return null;
  return {
    source: "coupang_api",
    product_id: product.product_id,
    product_name: product.product_name,
    category: product.category_name,
    price: product.price,
    brand: product.brand,
    description: product.description,
    product_url: affiliateUrl,
    affiliate_url: affiliateUrl,
    image_url: product.image_url,
    metadata_status: "coupang_partner_api_resolved",
    recommendation_reason: brief.recommendation_reason,
    when_to_use: brief.when_to_use,
    usage_guidance: brief.usage_guidance,
    operator_note: `쿠팡 파트너스 API 검색어: ${brief.keyword}`,
  };
}

export async function collectSafeCoupangCandidates(options = {}) {
  const date = options.date || kstDateKey();
  const count = Math.max(2, Number(options.count || DAILY_PRODUCT_SLOTS.length));
  const start = rotationStartIndex(date);
  const briefs = Array.from({ length: Math.min(SAFE_COUPANG_QUERY_ROTATION.length, count + 2) }, (_, index) => (
    SAFE_COUPANG_QUERY_ROTATION[(start + index) % SAFE_COUPANG_QUERY_ROTATION.length]
  ));
  const candidates = [];
  const queryResults = [];

  for (const brief of briefs) {
    const result = await searchCoupangPartnerProducts(brief.keyword, {
      limit: 6,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      fetchImpl: options.fetchImpl,
    });
    queryResults.push({ keyword: brief.keyword, status: result.status, error: result.error || "", received: result.products.length });
    for (const product of result.products) {
      const candidate = buildCoupangCandidate(product, brief);
      if (candidate) candidates.push(candidate);
    }
  }

  return { date, candidates, queryResults };
}

export function generateDailyProductDrafts(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date || kstDateKey();
  const manualCandidates = options.manualCandidates || loadManualProductQueue(date, { root });
  const automaticCandidates = options.candidates || [];
  const targetCount = Number(options.count || DAILY_PRODUCT_SLOTS.length);
  const selected = selectDailyProductCandidates([...manualCandidates, ...automaticCandidates], targetCount);
  if (selected.length < targetCount) {
    throw new Error(`자동 발행 가능한 저위험 라이프매거진 상품 후보가 부족합니다. 필요=${targetCount}, 선별=${selected.length}`);
  }

  return selected.map((candidate, index) => {
    const slot = DAILY_PRODUCT_SLOTS[index];
    const autoApproved = options.autoApprove === true && candidate.source === "coupang_api";
    const draft = generateLifemagazineDraft({
      date,
      slot: slot.slot,
      custom_publish_time: slot.time,
      topic: `${slot.label}: ${candidate.product_name}`,
      content_mode: "found_product",
      product_candidate: candidate,
      product_name: candidate.product_name,
      operator_note: candidate.operator_note,
      scene_brief: candidate.scene_hint,
      target_reader: candidate.scene_hint,
      notes: candidate.description,
      status: autoApproved ? "approved" : "ready_to_review",
      product_metadata: {
        brand: candidate.brand,
        price: candidate.price,
        source_url: candidate.product_url || candidate.affiliate_url,
        metadata_status: candidate.metadata_status,
        coupang_api_candidate: candidate.source === "coupang_api",
      },
      product_links: [{ label: "제품 링크", url: candidate.affiliate_url, platform: "coupang" }],
    }, { now: options.now });
    if (autoApproved) {
      draft.approval_source = "automatic_safe_coupang_selection";
      draft.auto_publish_allowed = true;
    }
    const validation = validateLifemagazineDraft(draft);
    if (!validation.ok) throw new Error(`Invalid Lifemagazine product draft ${draft.id}: ${validation.errors.join("; ")}`);
    const savedPath = saveLifemagazineDraft(draft, { root });
    return { ...draft, saved_path: savedPath };
  });
}

export async function generateDailyProductDraftsAndPreview(options = {}) {
  const date = options.date || kstDateKey();
  let candidates = options.candidates;
  let queryResults = [];
  if (!candidates) {
    const result = await collectSafeCoupangCandidates({
      date,
      count: options.count || DAILY_PRODUCT_SLOTS.length,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      fetchImpl: options.fetchImpl,
    });
    candidates = result.candidates;
    queryResults = result.queryResults;
  }
  const drafts = generateDailyProductDrafts({ ...options, date, candidates });
  if (options.sendPreview) {
    for (const draft of drafts) {
      await sendLifemagazinePreview(draft.saved_path, { root: options.root || process.cwd() });
    }
  }
  return { drafts, queryResults };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  const args = new Set(process.argv.slice(2));
  const tomorrow = args.has("--tomorrow");
  const dateArg = process.argv.slice(2).find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  const targetDate = dateArg || (tomorrow
    ? kstDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
    : undefined);
  const result = await generateDailyProductDraftsAndPreview({
    date: targetDate,
    sendPreview: args.has("--send-preview"),
    autoApprove: args.has("--auto-approve"),
  });
  console.log(JSON.stringify({
    ok: true,
    count: result.drafts.length,
    ids: result.drafts.map((draft) => draft.id),
    product_search: result.queryResults,
  }, null, 2));
}
