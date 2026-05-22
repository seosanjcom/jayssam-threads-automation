import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsonFiles(full));
    if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function latestOffnoteDraft(root) {
  const automationRoot = path.join(root, "outputs", "afterwork-profit", "automation");
  return findJsonFiles(automationRoot)
    .map((file) => {
      try {
        return { file, data: readJson(file), mtime: fs.statSync(file).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => item.data.account === "offnote.kr" && item.data.status !== "deleted_after_mojibake_publish")
    .sort((a, b) => b.mtime - a.mtime)[0];
}

function trimTelegram(text, max = 3600) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}\n\n...`;
}

function commentPreview(draft) {
  const comments = draft.thread_comments || draft.reply_comments || draft.comment_replies || draft.comments;
  if (!Array.isArray(comments) || comments.length === 0) return "";
  return comments
    .slice(0, 5)
    .map((item, index) => {
      const text = typeof item === "string" ? item : item.text || item.body || item.comment || "";
      return text ? `댓글 ${index + 1}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

async function telegram(method, body) {
  const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.ok === false) {
    throw new Error(`${method} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

loadEnv();

const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.OFFNOTE_TELEGRAM_CHAT_ID || "";
if (!token || token.includes("replace_") || !chatId || chatId.includes("replace_")) {
  console.log("Telegram is not configured. Set OFFNOTE_TELEGRAM_BOT_TOKEN and OFFNOTE_TELEGRAM_CHAT_ID.");
  process.exit(2);
}

const root = process.cwd();
const draftArg = process.argv[2];
const draftItem = draftArg
  ? { file: path.resolve(draftArg), data: readJson(path.resolve(draftArg)) }
  : latestOffnoteDraft(root);

if (!draftItem) throw new Error("No offnote.kr draft found.");

const draft = draftItem.data;
if (draft.status === "approved") {
  draft.status = "pending_approval";
  draft.approval_requested_at = new Date().toISOString();
  writeJson(draftItem.file, draft);
}

const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";
const commentsText = commentPreview(draft);
const message = trimTelegram(
  [
    "[오프노트 미리보기]",
    `ID: ${draft.id || path.basename(draftItem.file, ".json")}`,
    `상태: ${draft.status || "draft"}`,
    draft.recommended_publish_time ? `권장 발행: ${draft.recommended_publish_time}` : "",
    draft.experiment_hypothesis ? `오늘의 가설: ${draft.experiment_hypothesis}` : "",
    runUrl ? `실행 로그: ${runUrl}` : "",
    "",
    "아래 버튼에서 승인하면 offnote.kr 계정으로만 발행합니다.",
    "버튼이 안 먹으면 이 채팅에 '승인' 또는 '승인 ID'라고 보내면 됩니다.",
    "",
    "[본문]",
    draft.threads_text || "",
    commentsText ? "\n[댓글 확장 초안]" : "",
    commentsText,
  ]
    .filter(Boolean)
    .join("\n"),
);

const messageBody = new FormData();
messageBody.set("chat_id", chatId);
messageBody.set("text", message);
messageBody.set("disable_web_page_preview", "true");
messageBody.set(
  "reply_markup",
  JSON.stringify({
    inline_keyboard: [
      [
        { text: "승인하고 발행", callback_data: `offnote:approve:${draft.id || path.basename(draftItem.file, ".json")}` },
        { text: "보류", callback_data: `offnote:hold:${draft.id || path.basename(draftItem.file, ".json")}` },
      ],
    ],
  }),
);
await telegram("sendMessage", messageBody);

const images = Array.isArray(draft.local_media_paths) ? draft.local_media_paths : [];
const urls = Array.isArray(draft.media_urls) ? draft.media_urls : [];
const imagePaths = images
  .map((item) => (path.isAbsolute(item) ? item : path.join(root, item)))
  .filter((item) => fs.existsSync(item))
  .slice(0, 10);

if (imagePaths.length) {
  for (let index = 0; index < imagePaths.length; index += 1) {
    const body = new FormData();
    body.set("chat_id", chatId);
    body.set("photo", new Blob([fs.readFileSync(imagePaths[index])], { type: "image/png" }), path.basename(imagePaths[index]));
    if (index === 0) body.set("caption", `카드뉴스 ${imagePaths.length}장`);
    await telegram("sendPhoto", body);
  }
} else if (urls.length) {
  for (let index = 0; index < Math.min(urls.length, 10); index += 1) {
    const body = new FormData();
    body.set("chat_id", chatId);
    body.set("photo", urls[index]);
    if (index === 0) body.set("caption", `카드뉴스 ${urls.length}장`);
    await telegram("sendPhoto", body);
  }
}

console.log(`Sent Telegram preview for ${draft.id || draftItem.file}`);
