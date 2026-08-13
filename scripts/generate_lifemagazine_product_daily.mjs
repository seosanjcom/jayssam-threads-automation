import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { publishedProductKeysWithinDays, selectDailyProductCandidates } from "./lifemagazine_product_candidates.mjs";
import { getCoupangPartnerBestProducts } from "./coupang_partners_api.mjs";
import { generateLifemagazineDraft, saveLifemagazineDraft } from "./generate_lifemagazine_draft.mjs";
import { loadManualProductQueue } from "./lifemagazine_telegram_product_queue.mjs";
import { sendLifemagazinePreview } from "./send_lifemagazine_preview_telegram.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";

export const DAILY_PRODUCT_SLOTS = [
  { slot: "morning", time: "11:30", label: "오전 생활템" },
  { slot: "evening", time: "18:00", label: "저녁 생활템" },
];

// 라이프매거진은 한 카테고리만 반복하지 않는다. 각 생활 대상의 실제 장면을 기준으로
// 쿠팡 카테고리 베스트 상위 1~5위만 수집하고, 건강·어린이·식품은 후보 단계에서 차단한다.
export const LIFESTYLE_CATEGORY_ROTATION = [
  { lifestyle_group: "육아가정", category_id: 1014, category_name: "생활용품", recommendation_reason: "가족이 함께 쓰는 공간의 잔불편을 덜어주는 기본 생활템이라서", when_to_use: "현관·욕실·거실에 작은 물건이 자꾸 쌓일 때", usage_guidance: "집에서 둘 위치와 크기를 먼저 확인하고 필요한 곳에만 하나씩 써" },
  { lifestyle_group: "워킹맘", category_id: 1010, category_name: "뷰티", recommendation_reason: "출근 전후에 짧게 챙길 수 있는 실용적인 소지품이면 좋겠어서", when_to_use: "가방과 책상에 매일 챙길 작은 물건이 필요할 때", usage_guidance: "성분·피부 타입처럼 개인차가 큰 내용은 확인하고, 생활 소품 위주로 골라" },
  { lifestyle_group: "1인가구", category_id: 1013, category_name: "주방용품", recommendation_reason: "혼자 사는 집에서 매일 반복되는 정리와 설거지 동선을 조금 편하게 해줘서", when_to_use: "싱크대와 조리대가 금방 어수선해질 때", usage_guidance: "싱크대 폭과 설치 방식, 수납할 물건의 크기를 먼저 확인해" },
  { lifestyle_group: "대학생", category_id: 1021, category_name: "문구/오피스", recommendation_reason: "강의실과 책상 사이를 오갈 때 자주 쓰는 물건을 정리하기 좋아서", when_to_use: "필기구·충전선·작은 소지품이 가방 안에서 자꾸 섞일 때", usage_guidance: "평소 들고 다니는 물건의 크기와 수납 위치를 먼저 보고 골라" },
  { lifestyle_group: "자취생", category_id: 1014, category_name: "생활용품", recommendation_reason: "작은 집에서 바로 체감되는 정리와 청소의 불편을 줄여줘서", when_to_use: "세면대·현관·침대 옆에 물건이 계속 굴러다닐 때", usage_guidance: "붙이거나 걸기 전에는 설치할 면과 무게를 확인해" },
  { lifestyle_group: "워킹맘", category_id: 1014, category_name: "생활용품", recommendation_reason: "바쁜 평일에 집안 동선을 한 번 덜 돌아도 되는 생활템이라서", when_to_use: "출근 준비와 귀가 뒤에 자주 찾는 물건의 자리가 애매할 때", usage_guidance: "하루에 가장 자주 지나는 동선 가까이에만 두고 써" },
  { lifestyle_group: "육아가정", category_id: 1015, category_name: "홈인테리어", recommendation_reason: "가족이 쓰는 거실과 방을 조금 더 편하게 정리하는 데 도움이 될 수 있어서", when_to_use: "거실이나 방에서 자잘한 물건의 자리가 계속 바뀔 때", usage_guidance: "공간 크기와 고정 방식, 아이 손이 닿는 위치인지를 먼저 확인해" },
  { lifestyle_group: "1인가구", category_id: 1014, category_name: "생활용품", recommendation_reason: "혼자 쓰는 공간의 반복되는 작은 불편을 줄이기 좋아서", when_to_use: "침대 옆이나 욕실처럼 매일 쓰는 좁은 공간이 어수선할 때", usage_guidance: "딱 필요한 수량만 두고, 청소하기 쉬운 구조인지 확인해" },
  { lifestyle_group: "대학생", category_id: 1014, category_name: "생활용품", recommendation_reason: "자취방·기숙사처럼 작은 공간에서 쓰기 좋은 기본 생활템이라서", when_to_use: "책상과 침대 주변의 충전선·소지품을 정리하고 싶을 때", usage_guidance: "기숙사나 자취방의 설치 가능 여부와 크기를 먼저 확인해" },
  { lifestyle_group: "자취생", category_id: 1013, category_name: "주방용품", recommendation_reason: "혼밥 뒤 설거지와 수납을 조금 간단하게 만들 수 있어서", when_to_use: "설거지 뒤 수세미나 행주 둘 곳이 마땅하지 않을 때", usage_guidance: "물 빠짐과 고정 방식, 싱크대 재질을 먼저 확인해" },
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

function kstClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return `${parts.hour}:${parts.minute}`;
}

function rotationStartIndex(date) {
  const digits = String(date || "").replace(/\D/g, "");
  const numeric = Number(digits.slice(-4)) || 0;
  return numeric % LIFESTYLE_CATEGORY_ROTATION.length;
}

function isCoupangAffiliateUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "link.coupang.com";
  } catch {
    return false;
  }
}

export function buildCoupangCandidate(product, profile) {
  const affiliateUrl = String(product.product_url || "").trim();
  if (!isCoupangAffiliateUrl(affiliateUrl)) return null;
  return {
    source: "coupang_api",
    product_id: product.product_id,
    product_name: product.product_name,
    category: profile.category_name || product.category_name,
    category_id: profile.category_id,
    category_rank: product.category_rank,
    lifestyle_group: profile.lifestyle_group,
    price: product.price,
    brand: product.brand,
    description: product.description,
    product_url: affiliateUrl,
    affiliate_url: affiliateUrl,
    image_url: product.image_url,
    metadata_status: "coupang_partner_api_category_best",
    recommendation_reason: profile.recommendation_reason,
    when_to_use: profile.when_to_use,
    usage_guidance: profile.usage_guidance,
    operator_note: `쿠팡 파트너스 ${profile.category_name} 베스트 ${product.category_rank}위 · ${profile.lifestyle_group} 생활 장면`,
  };
}

export async function collectSafeCoupangCandidates(options = {}) {
  const date = options.date || kstDateKey();
  const count = Math.max(2, Number(options.count || DAILY_PRODUCT_SLOTS.length));
  const start = rotationStartIndex(date);
  // 두 건을 뽑기 위해 추가 후보 카테고리를 조회하되, 일일 5회 이내로 제한한다.
  const profiles = Array.from({ length: Math.min(LIFESTYLE_CATEGORY_ROTATION.length, count + 3) }, (_, index) => (
    LIFESTYLE_CATEGORY_ROTATION[(start + index) % LIFESTYLE_CATEGORY_ROTATION.length]
  ));
  const candidates = [];
  const queryResults = [];

  for (const profile of profiles) {
    const result = await getCoupangPartnerBestProducts(profile.category_id, {
      limit: 5,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      fetchImpl: options.fetchImpl,
    });
    queryResults.push({
      lifestyle_group: profile.lifestyle_group,
      category_id: profile.category_id,
      category_name: profile.category_name,
      status: result.status,
      error: result.error || "",
      received: result.products.length,
      ranks_requested: "1-5",
    });
    for (const product of result.products) {
      const candidate = buildCoupangCandidate(product, profile);
      if (candidate) candidates.push(candidate);
    }
  }

  return { date, candidates, queryResults };
}

function collectProductHistory(root) {
  const history = [];
  const pushJson = (file) => {
    try {
      const value = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      history.push(...(Array.isArray(value) ? value : [value]));
    } catch { /* malformed operational files must not block the next safe draft */ }
  };
  const walk = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith(".json")) pushJson(fullPath);
    }
  };
  pushJson(`${root}/outputs/lifemagazine/meta-publish-log.json`);
  walk(`${root}/outputs/lifemagazine/automation`);
  return history;
}

function sortedProductHistory(history = []) {
  return [...history].sort((left, right) => String(right.published_at || right.created_at || right.draft_date || "").localeCompare(String(left.published_at || left.created_at || left.draft_date || "")));
}

function latestCategoryId(history = []) {
  const record = sortedProductHistory(history).find((item) => item?.product_metadata?.category_id || item?.category_id);
  return String(record?.product_metadata?.category_id || record?.category_id || "");
}

function latestLifestyleGroup(history = []) {
  const record = sortedProductHistory(history).find((item) => item?.product_metadata?.lifestyle_group || item?.lifestyle_group);
  return String(record?.product_metadata?.lifestyle_group || record?.lifestyle_group || "");
}

export function generateDailyProductDrafts(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date || kstDateKey();
  const manualCandidates = options.manualCandidates || loadManualProductQueue(date, { root });
  const automaticCandidates = options.candidates || [];
  const slots = Array.isArray(options.slots) && options.slots.length ? options.slots : DAILY_PRODUCT_SLOTS;
  const targetCount = Number(options.count || slots.length);
  const productHistory = options.productHistory || collectProductHistory(root);
  const recent = publishedProductKeysWithinDays(productHistory, date, 45);
  const selected = selectDailyProductCandidates([...manualCandidates, ...automaticCandidates], targetCount, {
    recentProductIds: recent.productIds,
    recentProductNames: recent.productNames,
    previousCategoryId: options.previousCategoryId || latestCategoryId(productHistory),
    previousLifestyleGroup: options.previousLifestyleGroup || latestLifestyleGroup(productHistory),
  });
  if (selected.length < targetCount) {
    throw new Error(`자동 발행 가능한 저위험 라이프매거진 상품 후보가 부족합니다. 필요=${targetCount}, 선별=${selected.length}`);
  }

  return selected.map((candidate, index) => {
    const slot = slots[index];
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
        product_id: candidate.product_id,
        category_id: candidate.category_id,
        category_name: candidate.category,
        category_rank: candidate.category_rank,
        lifestyle_group: candidate.lifestyle_group,
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
      count: options.count || (Array.isArray(options.slots) && options.slots.length ? options.slots.length : DAILY_PRODUCT_SLOTS.length),
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
  const remainingSlots = args.has("--remaining-today")
    ? DAILY_PRODUCT_SLOTS.filter((slot) => slot.time > kstClock())
    : undefined;
  if (args.has("--remaining-today") && !remainingSlots.length) {
    throw new Error("오늘 남은 라이프매거진 발행 슬롯이 없습니다.");
  }
  const result = await generateDailyProductDraftsAndPreview({
    date: targetDate,
    slots: remainingSlots,
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
