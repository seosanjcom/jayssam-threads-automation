import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
import {
  fixtureProductCandidates,
  normalizeProductCandidate,
  selectDailyProductCandidates,
  COUPANG_DISCLOSURE,
} from "./lifemagazine_product_candidates.mjs";
import {
  buildProductQueueConfirmation,
  buildProductQueueReminder,
  enrichProductQueueLinks,
  loadManualProductQueue,
  parseTelegramProductQueueReply,
  saveManualProductQueue,
} from "./lifemagazine_telegram_product_queue.mjs";
import { buildCoupangCandidate, generateDailyProductDrafts } from "./generate_lifemagazine_product_daily.mjs";
import { extractProductMetadata, resolveProductLink } from "./product_link_resolver.mjs";
import { buildCoupangAuthorization } from "./coupang_partners_api.mjs";

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
  assert.doesNotMatch(draft.threads_text, /더샘|커버퍼펙션|코렉트업 베이지/);
  assert.doesNotMatch(draft.threads_text, /예전에|실패|검색창|싼티|비슷한 무드/);
  assert.match(draft.thread_comments.join("\n"), /더샘 커버퍼펙션/);
});

test("official confirmed drafts do not put a product-name topic in the body", () => {
  const draft = generateLifemagazineDraft({
    topic: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "추천 링크", url: "https://shop.example.com/concealer" }],
    notes: "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민.",
    tone_style: "story_buy",
    source_urls: [],
  });

  assert.match(draft.threads_text, /민경님|다크서클|민와와/);
  assert.doesNotMatch(draft.threads_text, /더샘|커버퍼펙션|코렉트업 베이지/);
  assert.doesNotMatch(draft.threads_text, /예전에|실패|검색창|싼티|비슷한 무드/);
});

test("official confirmed drafts hide product names from body even with thin notes", () => {
  const draft = generateLifemagazineDraft({
    topic: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    product_name: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "더샘 커버퍼펙션", url: "https://shop.example.com/concealer" }],
    notes: "영상에서 직접 언급",
    tone_style: "discovery_over",
    source_urls: [],
  });

  assert.match(draft.threads_text, /민와와 유튜브/);
  assert.doesNotMatch(draft.threads_text, /더샘|커버퍼펙션|코렉트업 베이지/);
  assert.match(draft.thread_comments.join("\n"), /더샘 커버퍼펙션/);
});

test("official confirmed drafts keep memo hooks even while hiding product names", () => {
  const draft = generateLifemagazineDraft({
    topic: "환연4 민경님 컨실러",
    product_name: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "더샘 커버퍼펙션", url: "https://shop.example.com/concealer" }],
    notes: "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민.",
    tone_style: "story_buy",
    source_urls: [],
  });

  assert.match(draft.threads_text, /피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템/);
  assert.match(draft.threads_text, /다크서클 커버 고민이면 이건 안 찾아볼 수가 없더라/);
  assert.match(draft.threads_text, /민와와 유튜브 보고 나도 바로 궁금해져서 찾아봄 ㅎㅎ/);
  assert.doesNotMatch(draft.threads_text, /더샘|커버퍼펙션|코렉트업 베이지/);
});

test("official confirmed comments include exact item info and FTC-style affiliate disclosure", () => {
  const draft = generateLifemagazineDraft({
    topic: "환연4 민경님 컨실러",
    product_name: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "구매 링크", url: "https://link.coupang.com/a/example" }],
    notes: "민경님은 3호 코렉트업 베이지 쓴대. 피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민.",
    tone_style: "story_buy",
    source_urls: [],
  });
  const comments = draft.thread_comments.join("\n");

  assert.match(comments, /민경님은 3호 코렉트업 베이지 쓴대/);
  assert.match(comments, /더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지/);
  assert.match(comments, /제휴 링크|수수료|공정위|경제적 대가/);
  assert.match(comments, /https:\/\/link\.coupang\.com\/a\/example/);
});

test("official confirmed beauty draft follows the user's lifemagazine sample tone", () => {
  const draft = generateLifemagazineDraft({
    topic: "환연4 민경님 컨실러",
    product_name: "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    celebrity_or_content: "민와와 유튜브",
    product_relationship: "official_confirmed",
    product_links: [{ label: "구매링크", url: "https://link.coupang.com/a/example" }],
    notes: "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템. 다크서클 커버 고민. 민경님은 3호 코렉트업 베이지 쓴대.",
    tone_style: "story_buy",
    source_urls: [],
  });

  assert.equal(draft.threads_text, [
    "[제휴 링크 포함]",
    "피부화장에 가장 공을 들이는 민경님이 2통째 사용 중인 찐 애정템",
    "다크서클 커버 고민이면 이건 안 찾아볼 수가 없더라",
    "민와와 유튜브 보고 나도 바로 궁금해져서 찾아봄 ㅎㅎ",
    "정보는 댓글에 남겨둘게!!",
  ].join("\n"));
  assert.equal(draft.thread_comments[0], [
    "민경님은 3호 코렉트업 베이지 쓴대",
    "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지",
    "구매링크: https://link.coupang.com/a/example",
    "이 댓글에는 제휴 링크가 포함되어 있고, 구매 시 수수료를 받을 수 있어.",
  ].join("\n"));
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
  assert.match(html, /라이프매거진 수동 작성/);
  assert.match(html, /사진\/영상/);
  assert.match(html, /출처 메모/);
  assert.match(html, /공식 언급템/);
  assert.match(html, /비슷한 무드/);
  assert.match(html, /오프노트 자동화 확인/);
  assert.match(html, /제이쌤 교육 자동화/);
  assert.match(html, /오프노트 오늘 글/);
  assert.match(html, /제이쌤 오늘 글/);
  assert.match(html, /승인 대기/);
  assert.match(html, /발행 실패 이유/);
  assert.match(html, /작성 중|초안|승인 기다림/);
  assert.match(html, /type="file"/);
  assert.match(html, /name="photos"/);
  assert.match(html, /name="product_name"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.doesNotMatch(html, /\?{3,}/);
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
  assert.match(html, /수정하기/);
  assert.doesNotMatch(html, /\?{3,}/);
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

test("latestApprovedLifemagazineDraft selects an approval-immediate draft before its scheduled time", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-immediate-"));
  const draft = generateLifemagazineDraft({ date: "2026-08-03", topic: "승인 즉시 발행", source_urls: ["https://example.com/a"] });
  draft.status = "approved";
  draft.publish_on_approve = true;
  draft.scheduled_publish_at = "2026-08-04T12:00:00.000Z";
  const file = saveLifemagazineDraft(draft, { root });

  const latest = latestApprovedLifemagazineDraft({ root, now: new Date("2026-08-03T12:00:00.000Z") });
  assert.equal(latest.file, file);
  fs.rmSync(root, { recursive: true, force: true });
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
  assert.equal(approved.publish_on_approve, true);
  assert.equal(held.status, "held");
  assert.throws(() => applyLifemagazineApprovalAction({ ...draft, account: "offnote.kr" }, "approve"));
});

function runPublishDraftFixture(draft, env = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-publish-guard-"));
  const draftPath = path.join(tmp, "draft.json");
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return spawnSync(process.execPath, ["scripts/threads_publish.mjs", draftPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      THREADS_ACCESS_TOKEN: "test-token",
      THREADS_AUTO_PUBLISH: "true",
      THREADS_SAFETY_MODE: "false",
      THREADS_VERIFY_PROFILE_BEFORE_PUBLISH: "false",
      THREADS_PUBLISH_WAIT_MS: "0",
      THREADS_REPLY_WAIT_MS: "0",
      ...env,
    },
  });
}

test("lifemagazine publish refuses local photos without public media_urls before any API publish", () => {
  const result = runPublishDraftFixture({
    id: "LIFE-media-guard",
    account: "lifemagazine_",
    status: "approved",
    topic: "photo guard",
    threads_text: "\uC0AC\uC9C4 \uC788\uB294 \uAE00\uC740 \uC774\uBBF8\uC9C0\uAC00 \uBE60\uC9C0\uBA74 \uC548 \uB3FC.",
    local_media_paths: ["outputs/lifemagazine/media/2026-05-24/sample.png"],
    media_urls: [],
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /media_urls|public image URL|photo/i);
});

test("lifemagazine publish refuses comment-link drafts until reply permission is confirmed", () => {
  const result = runPublishDraftFixture({
    id: "LIFE-reply-guard",
    account: "lifemagazine_",
    status: "approved",
    topic: "reply guard",
    threads_text: "\uC815\uBCF4\uB294 \uB313\uAE00\uC5D0 \uB0A8\uACA8\uB458\uAC8C.",
    media_urls: ["https://example.com/photo.png"],
    thread_comments: ["\uCD94\uCC9C \uB9C1\uD06C: https://example.com/item"],
  }, {
    THREADS_REQUIRE_REPLIES: "true",
    THREADS_REPLY_PERMISSION_CONFIRMED: "",
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /reply permission|comments cannot be guaranteed|THREADS_REPLY_PERMISSION_CONFIRMED/i);
});

test("lifemagazine publish refuses mojibake-looking Korean text", () => {
  const result = runPublishDraftFixture({
    id: "LIFE-mojibake-guard",
    account: "lifemagazine_",
    status: "approved",
    topic: "?????",
    threads_text: "[?? ?? ??]\n???? ???? ?????\n??????.",
    media_urls: ["https://example.com/photo.png"],
    thread_comments: [],
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /mojibake|broken Korean|\?\?\?/i);
});

test("lifemagazine product queue reminder includes reply examples", () => {
  const message = buildProductQueueReminder("2026-08-03");

  assert.match(message, /내일 라이프매거진 상품을 직접 정할래/);
  assert.match(message, /답변 예시/);
  assert.match(message, /상품 링크만 그대로 보내도 돼/);
  assert.match(message, /내일은 자동으로 해줘/);
});

test("Coupang Partners HMAC uses the documented two-digit UTC year format", () => {
  const header = buildCoupangAuthorization({
    accessKey: "access",
    secretKey: "secret",
    method: "GET",
    path: "/v2/providers/affiliate_open_api/apis/openapi/products/search",
    query: "keyword=%ED%85%80%EB%B8%94%EB%9F%AC&limit=3",
    date: new Date("2026-08-12T03:00:00.000Z"),
  });
  assert.match(header, /signed-date=260812T030000Z/);
  assert.match(header, /algorithm=HmacSHA256/);
});

test("product resolver extracts safe product metadata from JSON-LD and Open Graph", () => {
  const metadata = extractProductMetadata(`
    <html><head>
      <meta property="og:title" content="대용량 데일리 머리끈 | 스토어" />
      <meta property="og:image" content="https://cdn.example.com/hair.png" />
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"대용량 데일리 머리끈","image":"https://cdn.example.com/hair.png","brand":{"@type":"Brand","name":"데일리픽"},"offers":{"@type":"Offer","price":"8900"}}</script>
    </head></html>
  `, "https://link.example.com/hair");

  assert.equal(metadata.product_name, "대용량 데일리 머리끈");
  assert.equal(metadata.brand, "데일리픽");
  assert.equal(metadata.price, 8900);
  assert.equal(metadata.image_url, "https://cdn.example.com/hair.png");
});

test("product resolver marks an access-denied shopping page as unresolved", async () => {
  const result = await resolveProductLink("https://link.coupang.com/a/example", {
    fetchImpl: async () => new Response("<html><title>Sorry! Access denied</title><body>이 페이지에 접근할 수 있는 권한이 없습니다.</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
  });

  assert.equal(result.metadata_status, "access_denied");
  assert.equal(result.product_name, "");
  assert.match(result.metadata_error, /상품명: \.\.\./);
});

test("blocked Coupang short link is enriched through Partners API when a product name is supplied", async () => {
  const result = await resolveProductLink("https://link.coupang.com/a/example", {
    productName: "보온 텀블러",
    fetchImpl: async () => new Response("<html><title>Sorry! Access denied</title><body>이 페이지에 접근할 수 있는 권한이 없습니다.</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }),
    coupangSearch: async (keyword) => {
      assert.equal(keyword, "보온 텀블러");
      return {
        status: "resolved",
        products: [{
          product_name: "스테인리스 보온 텀블러 500ml",
          product_url: "https://www.coupang.com/vp/products/example",
          image_url: "https://cdn.example.com/tumbler.jpg",
          price: 18900,
          brand: "테스트브랜드",
          description: "스테인리스 보온 텀블러 500ml",
        }],
      };
    },
  });

  assert.equal(result.metadata_status, "coupang_partners_resolved");
  assert.equal(result.product_name, "스테인리스 보온 텀블러 500ml");
  assert.equal(result.price, 18900);
  assert.equal(result.affiliate_url, "https://link.coupang.com/a/example");
});

test("lifemagazine bare product link is enriched before draft creation", async () => {
  const parsed = parseTelegramProductQueueReply("https://link.coupang.com/a/hair\n포인트: 아침마다 머리끈 찾는 사람용", {
    date: "2026-08-03",
    collectedAt: "2026-08-02T12:00:00.000Z",
  });
  const queue = await enrichProductQueueLinks(parsed, {
    resolveLink: async () => ({
      product_name: "대용량 데일리 머리끈",
      product_url: "https://www.coupang.com/vp/products/123",
      image_url: "https://cdn.example.com/hair.png",
      price: 8900,
      brand: "데일리픽",
      metadata_status: "resolved",
    }),
  });

  assert.equal(queue.mode, "manual");
  assert.equal(queue.products[0].product_name, "대용량 데일리 머리끈");
  assert.equal(queue.products[0].price, 8900);
  assert.match(queue.products[0].operator_note, /아침마다 머리끈/);
  assert.match(buildProductQueueConfirmation(queue), /대용량 데일리 머리끈/);
});

test("lifemagazine product queue reads an explicit product name with a short link", () => {
  const queue = parseTelegramProductQueueReply("상품명: 보온 텀블러\nhttps://link.coupang.com/a/example\n포인트: 회사 책상에 두기 좋은 보온력", { date: "2026-08-03" });
  assert.equal(queue.products[0].product_name, "보온 텀블러");
  assert.match(queue.products[0].operator_note, /회사 책상/);
});

test("lifemagazine product queue parses manual Telegram reply and confirms saved products", () => {
  const queue = parseTelegramProductQueueReply(`
내일 상품
1. 대용량 머리끈
링크 https://link.coupang.com/a/hair
하고싶은말 머리끈 맨날 잃어버리는 사람한테 쟁여템 느낌

2. 케이블 정리 클립
링크 https://link.coupang.com/a/cable
하고싶은말 책상 위 충전선 굴러다니는 거 싫은 사람용
`, { date: "2026-08-03", collectedAt: "2026-08-02T12:00:00.000Z" });

  assert.equal(queue.mode, "manual");
  assert.equal(queue.products.length, 2);
  assert.equal(queue.products[0].product_name, "대용량 머리끈");
  assert.equal(queue.products[0].operator_note, "머리끈 맨날 잃어버리는 사람한테 쟁여템 느낌");
  assert.match(buildProductQueueConfirmation(queue), /2개 링크를 저장했어/);
});

test("lifemagazine product queue parses natural mixed numbering formats", () => {
  const queue = parseTelegramProductQueueReply(`
내일 상품
1.냉동아보카도
링크 https://link.coupang.com/a/avocado
하고싶은말 다이어터에게 완전추천

2) 코코넛워터
링크 https://link.coupang.com/a/coconut
하고싶은말 집에서 코코콜드브루 해먹기

- 그릭요거트
링크 https://link.coupang.com/a/yogurt
하고싶은말 아보카도 스무디랑 같이 먹기
`, { date: "2026-08-03", collectedAt: "2026-08-02T12:00:00.000Z" });

  assert.equal(queue.mode, "manual");
  assert.deepEqual(queue.products.map((item) => item.product_name), ["냉동아보카도", "코코넛워터", "그릭요거트"]);
});

test("lifemagazine product queue saves and loads manual products", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-product-queue-"));
  const queue = parseTelegramProductQueueReply(`
내일 상품
1. 대용량 머리끈
링크 https://link.coupang.com/a/hair
하고싶은말 쟁여템 느낌
`, { date: "2026-08-03", collectedAt: "2026-08-02T12:00:00.000Z" });

  const saved = saveManualProductQueue(queue, { root: tmp });
  const loaded = loadManualProductQueue("2026-08-03", { root: tmp });

  assert.equal(path.relative(tmp, saved), path.join("inputs", "lifemagazine", "products", "2026-08-03.json"));
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].source, "manual_queue");
  assert.equal(loaded[0].operator_note, "쟁여템 느낌");
});

test("child-focused Lingtea draft uses child product checks instead of unrelated lifestyle scenes", () => {
  const draft = generateLifemagazineDraft({
    date: "2026-08-12",
    slot: "manual",
    content_mode: "found_product",
    product_name: "링티 아이 아이전용",
    operator_note: "의학적 효능은 말하지 않는다.",
    product_candidate: { product_name: "링티 아이 아이전용", scene_hint: "아이와 외출할 때" },
    product_links: [{ label: "제품 링크", url: "https://link.coupang.com/a/example", platform: "affiliate" }],
    product_metadata: { price: 21000 },
  });
  assert.match(draft.threads_text, /마시는 수액/);
  assert.match(draft.threads_text, /물 250mL에 1포/);
  assert.doesNotMatch(draft.threads_text, /충전선|의학적 효능/);
  assert.match(draft.thread_comments.join("\n"), /쿠팡 파트너스 활동/);
});

test("product-scene lifemagazine draft keeps disclosure in comment, not body", () => {
  const candidate = normalizeProductCandidate({
    productName: "대용량 머리끈 100개",
    categoryName: "헤어소품",
    affiliateUrl: "https://link.coupang.com/a/hair",
    productImage: "https://example.com/hair.jpg",
    reviewCount: 812,
  });
  const draft = generateLifemagazineDraft({
    date: "2026-08-02",
    slot: "morning",
    topic: "머리끈 쟁여템",
    content_mode: "found_product",
    product_candidate: candidate,
    product_links: [{ label: "제품 링크", url: candidate.affiliate_url, platform: "coupang" }],
  }, { now: "2026-08-02T00:00:00.000Z" });

  assert.equal(draft.content_mode, "found_product");
  assert.equal(draft.usage_status, "not_confirmed");
  assert.doesNotMatch(draft.threads_text, /^\[제휴 링크 포함\]/);
  assert.doesNotMatch(draft.threads_text, /https?:\/\//);
  assert.match(draft.threads_text, /머리끈|잃어버리는|쟁여/);
  assert.match(draft.thread_comments.join("\n"), /https:\/\/link\.coupang\.com\/a\/hair/);
  assert.match(draft.thread_comments.join("\n"), new RegExp(COUPANG_DISCLOSURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(draft.visual_mode, "ai_lifestyle_reference");
  assert.equal(validateLifemagazineDraft(draft).ok, true);
});

test("lifemagazine daily product generator prefers Telegram manual queue", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-manual-products-"));
  saveManualProductQueue({
    date: "2026-08-03",
    mode: "manual",
    products: [
      normalizeProductCandidate({ source: "manual_queue", product_name: "대용량 머리끈", affiliate_url: "https://link.coupang.com/a/hair", operator_note: "머리끈 맨날 잃어버리는 사람한테 쟁여템 느낌" }),
      normalizeProductCandidate({ source: "manual_queue", product_name: "케이블 정리 클립", affiliate_url: "https://link.coupang.com/a/cable", operator_note: "책상 위 충전선 굴러다니는 거 싫은 사람용" }),
      normalizeProductCandidate({ source: "manual_queue", product_name: "소지품 파우치", affiliate_url: "https://link.coupang.com/a/pouch", operator_note: "가방 안 립밤 사라지는 사람용" }),
    ],
  }, { root: tmp });

  const drafts = generateDailyProductDrafts({
    root: tmp,
    date: "2026-08-03",
    now: "2026-08-02T12:00:00.000Z",
    candidates: fixtureProductCandidates("2026-08-03"),
  });

  assert.equal(drafts.length, 2);
  assert.deepEqual(drafts.map((draft) => draft.product_name), ["대용량 머리끈", "케이블 정리 클립"]);
  assert.deepEqual(drafts.map((draft) => draft.recommended_publish_time), ["11:30 KST", "18:00 KST"]);
  assert.match(drafts[0].threads_text, /머리끈 맨날 잃어버리는 사람/);
  assert.ok(drafts.every((draft) => validateLifemagazineDraft(draft).ok));
});

test("lifemagazine daily product generator can target only a remaining slot", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-remaining-slot-"));
  const drafts = generateDailyProductDrafts({
    root: tmp,
    date: "2026-08-12",
    now: "2026-08-12T07:00:00.000Z",
    slots: [{ slot: "evening", time: "18:00", label: "저녁 생활템" }],
    candidates: fixtureProductCandidates("2026-08-12"),
  });

  assert.equal(drafts.length, 1);
  assert.match(drafts[0].id, /-evening-/);
  assert.equal(drafts[0].recommended_publish_time, "18:00 KST");
});

test("Coupang API candidate requires a partner link and keeps sensitive products out of auto-selection", () => {
  const safe = buildCoupangCandidate({
    product_id: "safe-1",
    product_name: "케이블 정리 클립 20개",
    product_url: "https://link.coupang.com/a/safe-example",
    product_image: "https://image.example.com/clip.jpg",
    category_name: "생활용품",
  }, {
    keyword: "케이블 정리 클립",
    recommendation_reason: "충전선 정리에 쓰기 좋아서",
    when_to_use: "책상 위 충전선이 엉킬 때",
    usage_guidance: "케이블 굵기를 확인하고 붙여 써",
  });
  const notAffiliate = buildCoupangCandidate({ product_name: "케이블 정리 클립", product_url: "https://www.coupang.com/vp/products/1" }, {});
  const sensitive = normalizeProductCandidate({
    source: "coupang_api",
    product_name: "어린이 비타민",
    affiliate_url: "https://link.coupang.com/a/sensitive-example",
    recommendation_reason: "영양 보충",
    when_to_use: "매일",
  });

  assert.equal(safe.affiliate_url, "https://link.coupang.com/a/safe-example");
  assert.equal(notAffiliate, null);
  assert.equal(selectDailyProductCandidates([safe, sensitive], 2).length, 1);
});

