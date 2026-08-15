import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "offnote-fact-pipeline-"));

function copyScript(name) {
  const target = path.join(tmp, "scripts", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "scripts", name), target);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function runNode(args, extra = {}) { return spawnSync("node", args, { cwd: tmp, encoding: "utf8", ...extra }); }
function draftPathFrom(result) { return path.join(tmp, JSON.parse(result.stdout).draft); }

function assertApprovedFactDraft(draft) {
  if (draft.status !== "approved") throw new Error(`Expected approved fact-backed draft, got ${draft.status}`);
  if (draft.content_mode !== "digital_nomad_personal_note") throw new Error(`Expected personal-note mode, got ${draft.content_mode}`);
  if (draft.source_mode !== "daily_fact_input") throw new Error(`Expected daily_fact_input source, got ${draft.source_mode}`);
  if (!draft.threads_text || draft.threads_text.trim().length < 8 || draft.threads_text.length > 500) throw new Error(`Offnote record is outside Threads-safe length:\n${draft.threads_text}`);
  if (!draft.record_shape || !draft.subject_cluster || !draft.line_band || !draft.record_ending_family) throw new Error("Fact draft must declare shape, cluster, length band, and ending family.");
  if (/인스타 같은 글에 댓글|카톡방|자료.*(?:받|공유|다운)|링크.*(?:댓글|프로필)|나처럼\s*해|성공담|망한\s*것|버텼(?:다|던)|불안/.test(draft.threads_text)) throw new Error(`Offnote draft contains CTA or banned framing:\n${draft.threads_text}`);
  if (/결국\s*중요한\s*건|그래서\s*다시\s*한번\s*느꼈|프리랜서라면|디지털노마드에게/.test(draft.threads_text)) throw new Error(`Offnote draft returned to a polished conclusion:\n${draft.threads_text}`);
}

function prepareFacts(date, facts) {
  const input = path.join(tmp, `fact-input-${date}.json`);
  writeJson(input, { date, facts });
  const prepared = runNode(["scripts/prepare_offnote_daily_facts.mjs", date, input]);
  if (prepared.status !== 0) throw new Error(`daily fact preparation failed:\n${prepared.stderr}\n${prepared.stdout}`);
}

try {
  for (const name of ["generate_offnote_daily_post.mjs", "publish_offnote_due.mjs", "validate_offnote_draft.mjs", "prepare_offnote_daily_facts.mjs"]) copyScript(name);

  const missing = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (missing.status !== 0) throw new Error(`missing-detail hold creation failed:\n${missing.stderr}\n${missing.stdout}`);
  const heldPath = draftPathFrom(missing);
  const held = readJson(heldPath);
  if (held.status !== "held_missing_detail" || held.threads_text !== "") throw new Error("Missing daily facts must create an empty held_missing_detail record.");
  const heldValidation = runNode(["scripts/validate_offnote_draft.mjs", heldPath]);
  if (heldValidation.status !== 0 || !heldValidation.stdout.includes("held")) throw new Error(`Expected intentional hold to validate:\n${heldValidation.stderr}\n${heldValidation.stdout}`);
  const heldPublish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], { env: { ...process.env, OFFNOTE_TELEGRAM_BOT_TOKEN: "", OFFNOTE_TELEGRAM_CHAT_ID: "" } });
  if (heldPublish.status !== 0 || !heldPublish.stdout.includes("intentionally held")) throw new Error(`Expected intentional-hold publish skip:\n${heldPublish.stderr}\n${heldPublish.stdout}`);

  prepareFacts("2026-05-24", [
    { id: "actual-deploy-log", title: "배포 로그", text: "배포 눌렀는데\n로그 하나가 아직 빨강\n다시 봄", tag: "개발일상", subject_cluster: "development", shape: "status", ending_family: "fragment" },
    { id: "actual-course-example", title: "강의 예시", text: "예시 하나 바꿨더니\n앞 슬라이드도 봐야 함", tag: "교육기획", subject_cluster: "education", shape: "memo", ending_family: "declarative" },
  ]);
  const evening = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "evening"]);
  const night = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "night"]);
  if (evening.status !== 0 || night.status !== 0) throw new Error("Expected two fact-backed slots to generate.");
  const eveningDraft = readJson(draftPathFrom(evening));
  const nightDraft = readJson(draftPathFrom(night));
  assertApprovedFactDraft(eveningDraft); assertApprovedFactDraft(nightDraft);
  if (eveningDraft.content_id === nightDraft.content_id) throw new Error("Two slots must select different daily fact IDs.");
  for (const draftPath of [draftPathFrom(evening), draftPathFrom(night)]) {
    const valid = runNode(["scripts/validate_offnote_draft.mjs", draftPath]);
    if (valid.status !== 0) throw new Error(`Expected fact-backed draft to validate:\n${valid.stderr}\n${valid.stdout}`);
  }

  const publishedEvening = { ...eveningDraft, status: "published", published_at: "2026-05-24T08:29:48.793Z" };
  writeJson(draftPathFrom(evening), publishedEvening);
  const regenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "evening"]);
  if (regenerate.status !== 0 || fs.readFileSync(path.join(tmp, "outputs", "afterwork-profit", "preview-created.txt"), "utf8").trim() !== "false") throw new Error("Existing published fact-backed draft must not be regenerated.");

  const contentIds = new Set();
  const clusters = new Map();
  for (let day = 1; day <= 21; day += 1) {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    prepareFacts(date, [
      { id: `deploy-${day}`, title: "배포 로그", text: `배포 로그 ${day}\n빨간 줄 하나 남았고\n다시 열어봄`, tag: "개발일상", subject_cluster: day % 2 ? "development" : "automation", shape: "status", ending_family: day % 2 ? "fragment" : "observation" },
      { id: `course-${day}`, title: "강의 예시", text: `수강생 질문 ${day}\n예시 하나 바꾸고\n앞 슬라이드도 봄`, tag: "교육기획", subject_cluster: day % 2 ? "education" : "collaboration", shape: "memo", ending_family: day % 2 ? "declarative" : "complete" },
    ]);
    for (const slot of ["evening", "night"]) {
      const result = runNode(["scripts/generate_offnote_daily_post.mjs", date, slot]);
      if (result.status !== 0) throw new Error(`fact record generation failed:\n${result.stderr}\n${result.stdout}`);
      const draft = readJson(draftPathFrom(result));
      assertApprovedFactDraft(draft);
      if (contentIds.has(draft.content_id)) throw new Error(`21-day fact ID dedupe failed for ${draft.content_id}`);
      contentIds.add(draft.content_id);
      clusters.set(draft.subject_cluster, (clusters.get(draft.subject_cluster) || 0) + 1);
    }
  }
  if (contentIds.size !== 42) throw new Error(`Expected 42 distinct fact-backed records, got ${contentIds.size}`);
  if (clusters.size < 4) throw new Error(`Expected diversified fact clusters, got ${[...clusters.keys()].join(", ")}`);

  const badTonePath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-25", "OFFNOTE-20260525-evening-bad-tone.json");
  writeJson(badTonePath, { id: "OFFNOTE-20260525-evening-bad-tone", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", source_mode: "daily_fact_input", threads_text: "불안해서 버텼던 시절 이야기를 해볼게. 나처럼 해. 자료는 카톡방에서 받아.", thread_comments: [], cardnews_slides: [] });
  const badToneValidate = runNode(["scripts/validate_offnote_draft.mjs", badTonePath]);
  if (badToneValidate.status === 0 || !badToneValidate.stderr.includes("banned")) throw new Error("Expected anxious/CTA tone validation failure.");

  const thinPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-25", "OFFNOTE-20260525-evening-thin.json");
  writeJson(thinPath, { id: "OFFNOTE-20260525-evening-thin", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note", source_mode: "missing_daily_fact", threads_text: "오늘 일이 길었다", thread_comments: [], cardnews_slides: [] });
  const thinValidate = runNode(["scripts/validate_offnote_draft.mjs", thinPath]);
  if (thinValidate.status === 0 || !thinValidate.stderr.includes("thin abstract")) throw new Error("Expected thin abstract validation failure.");

  console.log(JSON.stringify({ ok: true, guard: "offnote daily-fact pipeline guards pass", fact_backed_records: contentIds.size, clusters: Object.fromEntries(clusters) }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
