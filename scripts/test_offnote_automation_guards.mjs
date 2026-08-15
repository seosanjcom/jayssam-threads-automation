import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "offnote-guard-"));

function copyScript(name) {
  const target = path.join(tmp, "scripts", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "scripts", name), target);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function runNode(args, extra = {}) { return spawnSync("node", args, { cwd: tmp, encoding: "utf8", ...extra }); }

function assertOffnotePersonalRecord(draft) {
  if (draft.status !== "approved") throw new Error(`Expected auto-publish-ready offnote draft, got ${draft.status}`);
  if (draft.content_mode !== "digital_nomad_personal_note") throw new Error(`Expected personal-note mode, got ${draft.content_mode}`);
  if (!draft.threads_text || draft.threads_text.trim().length < 8 || draft.threads_text.length > 500) throw new Error(`Offnote record is outside Threads-safe length:\n${draft.threads_text}`);
  if (!draft.record_shape || !draft.subject_cluster || !draft.line_band || !draft.record_ending_family) throw new Error("Offnote record must declare shape, cluster, length band, and ending family.");
  if (!["daily_fact_input", "curated_evergreen_observation"].includes(draft.source_mode)) throw new Error(`Unexpected source mode: ${draft.source_mode}`);
  if (/인스타 같은 글에 댓글|카톡방|자료.*(?:받|공유|다운)|링크.*(?:댓글|프로필)|나처럼\s*해|성공담|망한\s*것|버텼(?:다|던)|불안/.test(draft.threads_text)) throw new Error(`Offnote draft contains CTA or banned anxiety/boast framing:\n${draft.threads_text}`);
  if (/결국\s*중요한\s*건|그래서\s*다시\s*한번\s*느꼈|프리랜서라면|디지털노마드에게/.test(draft.threads_text)) throw new Error(`Offnote draft returned to a polished lesson or generic conclusion:\n${draft.threads_text}`);
  if ((draft.thread_comments || []).length !== 0 || (draft.cardnews_slides || []).length !== 0) throw new Error("Offnote personal records must be text-first without promotional comments or cardnews.");
}

try {
  for (const name of ["generate_offnote_daily_post.mjs", "publish_offnote_due.mjs", "validate_offnote_draft.mjs", "offnote_evergreen_observations.json"]) copyScript(name);

  const firstGenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (firstGenerate.status !== 0) throw new Error(`initial generate guard failed:\n${firstGenerate.stderr}\n${firstGenerate.stdout}`);
  const generated = JSON.parse(firstGenerate.stdout);
  const draftPath = path.join(tmp, generated.draft);
  const firstDraft = readJson(draftPath);
  assertOffnotePersonalRecord(firstDraft);
  const valid = runNode(["scripts/validate_offnote_draft.mjs", draftPath]);
  if (valid.status !== 0) throw new Error(`Expected personal record to validate:\n${valid.stderr}\n${valid.stdout}`);

  const publishedDraft = { ...firstDraft, status: "published", published_at: "2026-05-23T08:29:48.793Z" };
  writeJson(draftPath, publishedDraft);
  const regenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (regenerate.status !== 0) throw new Error(`regenerate guard failed:\n${regenerate.stderr}\n${regenerate.stdout}`);
  if (readJson(draftPath).status !== "published" || fs.readFileSync(path.join(tmp, "outputs", "afterwork-profit", "preview-created.txt"), "utf8").trim() !== "false") throw new Error("Existing published draft must not be regenerated.");

  const contentIds = new Set();
  const shapes = new Map();
  const lineBands = new Map();
  const endings = new Map();
  const clusters = new Map();
  const allDrafts = [];
  for (let day = 1; day <= 21; day += 1) {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    for (const slot of ["evening", "night"]) {
      const result = runNode(["scripts/generate_offnote_daily_post.mjs", date, slot]);
      if (result.status !== 0) throw new Error(`record generation failed:\n${result.stderr}\n${result.stdout}`);
      const draft = readJson(path.join(tmp, JSON.parse(result.stdout).draft));
      assertOffnotePersonalRecord(draft);
      const validation = runNode(["scripts/validate_offnote_draft.mjs", path.join(tmp, JSON.parse(result.stdout).draft)]);
      if (validation.status !== 0) throw new Error(`record validation failed:\n${validation.stderr}\n${validation.stdout}`);
      if (contentIds.has(draft.content_id)) throw new Error(`21-day content dedupe failed for ${draft.content_id}`);
      contentIds.add(draft.content_id); allDrafts.push(draft);
      for (const [map, value] of [[shapes, draft.record_shape], [lineBands, draft.line_band], [endings, draft.record_ending_family], [clusters, draft.subject_cluster]]) map.set(value, (map.get(value) || 0) + 1);
    }
  }
  if (contentIds.size !== 42) throw new Error(`Expected 42 distinct Offnote records, got ${contentIds.size}`);
  if (shapes.size < 4) throw new Error(`Expected four varied record shapes, got ${[...shapes.keys()].join(", ")}`);
  if (lineBands.size < 4) throw new Error(`Expected four length bands, got ${[...lineBands.keys()].join(", ")}`);
  if (endings.size < 4) throw new Error(`Expected at least four ending families, got ${[...endings.keys()].join(", ")}`);
  if (Math.max(...clusters.values()) > 8) throw new Error(`Subject cluster became too narrow: ${JSON.stringify(Object.fromEntries(clusters))}`);
  if (Math.max(...endings.values()) > 21) throw new Error(`Ending-family distribution became too narrow: ${JSON.stringify(Object.fromEntries(endings))}`);

  const actualFactPath = path.join(tmp, "outputs", "afterwork-profit", "offnote-daily-facts", "2026-07-01.json");
  writeJson(actualFactPath, [{ id: "actual-build-log", title: "배포 로그", shape: "status", tag: "개발일상", text: "배포 눌렀는데\n로그 하나가 아직 빨강\n다시 봄", subject_cluster: "development", ending_family: "fragment" }]);
  const actualResult = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-07-01", "evening"]);
  if (actualResult.status !== 0) throw new Error(`actual fact generation failed:\n${actualResult.stderr}`);
  const actualDraft = readJson(path.join(tmp, JSON.parse(actualResult.stdout).draft));
  if (actualDraft.source_mode !== "daily_fact_input" || actualDraft.content_id !== "actual-build-log") throw new Error("Verified daily fact was not preferred over evergreen observation.");

  const badTonePath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-bad-tone.json");
  writeJson(badTonePath, { id: "OFFNOTE-20260524-evening-bad-tone", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", threads_text: "불안해서 버텼던 시절 이야기를 해볼게. 나처럼 해. 자료는 카톡방에서 받아.", thread_comments: [], cardnews_slides: [] });
  const badToneValidate = runNode(["scripts/validate_offnote_draft.mjs", badTonePath]);
  if (badToneValidate.status === 0 || !badToneValidate.stderr.includes("banned")) throw new Error("Expected anxious/CTA tone validation failure.");

  const polishedDraftPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-polished.json");
  writeJson(polishedDraftPath, { id: "OFFNOTE-20260524-evening-polished", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", threads_text: "회의가 길어졌다.\n\n결국 중요한 건 소통이다.", thread_comments: [], cardnews_slides: [] });
  const polishedValidate = runNode(["scripts/validate_offnote_draft.mjs", polishedDraftPath]);
  if (polishedValidate.status === 0 || !polishedValidate.stderr.includes("polished")) throw new Error("Expected polished-conclusion validation failure.");

  const monotonePath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-monotone.json");
  writeJson(monotonePath, { id: "OFFNOTE-20260524-evening-monotone", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", source_mode: "curated_evergreen_observation", threads_text: "수정사항 또 옴\n답장 없음\n다시 보는 중", thread_comments: [], cardnews_slides: [] });
  const monotoneValidate = runNode(["scripts/validate_offnote_draft.mjs", monotonePath]);
  if (monotoneValidate.status === 0 || !monotoneValidate.stderr.includes("ending variation")) throw new Error("Expected repeated ending style validation failure.");

  const thinPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-thin.json");
  writeJson(thinPath, { id: "OFFNOTE-20260524-evening-thin", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", source_mode: "curated_evergreen_observation", threads_text: "오늘 일이 길었다", thread_comments: [], cardnews_slides: [] });
  const thinValidate = runNode(["scripts/validate_offnote_draft.mjs", thinPath]);
  if (thinValidate.status === 0 || !thinValidate.stderr.includes("thin abstract")) throw new Error("Expected thin abstract validation failure.");

  const publish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], { env: { ...process.env, OFFNOTE_TELEGRAM_BOT_TOKEN: "", OFFNOTE_TELEGRAM_CHAT_ID: "" } });
  if (publish.status !== 0 || !publish.stdout.includes("slot already published")) throw new Error(`Expected slot-specific already-published skip, got:\n${publish.stderr}\n${publish.stdout}`);
  console.log(JSON.stringify({ ok: true, guard: "offnote language DNA v2 generation and publish guards pass", shapes: Object.fromEntries(shapes), lineBands: Object.fromEntries(lineBands), endings: Object.fromEntries(endings), clusters: Object.fromEntries(clusters) }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
