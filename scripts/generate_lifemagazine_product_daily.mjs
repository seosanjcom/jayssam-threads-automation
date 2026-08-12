import fs from "node:fs";
import { pathToFileURL } from "node:url";

import { fixtureProductCandidates, selectDailyProductCandidates } from "./lifemagazine_product_candidates.mjs";
import { generateLifemagazineDraft, saveLifemagazineDraft } from "./generate_lifemagazine_draft.mjs";
import { loadManualProductQueue } from "./lifemagazine_telegram_product_queue.mjs";
import { sendLifemagazinePreview } from "./send_lifemagazine_preview_telegram.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";

export const DAILY_PRODUCT_SLOTS = [
  { slot: "morning", time: "11:30", label: "오전 생활템" },
  { slot: "afternoon", time: "16:30", label: "오후 정리템" },
  { slot: "night", time: "21:30", label: "밤 쟁여템" },
];

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

export function generateDailyProductDrafts(options = {}) {
  const root = options.root || process.cwd();
  const date = options.date || new Date().toISOString().slice(0, 10);
  const manualCandidates = options.manualCandidates || loadManualProductQueue(date, { root });
  const automaticCandidates = options.candidates || fixtureProductCandidates(date);
  const selected = selectDailyProductCandidates([...manualCandidates, ...automaticCandidates], 3);
  if (!selected.length) {
    throw new Error("확인 가능한 상품명과 링크가 있는 라이프매거진 상품 후보가 없습니다. 링크 정보를 다시 확인해 주세요.");
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
      operator_note: candidate.operator_note,
      scene_brief: candidate.scene_hint,
      target_reader: candidate.scene_hint,
      notes: candidate.description,
      product_metadata: {
        brand: candidate.brand,
        price: candidate.price,
        source_url: candidate.product_url || candidate.affiliate_url,
        metadata_status: candidate.metadata_status,
      },
      product_links: [{ label: "제품 링크", url: candidate.affiliate_url, platform: "affiliate" }],
    }, { now: options.now });
    const validation = validateLifemagazineDraft(draft);
    if (!validation.ok) throw new Error(`Invalid Lifemagazine product draft ${draft.id}: ${validation.errors.join("; ")}`);
    const savedPath = saveLifemagazineDraft(draft, { root });
    return { ...draft, saved_path: savedPath };
  });
}

export async function generateDailyProductDraftsAndPreview(options = {}) {
  const drafts = generateDailyProductDrafts(options);
  if (!options.sendPreview) return drafts;
  for (const draft of drafts) {
    await sendLifemagazinePreview(draft.saved_path, { root: options.root || process.cwd() });
  }
  return drafts;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  const args = new Set(process.argv.slice(2));
  const tomorrow = args.has("--tomorrow");
  const dateArg = process.argv.slice(2).find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  const targetDate = dateArg || (tomorrow
    ? new Date(Date.now() + 33 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : undefined);
  const drafts = await generateDailyProductDraftsAndPreview({
    date: targetDate,
    sendPreview: args.has("--send-preview"),
  });
  console.log(JSON.stringify({ ok: true, count: drafts.length, ids: drafts.map((draft) => draft.id) }, null, 2));
}
