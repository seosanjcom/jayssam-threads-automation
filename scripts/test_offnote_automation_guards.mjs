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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runNode(args, extra = {}) {
  return spawnSync("node", args, { cwd: tmp, encoding: "utf8", ...extra });
}

function assertOffnotePersonalNote(draft) {
  if (draft.status !== "approved") throw new Error(`Expected auto-publish-ready offnote draft, got ${draft.status}`);
  if (draft.content_mode !== "digital_nomad_personal_note") throw new Error(`Expected personal-note mode, got ${draft.content_mode}`);
  if (!draft.threads_text || draft.threads_text.length < 60 || draft.threads_text.length > 500) {
    throw new Error(`Offnote personal note is outside the Threads-safe length:\n${draft.threads_text}`);
  }
  if (/인스타 같은 글에 댓글|카톡방|자료.*(?:받|공유|다운)|링크.*(?:댓글|프로필)|나처럼\s*해|성공담|망한\s*것|버텼(?:다|던)|불안/.test(draft.threads_text)) {
    throw new Error(`Offnote draft contains CTA or banned anxiety/boast framing:\n${draft.threads_text}`);
  }
  if ((draft.thread_comments || []).length !== 0 || (draft.cardnews_slides || []).length !== 0) {
    throw new Error("Offnote personal notes must be text-first without promotional comments or cardnews.");
  }
}

try {
  for (const name of ["generate_offnote_daily_post.mjs", "publish_offnote_due.mjs", "validate_offnote_draft.mjs"]) copyScript(name);

  const firstGenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (firstGenerate.status !== 0) throw new Error(`initial generate guard failed:\n${firstGenerate.stderr}\n${firstGenerate.stdout}`);
  const generated = JSON.parse(firstGenerate.stdout);
  const draftPath = path.join(tmp, generated.draft);
  const firstDraft = readJson(draftPath);
  assertOffnotePersonalNote(firstDraft);

  const valid = runNode(["scripts/validate_offnote_draft.mjs", draftPath]);
  if (valid.status !== 0) throw new Error(`Expected personal note to validate:\n${valid.stderr}\n${valid.stdout}`);

  const publishedDraft = { ...firstDraft, status: "published", published_at: "2026-05-23T08:29:48.793Z" };
  writeJson(draftPath, publishedDraft);
  const regenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (regenerate.status !== 0) throw new Error(`regenerate guard failed:\n${regenerate.stderr}\n${regenerate.stdout}`);
  const afterGenerate = readJson(draftPath);
  if (afterGenerate.status !== "published" || afterGenerate.published_at !== publishedDraft.published_at) {
    throw new Error("Published draft was overwritten by generation.");
  }
  if (fs.readFileSync(path.join(tmp, "outputs", "afterwork-profit", "preview-created.txt"), "utf8").trim() !== "false") {
    throw new Error("Existing published draft must not be regenerated.");
  }

  const contentIds = new Set();
  for (let day = 1; day <= 21; day += 1) {
    const date = `2026-06-${String(day).padStart(2, "0")}`;
    for (const slot of ["evening", "night"]) {
      const result = runNode(["scripts/generate_offnote_daily_post.mjs", date, slot]);
      if (result.status !== 0) throw new Error(`personal-note generation failed:\n${result.stderr}\n${result.stdout}`);
      const draft = readJson(path.join(tmp, JSON.parse(result.stdout).draft));
      assertOffnotePersonalNote(draft);
      const paragraphs = draft.threads_text.split("\n\n");
      if (paragraphs.length !== 3 || paragraphs.some((paragraph) => paragraph.trim().length < 15)) {
        throw new Error(`Offnote draft must keep scene → choice → judgment structure:\n${draft.threads_text}`);
      }
      if (/오늘도\s*내\s*리듬|오래\s*가는\s*방식|일하는\s*하루가\s*꽤\s*편해진다/.test(draft.threads_text)) {
        throw new Error(`Offnote draft returned to a generic abstract ending:\n${draft.threads_text}`);
      }
      if (contentIds.has(draft.content_id)) throw new Error(`21-day content dedupe failed for ${draft.content_id}`);
      contentIds.add(draft.content_id);
    }
  }
  if (contentIds.size !== 42) throw new Error(`Expected 42 distinct Offnote scenes, got ${contentIds.size}`);

  const badTonePath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-bad-tone.json");
  writeJson(badTonePath, {
    id: "OFFNOTE-20260524-evening-bad-tone", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note",
    threads_text: "불안해서 버텼던 시절 이야기를 해볼게. 나처럼 해. 자료는 카톡방에서 받아.", thread_comments: [], cardnews_slides: [],
  });
  const badToneValidate = runNode(["scripts/validate_offnote_draft.mjs", badTonePath]);
  if (badToneValidate.status === 0 || !badToneValidate.stderr.includes("banned")) {
    throw new Error(`Expected anxious/CTA tone validation failure, got:\n${badToneValidate.stderr}\n${badToneValidate.stdout}`);
  }

  const abstractDraftPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-abstract.json");
  writeJson(abstractDraftPath, {
    id: "OFFNOTE-20260524-evening-abstract", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note",
    threads_text: "요즘은 안 할 일을 더 빨리 고른다.\n\n오늘도 내 리듬을 잃지 않는 쪽이면 충분하다.", thread_comments: [], cardnews_slides: [],
  });
  const abstractValidate = runNode(["scripts/validate_offnote_draft.mjs", abstractDraftPath]);
  if (abstractValidate.status === 0 || !abstractValidate.stderr.includes("abstract generic closing")) {
    throw new Error(`Expected abstract personal-note validation failure, got:\n${abstractValidate.stderr}\n${abstractValidate.stdout}`);
  }

  const badDraftPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-shopping-route.json");
  writeJson(badDraftPath, {
    id: "OFFNOTE-20260524-evening-shopping-route", account: "offnote.kr", status: "approved", content_mode: "digital_nomad_personal_note",
    threads_text: "쿠팡 상품 추천 링크와 구매 링크를 정리했어.", thread_comments: [], cardnews_slides: [],
  });
  const badValidate = runNode(["scripts/validate_offnote_draft.mjs", badDraftPath]);
  if (badValidate.status === 0 || !badValidate.stderr.includes("lifemagazine_")) {
    throw new Error(`Expected shopping-route validation failure, got:\n${badValidate.stderr}\n${badValidate.stdout}`);
  }

  const publish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], { env: { ...process.env, OFFNOTE_TELEGRAM_BOT_TOKEN: "", OFFNOTE_TELEGRAM_CHAT_ID: "" } });
  if (publish.status !== 0 || !publish.stdout.includes("slot already published")) {
    throw new Error(`Expected slot-specific already-published skip, got:\n${publish.stderr}\n${publish.stdout}`);
  }

  console.log(JSON.stringify({ ok: true, guard: "offnote personal-note tone and publish guards pass" }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
