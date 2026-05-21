import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const automationRoot = path.join(root, "outputs", "automation");
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function walkJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function localImagesForDraft(draft) {
  if (!draft.local_card_dir) return [];
  const dir = path.resolve(root, draft.local_card_dir);
  if (!dir.startsWith(root) || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(dir, name));
}

function splitMessage(text, max = 3500) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > max) {
    const cut = remaining.lastIndexOf("\n", max);
    const at = cut > 500 ? cut : max;
    chunks.push(remaining.slice(0, at));
    remaining = remaining.slice(at).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function telegram(method, body, isForm = false) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    body: isForm ? body : JSON.stringify(body),
    headers: isForm ? undefined : { "Content-Type": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function sendMessage(text) {
  for (const chunk of splitMessage(text)) {
    await telegram("sendMessage", {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: chunk,
      disable_web_page_preview: true,
    });
  }
}

async function sendPhoto(filePath, caption = "") {
  const form = new FormData();
  form.set("chat_id", process.env.TELEGRAM_CHAT_ID);
  if (caption) form.set("caption", caption.slice(0, 1000));
  const data = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  form.set("photo", new Blob([data], { type }), path.basename(filePath));
  await telegram("sendPhoto", form, true);
}

function findNextDraft() {
  const publishedIds = new Set(readJson(publishLogPath, []).map((item) => item.draft_id));
  const candidates = walkJson(automationRoot)
    .map((file) => ({ file, draft: readJson(file), mtime: fs.statSync(file).mtimeMs }))
    .filter((item) => item.draft?.id && item.draft?.threads_text)
    .filter((item) => !publishedIds.has(item.draft.id))
    .filter((item) => ["approved", "ready_to_review"].includes(item.draft.status))
    .sort((a, b) => {
      const rank = (status) => (status === "approved" ? 0 : 1);
      return rank(a.draft.status) - rank(b.draft.status) || b.mtime - a.mtime;
    });
  return candidates[0] || null;
}

loadEnv();

const telegramBotToken = process.env.JAYSSAM_TELEGRAM_BOT_TOKEN || "";
const telegramChatId = process.env.JAYSSAM_TELEGRAM_CHAT_ID || "";
const hasTelegramConfig =
  telegramBotToken &&
  telegramChatId &&
  !telegramBotToken.startsWith("replace_") &&
  !telegramChatId.startsWith("replace_");

if (!hasTelegramConfig) {
  console.log("Jayssam Telegram preview skipped: JAYSSAM_TELEGRAM_BOT_TOKEN or JAYSSAM_TELEGRAM_CHAT_ID is missing in .env");
  process.exit(0);
}

const next = findNextDraft();
if (!next) {
  await sendMessage("[제이쌤 미리보기]\n아직 보낼 게시 후보가 없습니다. approved 또는 ready_to_review 큐가 생기면 다시 보냅니다.");
  console.log("No preview draft found.");
  process.exit(0);
}

const { draft, file } = next;
const title = draft.title || draft.topic || draft.id;
const images = localImagesForDraft(draft);
const slides = Array.isArray(draft.carousel_slides) ? draft.carousel_slides : [];
const sources = [
  ...(Array.isArray(draft.sources) ? draft.sources : []),
  ...(Array.isArray(draft.source_urls) ? draft.source_urls : []),
].filter(Boolean);

const message = [
  `[제이쌤 게시 전 미리보기]`,
  `상태: ${draft.status}`,
  `제목: ${title}`,
  `파일: ${path.relative(root, file)}`,
  "",
  "[Threads 본문]",
  draft.threads_text,
  slides.length ? `\n[카드 문구]\n${slides.map((slide, i) => `${i + 1}. ${slide}`).join("\n\n")}` : "",
  sources.length ? `\n[출처]\n${sources.join("\n")}` : "",
].filter(Boolean).join("\n");

await sendMessage(message);

for (const [index, image] of images.entries()) {
  await sendPhoto(image, `${index + 1}/${images.length} ${title}`);
}

console.log(`Sent Telegram preview for ${draft.id}`);
