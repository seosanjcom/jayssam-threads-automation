import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  TONE_STYLES,
  buildDraftId,
  generateLifemagazineDraft,
  saveLifemagazineDraft,
} from "./generate_lifemagazine_draft.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";
import { renderStudioHome } from "./threads_studio_server.mjs";
import { buildLifemagazineTelegramMessage, prepareLifemagazinePreviewDraft } from "./send_lifemagazine_preview_telegram.mjs";
import { latestApprovedLifemagazineDraft } from "./publish_lifemagazine_latest_approved.mjs";
import { applyLifemagazineApprovalAction } from "./telegram_check_lifemagazine_approvals.mjs";

test("official confirmed product draft uses source-backed Korean wording and disclosure", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    slot: "evening",
    topic: "유튜브 속 광나는 헤어템",
    celebrity_or_content: "ㅇㅇ 유튜브",
    source_urls: ["https://example.com/video"],
    product_relationship: "official_confirmed",
    product_links: [{ label: "영상 속 헤어템", url: "https://shop.example.com/hair" }],
    notes: "영상에서 직접 언급된 제품. 광이 좋아 보여서 저장.",
    tone_style: "discovery_over",
  });

  assert.equal(draft.account, "lifemagazine_");
  assert.equal(draft.account_name, "라이프매거진");
  assert.equal(draft.project, "lifemagazine");
  assert.equal(draft.draft_date, "2026-05-24");
  assert.equal(draft.tone_style, "discovery_over");
  assert.equal(draft.affiliate_disclosure_required, true);
  assert.match(draft.threads_text, /^\[제휴 링크 포함\]/);
  assert.match(draft.threads_text, /ㅇㅇ 유튜브 보다가/);
  assert.match(draft.threads_text, /멈춤|확대/);
  assert.match(draft.thread_comments.join("\n"), /제휴 링크/);
  assert.equal(validateLifemagazineDraft(draft).ok, true);
});

test("similar mood draft avoids same-product claims and marks reference items", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    slot: "night",
    topic: "은근 고급진 실버 이어링",
    celebrity_or_content: "드라마 클립",
    source_urls: ["https://example.com/clip"],
    product_relationship: "similar_mood",
    product_links: [{ label: "비슷한 무드", url: "https://shop.example.com/earring" }],
    notes: "작고 얇은 실버톤.",
    tone_style: "soft_curiosity",
  });

  const allText = `${draft.threads_text}\n${draft.thread_comments.join("\n")}`;
  assert.match(allText, /비슷한 무드|참고템/);
  assert.doesNotMatch(allText, /착용한 제품입니다|같은 제품입니다|동일 제품입니다/);
  assert.equal(validateLifemagazineDraft(draft).ok, true);
});

test("all tone styles are selectable and include examples", () => {
  const labels = TONE_STYLES.map((style) => style.label);
  assert.deepEqual(labels, [
    "발견 오바형",
    "친구 제보형",
    "후기 납득형",
    "썰 풀기형",
    "권위자 찍어줌형",
    "반전형",
    "담백 궁금증형",
  ]);
  assert.ok(TONE_STYLES.every((style) => style.key && style.example.includes("\n")));
});

test("buildDraftId produces filesystem-safe lifemagazine ids", () => {
  assert.equal(
    buildDraftId("2026-05-24", "evening", "유튜브 속 광나는 헤어템!"),
    "LIFE-20260524-evening-유튜브-속-광나는-헤어템",
  );
});

test("saveLifemagazineDraft writes only under lifemagazine automation output", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-draft-"));
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    slot: "evening",
    topic: "생활템",
    source_urls: ["https://example.com/source"],
    product_relationship: "trend_only",
  }, { now: "2026-05-23T15:00:00.000Z" });

  const saved = saveLifemagazineDraft(draft, { root: tmp });

  assert.equal(path.relative(tmp, saved), path.join("outputs", "lifemagazine", "automation", "2026-05-24", `${draft.id}.json`));
  assert.equal(fs.existsSync(saved), true);
  assert.equal(fs.existsSync(path.join(tmp, "outputs", "automation")), false);
  assert.equal(fs.existsSync(path.join(tmp, "outputs", "afterwork-profit")), false);
});

test("validator rejects product links when disclosure is missing", () => {
  const draft = generateLifemagazineDraft({
    topic: "가방",
    source_urls: ["https://example.com/source"],
    product_relationship: "similar_mood",
    product_links: [{ label: "참고템", url: "https://shop.example.com/bag" }],
  });
  draft.threads_text = draft.threads_text.replace("[제휴 링크 포함]", "");

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("disclosure")));
});

test("validator rejects official confirmed drafts without a source", () => {
  const draft = generateLifemagazineDraft({
    topic: "가방",
    product_relationship: "official_confirmed",
    product_links: [{ label: "확인 제품", url: "https://shop.example.com/bag" }],
  });
  draft.source_urls = [];

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("official_confirmed")));
});

test("validator rejects same-product wording for similar mood drafts", () => {
  const draft = generateLifemagazineDraft({
    topic: "이어링",
    source_urls: ["https://example.com/source"],
    product_relationship: "similar_mood",
  });
  draft.threads_text += "\n이건 착용한 제품입니다.";

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("same-product")));
});

test("studio home renders three account workspaces and tone preset examples", () => {
  const lifemagazineDraft = generateLifemagazineDraft({
    date: "2026-05-24",
    topic: "유튜브 속 광나는 헤어템",
    source_urls: ["https://example.com/video"],
  });
  const html = renderStudioHome({
    accounts: [
      { accountKey: "jayssam", threadsUsername: "jayssam_edu", displayName: "제이쌤", project: "jayssam", automationRoot: "outputs/automation", defaultSlots: ["15:00 KST", "21:00 KST"], dailyPostLimit: 2, minIntervalHours: 6 },
      { accountKey: "offnote", threadsUsername: "offnote.kr", displayName: "오프노트", project: "afterwork-profit", automationRoot: "outputs/afterwork-profit/automation", defaultSlots: ["18:00 KST", "21:00 KST"], dailyPostLimit: 1, minIntervalHours: 8 },
      { accountKey: "lifemagazine", threadsUsername: "lifemagazine_", displayName: "라이프매거진", project: "lifemagazine", automationRoot: "outputs/lifemagazine/automation", defaultSlots: ["15:00 KST", "18:00 KST", "21:00 KST"], dailyPostLimit: 1, minIntervalHours: 8 },
    ],
    draftsByAccount: {
      jayssam: [],
      offnote: [],
      lifemagazine: [{ file: path.join(process.cwd(), "outputs", "lifemagazine", "automation", "2026-05-24", `${lifemagazineDraft.id}.json`), data: lifemagazineDraft }],
    },
  });

  assert.match(html, /제이쌤/);
  assert.match(html, /오프노트/);
  assert.match(html, /라이프매거진/);
  assert.match(html, /발견 오바형/);
  assert.match(html, /친구 제보형/);
  assert.match(html, /후기 납득형/);
  assert.match(html, /tone_style/);
  assert.match(html, /data-tone/);
  assert.match(html, /텔레그램 미리보기/);
  assert.match(html, /\/api\/lifemagazine\/telegram-preview/);
});

test("telegram preview marks draft pending and renders readable Korean message", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    slot: "evening",
    topic: "유튜브 속 광나는 헤어템",
    celebrity_or_content: "ㅇㅇ 유튜브",
    product_relationship: "official_confirmed",
    source_urls: ["https://example.com/video"],
    product_links: [{ label: "영상 속 헤어템", url: "https://shop.example.com/hair" }],
    tone_style: "friend_tip",
  });

  const prepared = prepareLifemagazinePreviewDraft(draft, "2026-05-24T10:00:00.000Z");
  const message = buildLifemagazineTelegramMessage(prepared, { runUrl: "https://github.com/example/run" });

  assert.equal(prepared.status, "pending_approval");
  assert.equal(prepared.approval_requested_at, "2026-05-24T10:00:00.000Z");
  assert.match(message, /\[라이프매거진 미리보기\]/);
  assert.match(message, /승인하면 approved 상태/);
  assert.match(message, /댓글 1/);
  assert.doesNotMatch(message, /�|願|쒗|볤/);
});

test("latestApprovedLifemagazineDraft selects newest unpublished approved draft", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-latest-"));
  const older = generateLifemagazineDraft({ date: "2026-05-22", topic: "older", source_urls: ["https://example.com/a"] }, { now: "2026-05-22T09:00:00.000Z" });
  older.status = "approved";
  const newer = generateLifemagazineDraft({ date: "2026-05-23", topic: "newer", source_urls: ["https://example.com/b"] }, { now: "2026-05-23T09:00:00.000Z" });
  newer.status = "approved";
  saveLifemagazineDraft(older, { root: tmp });
  const newerPath = saveLifemagazineDraft(newer, { root: tmp });

  const latest = latestApprovedLifemagazineDraft({ root: tmp, publishedIds: new Set([older.id]) });

  assert.equal(latest.file, newerPath);
  assert.equal(latest.data.id, newer.id);
});

test("applyLifemagazineApprovalAction updates only pending lifemagazine drafts", () => {
  const draft = generateLifemagazineDraft({
    topic: "approval",
    source_urls: ["https://example.com/source"],
    product_relationship: "similar_mood",
  });
  draft.status = "pending_approval";

  const approved = applyLifemagazineApprovalAction(draft, "approve");
  const held = applyLifemagazineApprovalAction({ ...draft, status: "pending_approval" }, "hold");

  assert.equal(approved.status, "approved");
  assert.equal(approved.publish_on_approve, false);
  assert.equal(held.status, "held");
  assert.throws(() => applyLifemagazineApprovalAction({ ...draft, account: "offnote.kr" }, "approve"));
});
