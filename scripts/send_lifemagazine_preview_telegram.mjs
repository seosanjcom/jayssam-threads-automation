import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function trimTelegram(text, max = 3600) {
  return text.length <= max ? text : `${text.slice(0, max - 20)}\n\n...`;
}

function commentsPreview(draft) {
  const comments = Array.isArray(draft.thread_comments) ? draft.thread_comments : [];
  return comments.map((comment, index) => `댓글 ${index + 1}\n${comment}`).join("\n\n");
}

export function prepareLifemagazinePreviewDraft(draft, now = new Date().toISOString()) {
  if (draft.account !== "lifemagazine_") throw new Error(`Not a lifemagazine_ draft: ${draft.account}`);
  const approvalToken = draft.telegram_approval_token || crypto.createHash("sha256").update(String(draft.id)).digest("hex").slice(0, 16);
  if (draft.status === "ready_to_review" || draft.status === "draft") {
    return {
      ...draft,
      status: "pending_approval",
      approval_requested_at: now,
      telegram_approval_token: approvalToken,
    };
  }
  return { ...draft, telegram_approval_token: approvalToken };
}

export function buildLifemagazineTelegramMessage(draft, options = {}) {
  const runUrl = options.runUrl || "";
  return trimTelegram([
    "[라이프매거진 미리보기]",
    `ID: ${draft.id}`,
    `상태: ${draft.status}`,
    `예정: ${draft.recommended_publish_time || ""}`,
    `말투: ${draft.tone_label || draft.tone_style || ""}`,
    `제품 관계: ${draft.product_relationship || ""}`,
    runUrl ? `실행 로그: ${runUrl}` : "",
    "",
    "마음에 들면 '승인'을 눌러줘. 승인하면 approved 상태가 되고, 정해진 발행 시간에 publish가 처리돼.",
    "애매하면 '보류'를 눌러두면 돼.",
    "",
    "[본문]",
    draft.threads_text || "",
    "",
    "[이미지/비주얼]",
    `방식: ${draft.visual_mode || (Array.isArray(draft.media_urls) && draft.media_urls.length ? "media_url" : "none")}`,
    draft.visual_review_status ? `검수상태: ${draft.visual_review_status}` : "",
    draft.visual_prompt ? `프롬프트: ${draft.visual_prompt}` : "",
    Array.isArray(draft.visual_avoid_list) && draft.visual_avoid_list.length
      ? `금지요소: ${draft.visual_avoid_list.slice(0, 12).join(", ")}${draft.visual_avoid_list.length > 12 ? "..." : ""}`
      : "",
    Array.isArray(draft.media_urls) && draft.media_urls.length ? `이미지 URL: ${draft.media_urls.join("\n")}` : "",
    "",
    "[댓글 초안]",
    commentsPreview(draft),
  ].filter(Boolean).join("\n"));
}

async function telegram(method, body) {
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.ok === false) throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  return json;
}

export async function sendLifemagazinePreview(draftPath, options = {}) {
  const workspaceRoot = options.root || root;
  const fullPath = path.resolve(workspaceRoot, draftPath);
  const draft = prepareLifemagazinePreviewDraft(readJson(fullPath));
  writeJson(fullPath, draft);

  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";

  const body = new FormData();
  body.set("chat_id", process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID);
  body.set("text", buildLifemagazineTelegramMessage(draft, { runUrl }));
  body.set("disable_web_page_preview", "true");
  body.set("reply_markup", JSON.stringify({
    inline_keyboard: [[
      { text: "승인", callback_data: `life:approve:${draft.telegram_approval_token}` },
      { text: "보류", callback_data: `life:hold:${draft.telegram_approval_token}` },
    ]],
  }));
  await telegram("sendMessage", body);

  for (const item of (Array.isArray(draft.local_media_paths) ? draft.local_media_paths : []).slice(0, 10)) {
    const imagePath = path.isAbsolute(item) ? item : path.join(workspaceRoot, item);
    if (!fs.existsSync(imagePath)) continue;
    const photo = new FormData();
    photo.set("chat_id", process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID);
    photo.set("photo", new Blob([fs.readFileSync(imagePath)], { type: "image/png" }), path.basename(imagePath));
    await telegram("sendPhoto", photo);
  }

  return { ok: true, id: draft.id, status: draft.status, draftPath: fullPath };
}

export function buildLifemagazineAutoPublishNotice(draft, options = {}) {
  const runUrl = options.runUrl || "";
  return trimTelegram([
    "[라이프매거진 자동 발행 예정]",
    `예정: ${draft.recommended_publish_time || ""}`,
    `상품: ${draft.product_name || draft.topic || draft.id}`,
    `생활 대상: ${draft.product_metadata?.lifestyle_group || draft.lifestyle_group || "생활 장면 기준 선별"}`,
    `카테고리 순위: ${draft.product_metadata?.category_rank ? `${draft.product_metadata.category_rank}위` : "상위권 후보 검토 완료"}`,
    runUrl ? `실행 로그: ${runUrl}` : "",
    "",
    "승인 대기 없이 정해진 시각에 자동 발행해. 발행되면 완료 메시지도 바로 보낼게.",
    "",
    "[본문]",
    draft.threads_text || "",
    commentsPreview(draft) ? `\n[댓글 고지]\n${commentsPreview(draft)}` : "",
  ].filter(Boolean).join("\n"));
}

export async function sendLifemagazineAutoPublishNotice(draftPath, options = {}) {
  const workspaceRoot = options.root || root;
  const fullPath = path.resolve(workspaceRoot, draftPath);
  const draft = readJson(fullPath);
  if (draft.account !== "lifemagazine_") throw new Error(`Not a lifemagazine_ draft: ${draft.account}`);

  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";
  const body = new FormData();
  body.set("chat_id", process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID);
  body.set("text", buildLifemagazineAutoPublishNotice(draft, { runUrl }));
  body.set("disable_web_page_preview", "true");
  await telegram("sendMessage", body);
  return { ok: true, id: draft.id, status: draft.status, draftPath: fullPath };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (!token || !chatId || token.includes("replace_") || chatId.includes("replace_")) {
    console.log("Telegram is not configured. Set LIFEMAGAZINE_TELEGRAM_BOT_TOKEN and LIFEMAGAZINE_TELEGRAM_CHAT_ID.");
    process.exit(2);
  }
  const draftPath = process.argv[2];
  if (!draftPath) {
    console.error("Usage: node scripts/send_lifemagazine_preview_telegram.mjs DRAFT_JSON");
    process.exit(1);
  }
  const result = await sendLifemagazinePreview(draftPath);
  console.log(`Sent Telegram preview for ${result.id}`);
}
