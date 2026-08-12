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
  return spawnSync("node", args, {
    cwd: tmp,
    encoding: "utf8",
    ...extra,
  });
}

function assertOffnoteMaterialsDraft(draft) {
  if (draft.status !== "approved") {
    throw new Error(`Expected generated offnote draft to be ready for automatic publishing, got ${draft.status}`);
  }
  if (!/자료/.test(draft.threads_text) || !/인스타 같은 글에 댓글/.test(draft.threads_text) || !/카톡방/.test(draft.threads_text)) {
    throw new Error(`Offnote draft does not match materials CTA tone:\n${draft.threads_text}`);
  }
  if (/기준\s*(?:알려|정리|공유|풀)|나처럼|성공담|망한\s*것|배운\s*것|수정한\s*것/.test(draft.threads_text)) {
    throw new Error(`Offnote draft contains banned framing:\n${draft.threads_text}`);
  }
  if ((draft.thread_comments || []).length > 1) {
    throw new Error("Offnote materials drafts should not use repetitive comment expansion.");
  }
}

try {
  copyScript("generate_offnote_daily_post.mjs");
  copyScript("publish_offnote_due.mjs");
  copyScript("validate_offnote_draft.mjs");
  const firstGenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (firstGenerate.status !== 0) {
    throw new Error(`initial generate guard failed:\n${firstGenerate.stderr}\n${firstGenerate.stdout}`);
  }

  const generated = JSON.parse(firstGenerate.stdout);
  const draftPath = path.join(tmp, generated.draft);
  const firstDraft = readJson(draftPath);
  assertOffnoteMaterialsDraft(firstDraft);

  const valid = runNode(["scripts/validate_offnote_draft.mjs", draftPath]);
  if (valid.status !== 0) {
    throw new Error(`Expected generated offnote draft to validate:\n${valid.stderr}\n${valid.stdout}`);
  }

  const publishedDraft = {
    ...firstDraft,
    status: "published",
    media_urls: ["https://example.com/card.png"],
    published_at: "2026-05-23T08:29:48.793Z",
  };
  writeJson(draftPath, publishedDraft);

  const generate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
  if (generate.status !== 0) {
    throw new Error(`generate guard failed:\n${generate.stderr}\n${generate.stdout}`);
  }

  const afterGenerate = readJson(draftPath);
  if (afterGenerate.status !== "published" || afterGenerate.published_at !== publishedDraft.published_at) {
    throw new Error("Published draft was overwritten by preview generation.");
  }

  const flag = fs.readFileSync(path.join(tmp, "outputs", "afterwork-profit", "preview-created.txt"), "utf8").trim();
  if (flag !== "false") {
    throw new Error(`Expected preview-created=false for existing published draft, got ${flag}`);
  }

  const sampleDates = ["2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"];
  for (const date of sampleDates) {
    const result = runNode(["scripts/generate_offnote_daily_post.mjs", date, "evening"]);
    if (result.status !== 0) {
      throw new Error(`materials generate failed for ${date}:\n${result.stderr}\n${result.stdout}`);
    }
    assertOffnoteMaterialsDraft(readJson(path.join(tmp, JSON.parse(result.stdout).draft)));
  }

  const badTonePath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-bad-tone.json");
  writeJson(badTonePath, {
    id: "OFFNOTE-20260524-evening-bad-tone",
    account: "offnote.kr",
    topic: "블로그 수익화 기준",
    status: "pending_approval",
    threads_text: "블로그 수익화 기준 알려줄게. 나처럼 해. 성공담도 풀어볼게.",
    thread_comments: [],
    cardnews_slides: [
      { title: "블로그", body: "자료" },
      { title: "인스타", body: "댓글" },
      { title: "카톡방", body: "공지" },
      { title: "자료", body: "챌린지" },
    ],
  });
  const badToneValidate = runNode(["scripts/validate_offnote_draft.mjs", badTonePath]);
  if (badToneValidate.status === 0 || !badToneValidate.stderr.includes("banned positioning")) {
    throw new Error(`Expected bad tone validation failure, got:\n${badToneValidate.stderr}\n${badToneValidate.stdout}`);
  }

  const badDraftPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", "OFFNOTE-20260524-evening-shopping-route.json");
  writeJson(badDraftPath, {
    id: "OFFNOTE-20260524-evening-shopping-route",
    account: "offnote.kr",
    topic: "쿠팡 상품 추천",
    status: "approved",
    threads_text: "쿠팡 상품 추천 링크와 구매 링크를 정리했어. 인스타 같은 글에 댓글 남겨줘. 카톡방 자료도 있어.",
    thread_comments: [],
    cardnews_slides: [
      { title: "상품 링크", body: "쿠팡 상품 추천" },
      { title: "구매 링크", body: "상품 링크" },
      { title: "자료", body: "인스타 같은 글에 댓글" },
      { title: "카톡방", body: "자료 공지" },
    ],
  });
  const badValidate = runNode(["scripts/validate_offnote_draft.mjs", badDraftPath]);
  if (badValidate.status === 0 || !badValidate.stderr.includes("lifemagazine_")) {
    throw new Error(`Expected shopping-route validation failure, got:\n${badValidate.stderr}\n${badValidate.stdout}`);
  }

  const badPublish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-24", "evening"], {
    env: {
      ...process.env,
      OFFNOTE_TELEGRAM_BOT_TOKEN: "",
      OFFNOTE_TELEGRAM_CHAT_ID: "",
    },
  });
  if (badPublish.status !== 0 || !badPublish.stdout.includes("Held offnote draft")) {
    throw new Error(`Expected shopping-route publish hold, got:\n${badPublish.stderr}\n${badPublish.stdout}`);
  }
  const heldDraft = readJson(badDraftPath);
  if (heldDraft.status !== "held" || !String(heldDraft.hold_reason || "").includes("lifemagazine_")) {
    throw new Error("Shopping-route draft was not held before offnote publish.");
  }

  const publish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], {
    env: {
      ...process.env,
      OFFNOTE_TELEGRAM_BOT_TOKEN: "",
      OFFNOTE_TELEGRAM_CHAT_ID: "",
    },
  });
  if (publish.status !== 0) {
    throw new Error(`auto-publish guard failed:\n${publish.stderr}\n${publish.stdout}`);
  }
  if (!publish.stdout.includes("slot already published")) {
    throw new Error(`Expected slot-specific already-published skip message, got:\n${publish.stdout}`);
  }

  const publishScript = fs.readFileSync(path.join(tmp, "scripts", "publish_offnote_due.mjs"), "utf8");
  if (!publishScript.includes("const slotDrafts")) {
    throw new Error("Offnote auto-publish must select and deduplicate drafts per slot.");
  }

  console.log(JSON.stringify({ ok: true, guard: "offnote materials tone and publish guards pass" }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
