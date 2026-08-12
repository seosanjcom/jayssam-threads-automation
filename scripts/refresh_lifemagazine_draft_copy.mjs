import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generateLifemagazineDraft } from "./generate_lifemagazine_draft.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

export function refreshLifemagazineDraftCopy(draft) {
  const publishTime = String(draft.recommended_publish_time || "").replace(/\s*KST\s*$/, "").trim();
  const candidate = {
    product_name: draft.product_name,
    scene_hint: draft.scene_brief,
    selection_reason: draft.scene_brief,
    operator_note: draft.product_metadata?.coupang_api_candidate ? "쿠팡 파트너스 API 자동 선별" : "",
  };
  const refreshed = generateLifemagazineDraft({
    ...draft,
    date: draft.draft_date,
    slot: String(draft.id || "").split("-")[2] || "manual",
    custom_publish_time: publishTime,
    product_candidate: candidate,
    product_name: draft.product_name,
    scene_brief: draft.scene_brief,
    target_reader: draft.target_reader,
    product_metadata: draft.product_metadata,
    product_links: draft.product_links,
    notes: draft.notes,
    status: draft.status,
  }, { now: draft.created_at });

  return {
    ...refreshed,
    id: draft.id,
    created_at: draft.created_at,
    scheduled_publish_at: draft.scheduled_publish_at,
    status: draft.status,
    approval_source: draft.approval_source,
    auto_publish_allowed: draft.auto_publish_allowed,
    media_urls: draft.media_urls,
    local_media_paths: draft.local_media_paths,
    visual_mode: draft.visual_mode,
    visual_prompt: draft.visual_prompt,
    visual_avoid_list: draft.visual_avoid_list,
    visual_review_status: draft.visual_review_status,
    telegram_approval_token: draft.telegram_approval_token,
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const draftPath = process.argv[2];
  if (!draftPath) throw new Error("Usage: node scripts/refresh_lifemagazine_draft_copy.mjs <draft-json-path>");
  const original = readJson(draftPath);
  const refreshed = refreshLifemagazineDraftCopy(original);
  const validation = validateLifemagazineDraft(refreshed);
  if (!validation.ok) throw new Error(`Refreshed draft is invalid: ${validation.errors.join("; ")}`);
  fs.writeFileSync(draftPath, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, draft: path.normalize(draftPath), id: refreshed.id }, null, 2));
}
