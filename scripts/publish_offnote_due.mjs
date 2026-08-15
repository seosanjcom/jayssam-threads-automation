import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function todayKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function collectText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

function isShoppingRouteContent(draft) {
  const text = collectText({
    topic: draft.topic,
    threads_text: draft.threads_text,
    thread_comments: draft.thread_comments,
    cardnews_slides: draft.cardnews_slides,
  });
  return [
    /제휴\s*링크/,
    /구매\s*링크/,
    /상품\s*링크/,
    /댓글에.*(?:링크|정보)/,
    /DM.*링크/,
    /연예인.*(?:제품|착용|사용|추천|템)/,
    /(?:유튜브|인스타|릴스).*나온.*(?:제품|템)/,
    /(?:민경|소유|환연|아이돌|배우|셀럽).*님/,
    /추천템/,
  ].some((pattern) => pattern.test(text));
}

async function telegram(method, body) {
  const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN;
  if (!token || !process.env.OFFNOTE_TELEGRAM_CHAT_ID) return null;
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

async function sendMessage(text) {
  const body = new FormData();
  body.set("chat_id", process.env.OFFNOTE_TELEGRAM_CHAT_ID);
  body.set("text", text);
  body.set("disable_web_page_preview", "true");
  await telegram("sendMessage", body);
}

loadEnv();

const root = process.cwd();
const date = process.argv[2] || todayKst();
const slot = process.argv[3] || "evening";
const automationRoot = path.join(root, "outputs", "afterwork-profit", "automation", date);
const drafts = findJsonFiles(automationRoot)
  .map((file) => {
    try {
      return { file, data: readJson(file), mtime: fs.statSync(file).mtimeMs };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .filter((item) => item.data.account === "offnote.kr");

const slotDrafts = drafts.filter((item) => String(item.data.id || "").includes(`-${slot}-`));
const pending = slotDrafts
  .filter((item) => ["pending_approval", "approved"].includes(item.data.status))
  .sort((a, b) => b.mtime - a.mtime)[0];

const alreadyPublished = slotDrafts.find((item) => item.data.status === "published");
if (alreadyPublished) {
  console.log(`Offnote ${slot} slot already published for ${date}: ${alreadyPublished.data.id}. Auto-publish skipped.`);
  process.exit(0);
}

const intentionalHold = slotDrafts
  .filter((item) => ["held_missing_detail", "held_validation_failed"].includes(item.data.status))
  .sort((a, b) => b.mtime - a.mtime)[0];
if (intentionalHold) {
  console.log(`Offnote ${slot} slot intentionally held for ${date}: ${intentionalHold.data.hold_reason || intentionalHold.data.status}`);
  process.exit(0);
}

if (!pending) {
  console.log(`No pending offnote draft to auto-publish for ${date} ${slot}.`);
  process.exit(0);
}

const draft = pending.data;
if (isShoppingRouteContent(draft)) {
  draft.status = "held";
  draft.held_at = new Date().toISOString();
  draft.hold_reason = "shopping/product-route content belongs to lifemagazine_, not offnote.kr";
  writeJson(pending.file, draft);
  await sendMessage(`[오프노트 발행 보류]\n${draft.id}\n쇼핑/상품형 소재라 lifemagazine_로 보내야 해서 발행을 멈췄어.`);
  console.log(`Held offnote draft because it belongs to lifemagazine_: ${draft.id}`);
  process.exit(0);
}
draft.status = "approved";
draft.approved_at = draft.approved_at || new Date().toISOString();
draft.approval_source = `automatic_schedule:${slot}`;
writeJson(pending.file, draft);

const result = spawnSync("node", ["scripts/threads_publish.mjs", pending.file], {
  cwd: root,
  shell: true,
  encoding: "utf8",
  env: {
    ...process.env,
    THREADS_AUTO_PUBLISH: "true",
    THREADS_VERIFY_PROFILE_BEFORE_PUBLISH: "true",
    THREADS_EXPECTED_USERNAME: "offnote.kr",
    THREADS_CAROUSEL_ENABLED: "false",
    THREADS_REQUIRE_MEDIA: "false",
    THREADS_PUBLISH_REPLIES: "true",
  },
});

if (result.status !== 0) {
  const failed = readJson(pending.file);
  failed.status = "publish_failed";
  failed.publish_failed_at = new Date().toISOString();
  failed.publish_error = `${result.stderr || ""}${result.stdout || ""}`.trim();
  writeJson(pending.file, failed);
  await sendMessage(`[오프노트 자동 발행 실패]\n${draft.id}\n${failed.publish_error.slice(0, 1200)}`);
  throw new Error(failed.publish_error);
}

const published = readJson(pending.file);
published.status = "published";
published.published_at = new Date().toISOString();
published.auto_publish = {
  slot,
  approved_at: draft.approved_at,
};
writeJson(pending.file, published);
await sendMessage(`[오프노트 자동 발행 완료]\n${draft.id}\n본문과 댓글 확장까지 발행했습니다.`);
console.log(result.stdout);
