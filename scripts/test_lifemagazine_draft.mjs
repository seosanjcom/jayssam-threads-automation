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
import {
  buildOperationsDashboard,
  describeDraftProblem,
  parseMultipartFormData,
  renderStudioHome,
  saveUploadedMediaFiles,
} from "./threads_studio_server.mjs";
import { buildLifemagazineTelegramMessage, prepareLifemagazinePreviewDraft } from "./send_lifemagazine_preview_telegram.mjs";
import { latestApprovedLifemagazineDraft } from "./publish_lifemagazine_latest_approved.mjs";
import { applyLifemagazineApprovalAction } from "./telegram_check_lifemagazine_approvals.mjs";

const sampleAccounts = [
  { accountKey: "jayssam", threadsUsername: "jayssam_edu", displayName: "제이쌤", project: "jayssam", automationRoot: "outputs/automation", defaultSlots: ["15:00 KST", "21:00 KST"], dailyPostLimit: 2, minIntervalHours: 6 },
  { accountKey: "offnote", threadsUsername: "offnote.kr", displayName: "오프노트", project: "afterwork-profit", automationRoot: "outputs/afterwork-profit/automation", defaultSlots: ["18:00 KST", "21:00 KST"], dailyPostLimit: 1, minIntervalHours: 8 },
  { accountKey: "lifemagazine", threadsUsername: "lifemagazine_", displayName: "라이프매거진", project: "lifemagazine", automationRoot: "outputs/lifemagazine/automation", defaultSlots: ["15:00 KST", "18:00 KST", "21:00 KST"], dailyPostLimit: 1, minIntervalHours: 8 },
];

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
  assert.match(draft.threads_text, /ㅇㅇ 유튜브/);
  assert.match(draft.threads_text, /얘기 나온 거|보고 멈춤|궁금했던 사람/);
  assert.doesNotMatch(draft.threads_text, /검색창|싼티|비슷한 무드/);
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

test("official confirmed drafts can use the user's memo as confirmation context", () => {
  const draft = generateLifemagazineDraft({
    topic: "민경님 컨실러",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "더샘 커버퍼펙션 트리플 팟 컨실러 3호", url: "https://shop.example.com/concealer" }],
    notes: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    source_urls: [],
  });

  const result = validateLifemagazineDraft(draft);

  assert.equal(result.ok, true);
  assert.doesNotMatch(draft.threads_text, /메모 기준/);
});

test("official confirmed beauty drafts use a direct celebrity-loved-item hook", () => {
  const draft = generateLifemagazineDraft({
    topic: "환연4 민경님 컨실러",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "더샘 커버퍼펙션 트리플 팟 컨실러 3호", url: "https://shop.example.com/concealer" }],
    notes: "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민.",
    tone_style: "story_buy",
    source_urls: [],
  });

  assert.match(draft.threads_text, /민경님|환연4/);
  assert.match(draft.threads_text, /2통째|찐 애정템|다크서클/);
  assert.match(draft.threads_text, /다크서클/);
  assert.doesNotMatch(draft.threads_text, /예전에|실패|검색창|싼티|비슷한 무드/);
  assert.doesNotMatch(draft.threads_text, /영상에서 언급된 제품명 중심/);
});

test("official confirmed drafts keep product names separate from the hook topic", () => {
  const draft = generateLifemagazineDraft({
    topic: "환연4 민경님 컨실러",
    product_name: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "더샘 커버퍼펙션 트리플 팟 컨실러 3호", url: "https://shop.example.com/concealer" }],
    notes: "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민.",
    tone_style: "story_buy",
    source_urls: [],
  });

  assert.equal(draft.product_name, "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지");
  assert.doesNotMatch(draft.threads_text, /예전에|실패|검색창|싼티|비슷한 무드/);
  assert.match(draft.thread_comments.join("\n"), /더샘 커버퍼펙션/);
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

test("operations dashboard summarizes today, tomorrow, approvals, and failures", () => {
  const published = generateLifemagazineDraft({ date: "2026-05-24", topic: "발행 완료", source_urls: ["https://example.com/a"] });
  published.status = "published";
  const approved = generateLifemagazineDraft({ date: "2026-05-24", topic: "발행 대기", source_urls: ["https://example.com/b"] });
  approved.status = "approved";
  const pending = generateLifemagazineDraft({ date: "2026-05-24", topic: "승인 대기", source_urls: ["https://example.com/c"] });
  pending.status = "pending_approval";
  const failed = generateLifemagazineDraft({ date: "2026-05-24", topic: "실패", source_urls: ["https://example.com/d"] });
  failed.status = "publish_failed";
  failed.publish_error = "Threads 토큰 계정이 다릅니다.";
  const tomorrow = generateLifemagazineDraft({ date: "2026-05-25", topic: "내일 글", source_urls: ["https://example.com/e"] });
  tomorrow.status = "approved";

  const dashboard = buildOperationsDashboard(sampleAccounts, {
    jayssam: [],
    offnote: [],
    lifemagazine: [
      { data: published, mtime: 1 },
      { data: approved, mtime: 2 },
      { data: pending, mtime: 3 },
      { data: failed, mtime: 4 },
      { data: tomorrow, mtime: 5 },
    ],
  }, { today: "2026-05-24", tomorrow: "2026-05-25" });

  const life = dashboard.accountSummaries.find((item) => item.account.accountKey === "lifemagazine");
  assert.equal(life.todayPublished, 1);
  assert.equal(life.todayScheduled, 1);
  assert.equal(life.approvalWaiting, 1);
  assert.equal(life.tomorrowScheduled, 1);
  assert.equal(life.failed, 1);
  assert.ok(dashboard.issues.some((item) => item.problem.includes("Threads 토큰")));
});

test("lifemagazine local photos produce a visible warning until public media_urls exist", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    topic: "사진 있는 초안",
    source_urls: ["https://example.com/source"],
    local_media_paths: ["outputs/lifemagazine/media/2026-05-24/sample.png"],
  });

  assert.match(describeDraftProblem(draft), /공개 URL/);
});

test("studio home renders operator dashboard and simplified creator workflow", () => {
  const lifemagazineDraft = generateLifemagazineDraft({
    date: "2026-05-24",
    topic: "유튜브 속 광나는 헤어템",
    source_urls: ["https://example.com/video"],
  });
  lifemagazineDraft.status = "pending_approval";

  const html = renderStudioHome({
    accounts: sampleAccounts,
    draftsByAccount: {
      jayssam: [],
      offnote: [],
      lifemagazine: [{ file: path.join(process.cwd(), "outputs", "lifemagazine", "automation", "2026-05-24", `${lifemagazineDraft.id}.json`), data: lifemagazineDraft, mtime: 1 }],
    },
    today: "2026-05-24",
    tomorrow: "2026-05-25",
  });

  assert.match(html, /오늘 운영 현황/);
  assert.match(html, /오늘 할 일/);
  assert.match(html, /문제 있는 항목/);
  assert.match(html, /내일 예정/);
  assert.match(html, /라이프매거진 새 글 만들기/);
  assert.match(html, /작성 중|초안|승인 기다림/);
  assert.match(html, /type="file"/);
  assert.match(html, /name="photos"/);
  assert.match(html, /name="product_name"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.doesNotMatch(html, /ready_to_review|pending_approval|publish_failed/);
});

test("studio home lets unpublished lifemagazine drafts be edited", () => {
  const draft = generateLifemagazineDraft({
    topic: "수정 가능한 초안",
    product_name: "더샘 컨실러",
    source_urls: ["https://example.com/source"],
  });
  draft.status = "ready_to_review";
  const published = generateLifemagazineDraft({
    topic: "발행된 초안",
    source_urls: ["https://example.com/source"],
  });
  published.status = "published";
  const html = renderStudioHome({
    accounts: sampleAccounts,
    draftsByAccount: {
      lifemagazine: [
        { file: path.join(process.cwd(), "outputs", "lifemagazine", "automation", "2026-05-24", "editable.json"), data: draft, mtime: 2 },
        { file: path.join(process.cwd(), "outputs", "lifemagazine", "automation", "2026-05-24", "published.json"), data: published, mtime: 1 },
      ],
      jayssam: [],
      offnote: [],
    },
    today: "2026-05-24",
    tomorrow: "2026-05-25",
  });

  assert.match(html, /action="\/api\/lifemagazine\/drafts\/edit"/);
  assert.match(html, /name="product_name"/);
  assert.match(html, /더샘 컨실러/);
  assert.doesNotMatch(html, /published\.json[\s\S]*action="\/api\/lifemagazine\/drafts\/edit"/);
});

test("multipart parser reads lifemagazine fields and uploaded image files", () => {
  const boundary = "----lifemagazine-test";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="topic"\r\n\r\n유튜브 헤어템\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="hair.png"\r\nContent-Type: image/png\r\n\r\n`),
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const parsed = parseMultipartFormData(body, `multipart/form-data; boundary=${boundary}`);

  assert.equal(parsed.fields.topic, "유튜브 헤어템");
  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0].fieldName, "photos");
  assert.equal(parsed.files[0].filename, "hair.png");
  assert.deepEqual([...parsed.files[0].data], [0x89, 0x50, 0x4e, 0x47]);
});

test("uploaded media files are saved under lifemagazine media output", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-media-"));
  const saved = saveUploadedMediaFiles([
    {
      fieldName: "photos",
      filename: "hair shot.png",
      contentType: "image/png",
      data: Buffer.from([1, 2, 3]),
    },
  ], { root: tmp, date: "2026-05-24", now: "2026-05-24T11:20:00.000Z" });

  assert.equal(saved.length, 1);
  assert.match(saved[0], /^outputs[\\/]+lifemagazine[\\/]+media[\\/]+2026-05-24[\\/]+20260524T112000000Z-1-hair-shot\.png$/);
  assert.equal(fs.existsSync(path.join(tmp, saved[0])), true);
});

test("custom publish time is stored as the actual scheduled publish time", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-05-24",
    slot: "night",
    custom_publish_time: "22:30",
    topic: "custom time",
    source_urls: ["https://example.com/source"],
  }, { now: "2026-05-24T10:00:00.000Z" });

  assert.equal(draft.recommended_publish_time, "22:30 KST");
  assert.equal(draft.publish_time_source, "custom");
  assert.equal(draft.scheduled_publish_at, "2026-05-24T13:30:00.000Z");
});

test("studio composer presents recommended slots and a custom time field", () => {
  const html = renderStudioHome({ accounts: sampleAccounts, drafts: [], today: "2026-05-24", tomorrow: "2026-05-25" });

  assert.match(html, /name="custom_publish_time"/);
  assert.match(html, /type="time"/);
  assert.match(html, /15:00 KST/);
  assert.match(html, /21:00 KST/);
  assert.match(html, /name="date" type="date"/);
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
  assert.match(prepared.telegram_approval_token, /^[a-f0-9]{16}$/);
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

test("latestApprovedLifemagazineDraft waits until the scheduled publish time", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-due-"));
  const due = generateLifemagazineDraft({
    date: "2026-05-24",
    custom_publish_time: "18:00",
    topic: "due",
    source_urls: ["https://example.com/due"],
  });
  due.status = "approved";
  const future = generateLifemagazineDraft({
    date: "2026-05-24",
    custom_publish_time: "22:30",
    topic: "future",
    source_urls: ["https://example.com/future"],
  });
  future.status = "approved";
  const duePath = saveLifemagazineDraft(due, { root: tmp });
  saveLifemagazineDraft(future, { root: tmp });

  const latest = latestApprovedLifemagazineDraft({
    root: tmp,
    publishedIds: new Set(),
    now: "2026-05-24T12:05:00.000Z",
  });

  assert.equal(latest.file, duePath);
  assert.equal(latest.data.id, due.id);
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
