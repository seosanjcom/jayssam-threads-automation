# Lifemagazine Coupang Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build approval-first `lifemagazine_` Threads automation that collects Coupang product candidates, generates natural product drafts, prepares phone-camera-style visual metadata, validates comment-based affiliate disclosure, and schedules three daily posts.

**Architecture:** Extend the existing Lifemagazine route instead of creating a parallel automation. Add focused modules for product candidates, visual policy, and product-daily draft generation, then wire them into the existing draft generator, validator, tests, and GitHub workflow.

**Tech Stack:** Node.js ESM, Node built-in `node:test`, GitHub Actions, existing Threads publishing scripts, optional Coupang API credentials supplied through environment variables.

## Global Constraints

- Account is exactly `lifemagazine_`.
- Product links must put the Coupang Partners disclosure in `thread_comments`, not at the top of `threads_text`.
- Required disclosure text is exactly: `이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`
- Main post must not contain raw affiliate links.
- Do not falsely claim direct usage unless `usage_status` is `actual_used`.
- Default visual strategy is casual phone-camera-style lifestyle image metadata from safe product references.
- Generated image prompts must forbid hands, fingers, arms, faces, readable text, paper, receipts, books, labels, shipping boxes, screens, logos, price tags, QR codes, and discount badges.
- Raw Coupang webpage image scraping is out of scope.
- Start with Telegram approval-first publishing; do not enable fully automatic publish without approval.
- Update Lifemagazine daily target to three posts per day.

---

## File structure

- Create `scripts/lifemagazine_product_candidates.mjs`: normalizes Coupang/API/manual product candidates, ranks safe practical items, and provides deterministic fixture candidates when credentials are missing.
- Create `scripts/lifemagazine_visual_policy.mjs`: builds phone-camera-style visual prompts and validates generated visual metadata against AI-artifact guardrails.
- Create `scripts/generate_lifemagazine_product_daily.mjs`: selects three product candidates for a date/slots and saves approval-ready Lifemagazine drafts.
- Modify `scripts/generate_lifemagazine_draft.mjs`: add product-scene copy path, exact comment disclosure, visual metadata fields, `usage_status`, and no top-of-body disclosure for product drafts.
- Modify `scripts/validate_lifemagazine_draft.mjs`: allow disclosure in comments, reject links in body, enforce exact Coupang disclosure, enforce usage and visual guardrails.
- Modify `scripts/test_lifemagazine_draft.mjs`: add tests covering product candidates, lifestyle visual policy, comment disclosure, three daily product drafts, and schedule.
- Modify `config/threads-accounts.json`: set Lifemagazine `dailyPostLimit` to `3`, `minIntervalHours` to `3`, and slots to `11:30 KST`, `16:30 KST`, `21:30 KST`.
- Modify `.github/workflows/lifemagazine-threads-automation.yml`: set publish schedule to three KST slots and env daily limit/min interval to match config.
- Keep `package.json` unchanged because the existing `npm test` script already runs `scripts/test_lifemagazine_draft.mjs`.

---

### Task 1: Product candidate normalization and ranking

**Files:**
- Create: `scripts/lifemagazine_product_candidates.mjs`
- Modify: `scripts/test_lifemagazine_draft.mjs`

**Interfaces:**
- Produces: `COUPANG_DISCLOSURE: string`
- Produces: `normalizeProductCandidate(input: object, options?: object): object`
- Produces: `rankProductCandidates(candidates: object[]): object[]`
- Produces: `fixtureProductCandidates(date?: string): object[]`
- Produces: `selectDailyProductCandidates(candidates: object[], count?: number): object[]`

- [ ] **Step 1: Add failing product candidate tests**

Append these tests to `scripts/test_lifemagazine_draft.mjs` and import the functions from `./lifemagazine_product_candidates.mjs`:

```js
import {
  COUPANG_DISCLOSURE,
  fixtureProductCandidates,
  normalizeProductCandidate,
  rankProductCandidates,
  selectDailyProductCandidates,
} from "./lifemagazine_product_candidates.mjs";
```

```js
test("lifemagazine product candidates normalize Coupang API fields", () => {
  const candidate = normalizeProductCandidate({
    productId: 123,
    productName: "대용량 머리끈 100개",
    categoryName: "헤어소품",
    productPrice: 8900,
    productUrl: "https://www.coupang.com/vp/products/123",
    affiliateUrl: "https://link.coupang.com/a/hair",
    productImage: "https://image.coupangcdn.com/image/vendor_inventory/hair.jpg",
    rating: 4.7,
    reviewCount: 812,
  }, { collectedAt: "2026-08-02T00:00:00.000Z" });

  assert.equal(candidate.source, "coupang_api");
  assert.equal(candidate.product_id, "123");
  assert.equal(candidate.product_name, "대용량 머리끈 100개");
  assert.equal(candidate.category, "헤어소품");
  assert.equal(candidate.price, 8900);
  assert.equal(candidate.affiliate_url, "https://link.coupang.com/a/hair");
  assert.equal(candidate.image_url, "https://image.coupangcdn.com/image/vendor_inventory/hair.jpg");
  assert.equal(candidate.usage_status, "not_confirmed");
  assert.equal(candidate.collected_at, "2026-08-02T00:00:00.000Z");
});

test("lifemagazine candidate ranking favors practical low-risk products", () => {
  const ranked = rankProductCandidates([
    normalizeProductCandidate({ productName: "비타민 영양제", categoryName: "건강", reviewCount: 9999, affiliateUrl: "https://link.coupang.com/a/vitamin" }),
    normalizeProductCandidate({ productName: "대용량 머리끈", categoryName: "헤어소품", reviewCount: 400, affiliateUrl: "https://link.coupang.com/a/hair" }),
    normalizeProductCandidate({ productName: "케이블 정리 클립", categoryName: "생활용품", reviewCount: 250, affiliateUrl: "https://link.coupang.com/a/cable" }),
  ]);

  assert.equal(ranked[0].product_name, "대용량 머리끈");
  assert.equal(ranked[0].risk_level, "low");
  assert.equal(ranked.at(-1).risk_level, "hold");
});

test("lifemagazine daily product selector returns three distinct products", () => {
  const selected = selectDailyProductCandidates(fixtureProductCandidates("2026-08-02"), 3);

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((item) => item.product_name)).size, 3);
  assert.ok(selected.every((item) => item.affiliate_url.startsWith("https://link.coupang.com/")));
  assert.equal(COUPANG_DISCLOSURE, "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because `scripts/lifemagazine_product_candidates.mjs` does not exist.

- [ ] **Step 3: Implement product candidate module**

Create `scripts/lifemagazine_product_candidates.mjs`:

```js
export const COUPANG_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

const LOW_RISK_KEYWORDS = [
  "머리끈", "수납", "정리", "파우치", "케이블", "클립", "청소포", "행주", "욕실", "주방", "립밤", "거치대", "트레이",
];

const HOLD_KEYWORDS = [
  "영양제", "비타민", "다이어트", "의료", "혈당", "관절", "탈모", "투자", "보험", "전기장판", "온열", "칼", "가위",
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
  return {
    source: firstText(input.source, "coupang_api"),
    product_id: firstText(input.product_id, input.productId, input.itemId, input.id),
    product_name: productName,
    category,
    price: firstNumber(input.price, input.productPrice, input.salePrice),
    rating: firstNumber(input.rating, input.productRating),
    review_count: firstNumber(input.review_count, input.reviewCount, input.review_count_text),
    product_url: firstText(input.product_url, input.productUrl, input.url),
    affiliate_url: firstText(input.affiliate_url, input.affiliateUrl, input.shortUrl),
    image_url: firstText(input.image_url, input.productImage, input.imageUrl, input.thumbnail),
    collected_at: options.collectedAt || input.collected_at || new Date().toISOString(),
    selection_reason: firstText(input.selection_reason, sceneHintFor(text)),
    scene_hint: firstText(input.scene_hint, sceneHintFor(text)),
    usage_status: input.usage_status === "actual_used" ? "actual_used" : "not_confirmed",
    risk_level: riskLevel,
    score: (riskLevel === "low" ? 100 : riskLevel === "medium" ? 50 : -100) + Math.min(firstNumber(input.review_count, input.reviewCount) / 20, 30),
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
  const seenCategories = new Set();
  for (const candidate of rankProductCandidates(candidates)) {
    if (candidate.risk_level === "hold") continue;
    if (seenCategories.has(candidate.category) && selected.length < count - 1) continue;
    selected.push(candidate);
    seenCategories.add(candidate.category);
    if (selected.length === count) break;
  }
  return selected;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS for the new candidate tests; older tests may fail later because disclosure behavior has not yet been changed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lifemagazine_product_candidates.mjs scripts/test_lifemagazine_draft.mjs
git commit -m "feat: add lifemagazine product candidates"
```

---

### Task 2: Lifestyle visual policy metadata

**Files:**
- Create: `scripts/lifemagazine_visual_policy.mjs`
- Modify: `scripts/test_lifemagazine_draft.mjs`

**Interfaces:**
- Consumes: candidate objects from Task 1.
- Produces: `VISUAL_AVOID_LIST: string[]`
- Produces: `buildLifestyleVisualPlan(candidate: object, options?: object): object`
- Produces: `validateVisualPlan(plan: object): { ok: boolean, errors: string[] }`

- [ ] **Step 1: Add failing visual policy tests**

Append imports:

```js
import {
  VISUAL_AVOID_LIST,
  buildLifestyleVisualPlan,
  validateVisualPlan,
} from "./lifemagazine_visual_policy.mjs";
```

Append tests:

```js
test("lifemagazine visual plan forbids AI-looking artifacts", () => {
  const candidate = normalizeProductCandidate({
    productName: "대용량 머리끈",
    categoryName: "헤어소품",
    affiliateUrl: "https://link.coupang.com/a/hair",
    productImage: "https://example.com/hair.jpg",
  });
  const plan = buildLifestyleVisualPlan(candidate, { surface: "desk" });

  assert.equal(plan.visual_mode, "ai_lifestyle_reference");
  assert.match(plan.visual_prompt, /phone-camera|desk|natural daylight/i);
  assert.ok(plan.visual_avoid_list.includes("hands"));
  assert.ok(plan.visual_avoid_list.includes("readable text"));
  assert.ok(plan.visual_avoid_list.includes("receipts"));
  assert.equal(validateVisualPlan(plan).ok, true);
});

test("lifemagazine visual validation rejects hands and text in prompts", () => {
  const result = validateVisualPlan({
    visual_mode: "ai_lifestyle_reference",
    visual_prompt: "phone photo with hands holding a receipt with Korean text",
    visual_avoid_list: [],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("hands")));
  assert.ok(result.errors.some((error) => error.includes("readable text")));
});

test("lifemagazine visual plan uses API image for exact packaging products", () => {
  const candidate = normalizeProductCandidate({
    productName: "브랜드 쿠션 파운데이션",
    categoryName: "화장품",
    affiliateUrl: "https://link.coupang.com/a/cushion",
    productImage: "https://example.com/cushion.jpg",
  });
  const plan = buildLifestyleVisualPlan(candidate);

  assert.equal(plan.visual_mode, "api_product_image");
  assert.equal(plan.media_urls[0], "https://example.com/cushion.jpg");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because `scripts/lifemagazine_visual_policy.mjs` does not exist.

- [ ] **Step 3: Implement visual policy module**

Create `scripts/lifemagazine_visual_policy.mjs`:

```js
export const VISUAL_AVOID_LIST = [
  "hands",
  "fingers",
  "arms",
  "faces",
  "body parts",
  "paper",
  "receipts",
  "books",
  "notebooks",
  "sticky notes",
  "labels",
  "shipping boxes",
  "screens",
  "readable text",
  "Korean text",
  "English text",
  "numbers",
  "QR codes",
  "price tags",
  "discount badges",
  "logos",
  "brand marks",
  "mirrors",
  "reflective surfaces",
];

const EXACT_APPEARANCE_KEYWORDS = ["쿠션", "파운데이션", "컨실러", "립스틱", "가전", "전자", "브랜드", "캐릭터"];

function needsExactImage(candidate) {
  const text = `${candidate.product_name || ""} ${candidate.category || ""}`;
  return EXACT_APPEARANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function surfaceFor(candidate, requestedSurface) {
  if (requestedSurface) return requestedSurface;
  const text = `${candidate.product_name || ""} ${candidate.category || ""}`;
  if (text.includes("욕실")) return "bathroom shelf";
  if (text.includes("주방") || text.includes("행주")) return "kitchen counter";
  if (text.includes("파우치")) return "desk beside a plain pouch";
  return "desk";
}

export function buildLifestyleVisualPlan(candidate = {}, options = {}) {
  if (needsExactImage(candidate) && candidate.image_url) {
    return {
      visual_mode: "api_product_image",
      visual_prompt: "",
      visual_avoid_list: [...VISUAL_AVOID_LIST],
      visual_review_status: "pending",
      media_urls: [candidate.image_url],
    };
  }

  const surface = surfaceFor(candidate, options.surface);
  const prompt = [
    `Realistic casual phone-camera photo of ${candidate.product_name || "a practical daily-use product"} on an ordinary Korean home ${surface}.`,
    "Slightly imperfect quick snapshot, not centered, natural daylight, mild grain, normal shadows.",
    "Small safe clutter only: plain charging cable, unbranded lip balm, simple pouch, neutral tray, or folded cloth with no writing.",
    "No text overlays, no promotional layout, no studio lighting, no influencer flat lay.",
    `Avoid: ${VISUAL_AVOID_LIST.join(", ")}.`,
  ].join(" ");

  return {
    visual_mode: "ai_lifestyle_reference",
    visual_prompt: prompt,
    visual_avoid_list: [...VISUAL_AVOID_LIST],
    visual_review_status: "pending",
    media_urls: [],
  };
}

export function validateVisualPlan(plan = {}) {
  const errors = [];
  const prompt = String(plan.visual_prompt || "").toLowerCase();
  const avoid = Array.isArray(plan.visual_avoid_list) ? plan.visual_avoid_list.map((item) => String(item).toLowerCase()) : [];
  if (!plan.visual_mode) errors.push("visual_mode is required.");
  if (plan.visual_mode === "ai_lifestyle_reference" && !prompt) errors.push("visual_prompt is required for ai_lifestyle_reference.");
  if (plan.visual_mode === "ai_lifestyle_reference") {
    for (const required of ["hands", "readable text", "receipts", "logos", "price tags"]) {
      if (!avoid.includes(required)) errors.push(`visual_avoid_list must include ${required}.`);
    }
    if (/\bwith hands\b|holding|receipt|korean text|readable text/.test(prompt) && !/avoid:/.test(prompt)) {
      errors.push("visual_prompt appears to request hands or readable text.");
    }
    if (/\bwith hands\b|holding/.test(prompt)) errors.push("visual_prompt must not include hands.");
    if (/receipt|korean text|readable text/.test(prompt) && !prompt.includes("avoid:")) errors.push("visual_prompt must not include readable text.");
  }
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: Visual tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lifemagazine_visual_policy.mjs scripts/test_lifemagazine_draft.mjs
git commit -m "feat: add lifemagazine lifestyle visual policy"
```

---

### Task 3: Product-scene draft generation and validation

**Files:**
- Modify: `scripts/generate_lifemagazine_draft.mjs`
- Modify: `scripts/validate_lifemagazine_draft.mjs`
- Modify: `scripts/test_lifemagazine_draft.mjs`

**Interfaces:**
- Consumes: `COUPANG_DISCLOSURE` from Task 1.
- Consumes: `buildLifestyleVisualPlan(candidate)` and `validateVisualPlan(plan)` from Task 2.
- Produces: Product drafts with `content_mode`, `scene_brief`, `target_reader`, `usage_status`, `visual_mode`, `visual_prompt`, `visual_avoid_list`, `visual_review_status`, comment disclosure, and no disclosure prefix in `threads_text`.

- [ ] **Step 1: Add failing product draft tests**

Append tests:

```js
test("product-scene lifemagazine draft keeps disclosure in comment, not body", () => {
  const candidate = normalizeProductCandidate({
    productName: "대용량 머리끈 100개",
    categoryName: "헤어소품",
    affiliateUrl: "https://link.coupang.com/a/hair",
    productImage: "https://example.com/hair.jpg",
    reviewCount: 812,
  });
  const draft = generateLifemagazineDraft({
    date: "2026-08-02",
    slot: "morning",
    topic: "머리끈 쟁여템",
    content_mode: "found_product",
    product_candidate: candidate,
    product_links: [{ label: "제품 링크", url: candidate.affiliate_url, platform: "coupang" }],
  }, { now: "2026-08-02T00:00:00.000Z" });

  assert.equal(draft.content_mode, "found_product");
  assert.equal(draft.usage_status, "not_confirmed");
  assert.doesNotMatch(draft.threads_text, /^\[제휴 링크 포함\]/);
  assert.doesNotMatch(draft.threads_text, /https?:\/\//);
  assert.match(draft.threads_text, /머리끈|잃어버리는|쟁여/);
  assert.match(draft.thread_comments.join("\n"), /https:\/\/link\.coupang\.com\/a\/hair/);
  assert.match(draft.thread_comments.join("\n"), new RegExp(COUPANG_DISCLOSURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(draft.visual_mode, "ai_lifestyle_reference");
  assert.equal(validateLifemagazineDraft(draft).ok, true);
});

test("validator rejects affiliate links in main lifemagazine body", () => {
  const draft = generateLifemagazineDraft({
    topic: "본문 링크 금지",
    content_mode: "found_product",
    product_links: [{ label: "제품 링크", url: "https://link.coupang.com/a/item", platform: "coupang" }],
  });
  draft.threads_text += "\nhttps://link.coupang.com/a/item";

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("main body")));
});

test("validator rejects direct-use claims without actual_used usage status", () => {
  const draft = generateLifemagazineDraft({
    topic: "써본척 금지",
    content_mode: "found_product",
    product_links: [{ label: "제품 링크", url: "https://link.coupang.com/a/item", platform: "coupang" }],
  });
  draft.threads_text = "나 이거 직접 써봤는데 생각보다 괜찮아서 올림. 매일 쓰는 사람은 볼 만함.";
  draft.usage_status = "not_confirmed";

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("actual_used")));
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because existing generator still prefixes disclosure in `threads_text` and lacks product-scene fields.

- [ ] **Step 3: Modify generator imports and disclosure helpers**

At the top of `scripts/generate_lifemagazine_draft.mjs`, add:

```js
import { COUPANG_DISCLOSURE } from "./lifemagazine_product_candidates.mjs";
import { buildLifestyleVisualPlan } from "./lifemagazine_visual_policy.mjs";
```

Change `disclosureFor(productLinks)` to:

```js
function disclosureFor(productLinks, input = {}) {
  if (input.content_mode === "found_product" || input.content_mode === "recommendation" || input.affiliate_disclosure_location === "reply") {
    return "";
  }
  return productLinks.length ? "[제휴 링크 포함]\n\n" : "";
}
```

Update `buildThreadsText(input, productLinks)` to pass `input` into `disclosureFor(productLinks, input)`.

- [ ] **Step 4: Add product-scene copy helpers**

Add helper functions before `buildThreadsText`:

```js
function productSceneLines(input) {
  const candidate = input.product_candidate || {};
  const name = String(input.product_name || candidate.product_name || input.topic || "이거").trim();
  const scene = String(input.scene_brief || candidate.scene_hint || candidate.selection_reason || "").trim();
  if (/머리끈/.test(name + scene)) {
    return [
      "머리끈 맨날 잃어버리는 사람 나와봐..",
      "분명 어제 손목에 있었는데 아침엔 또 없음ㅋㅋ",
      "이런 건 예쁜 거 하나보다 그냥 대용량으로 집에 두는 쪽이 마음 편하더라.",
      "자주 묶는 사람은 이런 소모템 떨어지는 순간이 제일 귀찮아서, 쟁여두기용으로 볼 만함.",
    ];
  }
  if (/케이블|충전/.test(name + scene)) {
    return [
      "책상 위 충전선 자꾸 굴러다니는 사람 있지..",
      "나도 작은 거 하나만 늘어도 갑자기 정신없어 보여서 이런 정리템 먼저 보게 됨.",
      "대단한 물건은 아닌데 매일 보이는 자리에는 이런 게 은근 차이 나더라.",
      "깔끔한 척하고 싶을 때보다 찾기 쉽게 두고 싶을 때 더 괜찮은 쪽.",
    ];
  }
  if (/파우치|가방/.test(name + scene)) {
    return [
      "가방 안에서 립밤이랑 머리끈 맨날 사라지는 사람 나만 그런 거 아니지..",
      "작은 거 찾느라 가방 뒤지는 시간이 제일 별거 아닌데 제일 귀찮음ㅋㅋ",
      "이런 건 예쁜 것보다 손이 자주 가는지가 더 중요한 것 같아.",
      "자주 들고 다니는 사람은 가방 정리용으로 한 번 볼 만함.",
    ];
  }
  return [
    `${scene || "생활 속에서 은근 자주 쓰는 거"} 찾는 사람은 이거 한 번 볼 만해.`,
    "엄청 대단한 제품이라기보다, 없으면 계속 불편한 쪽에 가까움.",
    "예쁜데 손 안 가는 것보다 매일 쓰면 그게 진짜 잘 산 템이지.",
    "나는 이런 건 생활패턴이랑 맞는지가 제일 중요하다고 봄.",
  ];
}
```

At the start of `buildThreadsText(input, productLinks)`, add:

```js
if (input.content_mode === "found_product" || input.content_mode === "recommendation") {
  return productSceneLines(input).join("\n");
}
```

- [ ] **Step 5: Update comments for exact Coupang disclosure**

In `buildComments(input, productLinks)`, before the existing relationship-specific branches, add:

```js
if ((input.content_mode === "found_product" || input.content_mode === "recommendation") && productLinks.length) {
  comments.push([
    "제품 링크는 여기 둘게!",
    ...productLinks.map((item) => `${item.label || "제품 링크"}: ${item.url || item}`),
    "",
    COUPANG_DISCLOSURE,
  ].join("\n"));
  return comments;
}
```

- [ ] **Step 6: Add draft metadata fields**

Inside the object returned by `generateLifemagazineDraft`, compute before `return`:

```js
const productCandidate = input.product_candidate || {};
const visualPlan = input.visual_plan || buildLifestyleVisualPlan(productCandidate);
```

Then add these fields to the returned draft object:

```js
content_mode: input.content_mode || "",
scene_brief: input.scene_brief || productCandidate.scene_hint || productCandidate.selection_reason || "",
target_reader: input.target_reader || productCandidate.scene_hint || "",
usage_status: input.usage_status || productCandidate.usage_status || "not_confirmed",
visual_mode: input.visual_mode || visualPlan.visual_mode || "text_only",
visual_prompt: input.visual_prompt || visualPlan.visual_prompt || "",
visual_avoid_list: input.visual_avoid_list || visualPlan.visual_avoid_list || [],
visual_review_status: input.visual_review_status || visualPlan.visual_review_status || "pending",
```

If `input.media_urls` is empty and `visualPlan.media_urls` exists, set `media_urls` to `visualPlan.media_urls`.

- [ ] **Step 7: Update validator disclosure and guardrails**

In `scripts/validate_lifemagazine_draft.mjs`, import:

```js
import { COUPANG_DISCLOSURE } from "./lifemagazine_product_candidates.mjs";
import { validateVisualPlan } from "./lifemagazine_visual_policy.mjs";
```

Replace `hasDisclosure` and `bodyStartsWithDisclosure` checks with:

```js
function commentsText(draft) {
  return (draft.thread_comments || []).join("\n");
}

function hasExactCoupangDisclosureInComments(draft) {
  return commentsText(draft).includes(COUPANG_DISCLOSURE);
}

function bodyHasUrl(draft) {
  return /https?:\/\//.test(String(draft.threads_text || ""));
}

function claimsDirectUse(draft) {
  return /직접\s*써봤|써봤는데|사용해봤|내가\s*써보니|내돈내산/.test(String(draft.threads_text || ""));
}
```

Replace the product-link validation block with:

```js
if (hasProductLinks(draft)) {
  if (!hasExactCoupangDisclosureInComments(draft)) {
    errors.push("exact Coupang affiliate disclosure is required in thread_comments when product_links exist.");
  }
  if (bodyHasUrl(draft)) {
    errors.push("main body must not contain affiliate or raw URLs.");
  }
}

if (claimsDirectUse(draft) && draft.usage_status !== "actual_used") {
  errors.push("direct-use claims require usage_status actual_used.");
}

const visualResult = validateVisualPlan({
  visual_mode: draft.visual_mode,
  visual_prompt: draft.visual_prompt,
  visual_avoid_list: draft.visual_avoid_list,
});
if (!visualResult.ok && draft.visual_mode === "ai_lifestyle_reference") {
  errors.push(...visualResult.errors);
}
```

- [ ] **Step 8: Update older tests expecting body disclosure**

Adjust existing Lifemagazine tests that assert `draft.threads_text` starts with `[제휴 링크 포함]` only when they are not `content_mode: "found_product"`. Keep legacy celebrity/product confirmation tests passing by leaving their old behavior unchanged.

- [ ] **Step 9: Run tests**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add scripts/generate_lifemagazine_draft.mjs scripts/validate_lifemagazine_draft.mjs scripts/test_lifemagazine_draft.mjs
git commit -m "feat: generate lifemagazine product scene drafts"
```

---

### Task 4: Three daily product draft generator and schedule config

**Files:**
- Create: `scripts/generate_lifemagazine_product_daily.mjs`
- Modify: `scripts/test_lifemagazine_draft.mjs`
- Modify: `config/threads-accounts.json`
- Modify: `.github/workflows/lifemagazine-threads-automation.yml`

**Interfaces:**
- Consumes: `fixtureProductCandidates`, `selectDailyProductCandidates`.
- Consumes: `generateLifemagazineDraft`, `saveLifemagazineDraft`.
- Produces: `generateDailyProductDrafts(options?: object): object[]`

- [ ] **Step 1: Add failing tests for daily generation and config**

Append test:

```js
test("lifemagazine daily product generator creates three approval drafts", async () => {
  const { generateDailyProductDrafts } = await import("./generate_lifemagazine_product_daily.mjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-daily-products-"));

  const drafts = generateDailyProductDrafts({
    root: tmp,
    date: "2026-08-02",
    now: "2026-08-02T00:00:00.000Z",
    candidates: fixtureProductCandidates("2026-08-02"),
  });

  assert.equal(drafts.length, 3);
  assert.deepEqual(drafts.map((draft) => draft.recommended_publish_time), ["11:30 KST", "16:30 KST", "21:30 KST"]);
  assert.ok(drafts.every((draft) => draft.status === "ready_to_review"));
  assert.ok(drafts.every((draft) => validateLifemagazineDraft(draft).ok));
  assert.equal(fs.readdirSync(path.join(tmp, "outputs", "lifemagazine", "automation", "2026-08-02")).length, 3);
});
```

Append config test:

```js
test("lifemagazine config targets three daily product slots", () => {
  const config = JSON.parse(fs.readFileSync("config/threads-accounts.json", "utf8").replace(/^\uFEFF/, ""));
  const life = config.accounts.find((account) => account.accountKey === "lifemagazine");

  assert.equal(life.dailyPostLimit, 3);
  assert.equal(life.minIntervalHours, 3);
  assert.deepEqual(life.defaultSlots, ["11:30 KST", "16:30 KST", "21:30 KST"]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because daily generator does not exist and config still has daily limit `1`.

- [ ] **Step 3: Implement daily generator**

Create `scripts/generate_lifemagazine_product_daily.mjs`:

```js
import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { fixtureProductCandidates, selectDailyProductCandidates } from "./lifemagazine_product_candidates.mjs";
import { generateLifemagazineDraft, saveLifemagazineDraft } from "./generate_lifemagazine_draft.mjs";

export const DAILY_PRODUCT_SLOTS = [
  { slot: "morning", time: "11:30", label: "오전 생활템" },
  { slot: "afternoon", time: "16:30", label: "오후 정리템" },
  { slot: "night", time: "21:30", label: "밤 쟁여템" },
];

export function generateDailyProductDrafts(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date || new Date().toISOString().slice(0, 10);
  const candidates = options.candidates || fixtureProductCandidates(date);
  const selected = selectDailyProductCandidates(candidates, 3);
  if (selected.length < 3) {
    throw new Error(`Need 3 safe Lifemagazine product candidates, got ${selected.length}.`);
  }

  return selected.map((candidate, index) => {
    const slot = DAILY_PRODUCT_SLOTS[index];
    const draft = generateLifemagazineDraft({
      date,
      slot: slot.slot,
      custom_publish_time: slot.time,
      topic: `${slot.label}: ${candidate.product_name}`,
      content_mode: "found_product",
      product_candidate: candidate,
      product_name: candidate.product_name,
      scene_brief: candidate.scene_hint,
      target_reader: candidate.scene_hint,
      product_links: [{ label: "제품 링크", url: candidate.affiliate_url, platform: "coupang" }],
    }, { now: options.now });
    saveLifemagazineDraft(draft, { root });
    return draft;
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const inputPath = process.argv[2];
  const input = inputPath ? JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "")) : {};
  const drafts = generateDailyProductDrafts(input);
  console.log(JSON.stringify({ ok: true, count: drafts.length, ids: drafts.map((draft) => draft.id) }, null, 2));
}
```

- [ ] **Step 4: Update Lifemagazine config**

In `config/threads-accounts.json`, update only the Lifemagazine account:

```json
"dailyPostLimit": 3,
"minIntervalHours": 3,
"defaultSlots": ["11:30 KST", "16:30 KST", "21:30 KST"]
```

- [ ] **Step 5: Update workflow schedule and env**

In `.github/workflows/lifemagazine-threads-automation.yml`, update:

```yaml
- cron: "30 2,7,12 * * *"
```

This maps to 11:30, 16:30, and 21:30 KST.

Update env:

```yaml
THREADS_DAILY_POST_LIMIT: "3"
THREADS_MIN_INTERVAL_HOURS: "3"
```

Add syntax check in the Validate scripts step:

```bash
node --check scripts/generate_lifemagazine_product_daily.mjs
```

- [ ] **Step 6: Run tests**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_lifemagazine_product_daily.mjs scripts/test_lifemagazine_draft.mjs config/threads-accounts.json .github/workflows/lifemagazine-threads-automation.yml
git commit -m "feat: schedule lifemagazine product drafts three times daily"
```

---

### Task 5: Verification, dry run, and operator handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-08-02-lifemagazine-coupang-product-design.md` only if implementation reveals a necessary correction.

**Interfaces:**
- Consumes all tasks above.
- Produces verified branch ready for review or PR.

- [ ] **Step 1: Run full script syntax checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run a dry daily generation into a temp directory**

Run from PowerShell:

```powershell
$tmp = New-Item -ItemType Directory -Path ([System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "lifemagazine-dryrun-" + [System.Guid]::NewGuid().ToString("N")))
node -e "import('./scripts/generate_lifemagazine_product_daily.mjs').then(m => { const drafts = m.generateDailyProductDrafts({ root: process.argv[1], date: '2026-08-02', now: '2026-08-02T00:00:00.000Z' }); console.log(JSON.stringify(drafts.map(d => ({ id: d.id, time: d.recommended_publish_time, okText: !/^\\[제휴/.test(d.threads_text), visual: d.visual_mode })), null, 2)); })" $tmp.FullName
```

Expected: JSON with 3 drafts, times `11:30 KST`, `16:30 KST`, `21:30 KST`, `okText: true`, and `visual` set.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short --branch
```

Expected: clean working tree on the feature branch after all commits.

- [ ] **Step 5: Final handoff**

Report:

- Implemented modules.
- Tests run and results.
- Whether live Coupang credentials are still needed.
- That generated lifestyle images remain approval-first.
- Current branch name and commits.
