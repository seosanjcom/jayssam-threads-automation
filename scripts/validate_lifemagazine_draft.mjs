import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { COUPANG_DISCLOSURE } from "./lifemagazine_product_candidates.mjs";
import { validateVisualPlan } from "./lifemagazine_visual_policy.mjs";

const SAME_PRODUCT_PATTERNS = [
  /착용한 제품입니다/,
  /사용한 제품입니다/,
  /같은 제품입니다/,
  /동일 제품입니다/,
  /연예인.*추천/,
  /본인.*추천/,
];

function hasProductLinks(draft) {
  return Array.isArray(draft.product_links) && draft.product_links.length > 0;
}

function hasDisclosure(draft) {
  const text = `${draft.threads_text || ""}\n${(draft.thread_comments || []).join("\n")}`;
  return /제휴 링크|광고|수수료/.test(text);
}

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

function bodyStartsWithDisclosure(draft) {
  return /^\s*(?:\[제휴 링크 포함\]|\[광고\/제휴 링크 포함\]|제휴 링크 포함)/.test(String(draft.threads_text || ""));
}

export function validateLifemagazineDraft(draft) {
  const errors = [];
  const warnings = [];

  if (draft.account !== "lifemagazine_") errors.push("account must be lifemagazine_.");
  if (draft.project !== "lifemagazine") errors.push("project must be lifemagazine.");
  if (!draft.id) errors.push("id is required.");
  if (!draft.topic) errors.push("topic is required.");
  if (!draft.threads_text || String(draft.threads_text).trim().length < 40) {
    errors.push("threads_text is too short.");
  }

  if (hasProductLinks(draft) && draft.content_mode === "found_product") {
    if (!hasExactCoupangDisclosureInComments(draft)) {
      errors.push("exact Coupang affiliate disclosure is required in thread_comments when product_links exist.");
    }
    if (bodyHasUrl(draft)) {
      errors.push("main body must not contain affiliate or raw URLs.");
    }
  } else if (hasProductLinks(draft) && (!hasDisclosure(draft) || !bodyStartsWithDisclosure(draft))) {
    errors.push("affiliate disclosure is required at the beginning of threads_text when product_links exist.");
  }

  if (claimsDirectUse(draft) && draft.usage_status !== "actual_used") {
    errors.push("direct-use claims require usage_status actual_used.");
  }

  // 상품명(또는 주제)과 본문 텍스트 간 명백한 불일치(예: 복사용지인데 케이블 클립 설명)를 차단한다.
  const productName = String(draft.product_name || "").trim();
  const threadsText = String(draft.threads_text || "");
  if (/복사용지|a4|용지/.test(productName) && /케이블|충전선|정리\s*클립/.test(threadsText)) {
    errors.push("product_name (copy paper) conflicts with threads_text describing cable clips.");
  }
  if (/케이블|충전/.test(productName) && /복사용지|a4|용지/.test(threadsText)) {
    errors.push("product_name (cable) conflicts with threads_text describing copy paper.");
  }

  const visualResult = validateVisualPlan({
    visual_mode: draft.visual_mode,
    visual_prompt: draft.visual_prompt,
    visual_avoid_list: draft.visual_avoid_list,
  });
  if (!visualResult.ok && draft.visual_mode === "ai_lifestyle_reference") {
    errors.push(...visualResult.errors);
  }

  if (draft.product_relationship === "official_confirmed") {
    const hasSource =
      (Array.isArray(draft.source_urls) && draft.source_urls.length > 0) ||
      Boolean(String(draft.official_confirmation_source || "").trim()) ||
      Boolean(String(draft.notes || "").trim());
    if (!hasSource) {
      errors.push("official_confirmed drafts require notes, source_urls, or official_confirmation_source.");
    }
  }

  if (draft.product_relationship === "similar_mood" || draft.product_relationship === "strong_guess") {
    const allText = `${draft.threads_text || ""}\n${(draft.thread_comments || []).join("\n")}`;
    if (SAME_PRODUCT_PATTERNS.some((pattern) => pattern.test(allText))) {
      errors.push("same-product wording is not allowed for similar_mood or strong_guess drafts.");
    }
  }

  if (draft.product_relationship === "trend_only" && hasProductLinks(draft)) {
    warnings.push("trend_only draft has product links; confirm this should not be similar_mood.");
  }

  if (!Array.isArray(draft.thread_comments) || draft.thread_comments.length === 0) {
    warnings.push("thread_comments are recommended for source and link separation.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const draftPath = process.argv[2];
  if (!draftPath) {
    console.error("Usage: node scripts/validate_lifemagazine_draft.mjs DRAFT_JSON");
    process.exit(1);
  }
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8").replace(/^\uFEFF/, ""));
  const result = validateLifemagazineDraft(draft);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
