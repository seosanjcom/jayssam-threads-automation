import fs from "node:fs";
import { pathToFileURL } from "node:url";

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

  if (hasProductLinks(draft) && (!hasDisclosure(draft) || !bodyStartsWithDisclosure(draft))) {
    errors.push("affiliate disclosure is required at the beginning of threads_text when product_links exist.");
  }

  if (draft.product_relationship === "official_confirmed") {
    const hasSource =
      (Array.isArray(draft.source_urls) && draft.source_urls.length > 0) ||
      Boolean(String(draft.official_confirmation_source || "").trim());
    if (!hasSource) {
      errors.push("official_confirmed drafts require source_urls or official_confirmation_source.");
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
