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
function copyFile(relPath) {
  const target = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, relPath), target);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function runNode(args, extra = {}) { return spawnSync("node", args, { cwd: tmp, encoding: "utf8", ...extra }); }
function draftPathFrom(result, date = "2026-05-23", slot = "evening") {
  const folder = path.join(tmp, "outputs", "afterwork-profit", "automation", date);
  const files = fs.readdirSync(folder).filter((file) => file.includes(`-${slot}-`) && file.endsWith(".json"));
  return path.join(folder, files[0]);
}

function assertApprovedFactDraft(draft) {
  if (draft.status !== "approved") throw new Error(`Expected approved fact-backed draft, got ${draft.status}`);
  if (draft.content_mode !== "digital_nomad_personal_note") throw new Error(`Expected personal-note mode, got ${draft.content_mode}`);
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
  for (const name of ["offnote_schedule.mjs", "generate_offnote_daily_post.mjs", "publish_offnote_due.mjs", "threads_publish.mjs", "validate_offnote_draft.mjs", "prepare_offnote_daily_facts.mjs"]) copyScript(name);
  copyFile("scripts/offnote_evergreen_observations.json");

  const missing = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (missing.status !== 0) throw new Error(`evergreen observation generation failed:\n${missing.stderr}\n${missing.stdout}`);
  const autoPath = draftPathFrom(missing, "2026-05-23", "evening");
  const autoDraft = readJson(autoPath);
  assertApprovedFactDraft(autoDraft);
  if (!autoDraft.portfolio || !autoDraft.funnel_stage) throw new Error("Evergreen draft must preserve portfolio and funnel metadata.");
  const evergreen = readJson(path.join(tmp, "scripts", "offnote_evergreen_observations.json"));
  if (evergreen.length < 20) throw new Error(`Expected an expanded Offnote portfolio pool, got ${evergreen.length}`);
  const requiredPortfolios = ["blog_agency", "sns_agency", "website_build", "youtube_operation", "online_course", "naver_place_setup", "sponsorship_experience"];
  for (const portfolio of requiredPortfolios) {
    if (!evergreen.some((item) => item.portfolio === portfolio)) throw new Error(`Missing Offnote portfolio: ${portfolio}`);
  }
  if (new Set(evergreen.map((item) => item.id)).size !== evergreen.length) throw new Error("Offnote evergreen IDs must be unique.");

  prepareFacts("2026-05-24", [
    { id: "actual-deploy-log", title: "배포 로그", text: "배포 눌렀는데\n로그 하나가 아직 빨강\n다시 봄", tag: "개발일상", subject_cluster: "development", shape: "status", ending_family: "fragment" },
    { id: "actual-course-example", title: "강의 예시", text: "예시 하나 바꿨더니\n앞 슬라이드도 봐야 함", tag: "교육기획", subject_cluster: "education", shape: "memo", ending_family: "declarative" },
  ]);
  const evening = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "evening"]);
  const night = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "night"]);
  if (evening.status !== 0 || night.status !== 0) throw new Error("Expected two fact-backed slots to generate.");
  const eveningDraft = readJson(draftPathFrom(evening, "2026-05-24", "evening"));
  const nightDraft = readJson(draftPathFrom(night, "2026-05-24", "night"));
  assertApprovedFactDraft(eveningDraft); assertApprovedFactDraft(nightDraft);
  if (eveningDraft.content_id === nightDraft.content_id) throw new Error("Two slots must select different daily fact IDs.");
  for (const draftPath of [draftPathFrom(evening, "2026-05-24", "evening"), draftPathFrom(night, "2026-05-24", "night")]) {
    const valid = runNode(["scripts/validate_offnote_draft.mjs", draftPath]);
    if (valid.status !== 0) throw new Error(`Expected fact-backed draft to validate:\n${valid.stderr}\n${valid.stdout}`);
  }

  console.log(JSON.stringify({ ok: true, guard: "offnote auto-fallback pipeline guards pass", test_drafts: [eveningDraft.id, nightDraft.id] }, null, 2));
} catch (error) {
  console.error("Offnote automation guards failed:", error);
  process.exit(1);
}
