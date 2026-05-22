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

async function telegram(method, body) {
  const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok || json.ok === false) throw new Error(`${method} failed: ${text}`);
  return json;
}

async function telegramGet(method) {
  const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`);
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok || json.ok === false) throw new Error(`${method} failed: ${text}`);
  return json;
}

async function graphGet(pathname, params) {
  const url = new URL(`https://graph.threads.net/v1.0/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return json;
}

function kstParts(options) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    ...options,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map((item) => [item.type, item.value]));
}

function todayKst() {
  const parts = kstParts({ year: "numeric", month: "2-digit", day: "2-digit" });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isBeforeDailyPreviewWindow() {
  const parts = kstParts({ hour: "2-digit", minute: "2-digit", hour12: false });
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return hour < 17 || (hour === 17 && minute < 30);
}

async function sendHealth(text) {
  const body = new FormData();
  body.set("chat_id", process.env.OFFNOTE_TELEGRAM_CHAT_ID);
  body.set("text", text);
  await telegram("sendMessage", body);
}

loadEnv();

const errors = [];
const notes = [];
const today = todayKst();

try {
  if (!process.env.OFFNOTE_TELEGRAM_BOT_TOKEN || !process.env.OFFNOTE_TELEGRAM_CHAT_ID) {
    throw new Error("OFFNOTE_TELEGRAM_BOT_TOKEN or OFFNOTE_TELEGRAM_CHAT_ID is missing.");
  }
  const me = await telegramGet("getMe");
  if (me.result?.username !== "offnote_threads_bot") {
    errors.push(`Telegram bot mismatch: @${me.result?.username || "unknown"}`);
  } else {
    notes.push("Telegram: offnote_threads_bot OK");
  }
} catch (error) {
  errors.push(`Telegram check failed: ${error.message}`);
}

try {
  const profile = await graphGet("me", {
    fields: "id,username,name",
    access_token: process.env.THREADS_ACCESS_TOKEN,
  });
  if (profile.username !== "offnote.kr") {
    errors.push(`Threads token mismatch: @${profile.username}`);
  } else {
    notes.push("Threads: offnote.kr OK");
  }
} catch (error) {
  errors.push(`Threads check failed: ${error.message}`);
}

const todayDir = path.join("outputs", "afterwork-profit", "automation", today);
const todayDrafts = findJsonFiles(todayDir)
  .map((file) => {
    try {
      return { file, data: readJson(file) };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .filter((item) => item.data.account === "offnote.kr");

const activeDraft = todayDrafts.find((item) => ["pending_approval", "published"].includes(item.data.status));
if (activeDraft) {
  notes.push(`Today draft: ${activeDraft.data.id} ${activeDraft.data.status}`);
} else if (isBeforeDailyPreviewWindow()) {
  notes.push(`Today draft: not created yet before 17:30 KST preview window (${today})`);
} else {
  errors.push(`No pending/published offnote draft found for ${today}.`);
}

const text = errors.length
  ? `[오프노트 자동화 점검 실패]\n\n${errors.map((item) => `- ${item}`).join("\n")}\n\n${notes.join("\n")}`
  : `[오프노트 자동화 점검 OK]\n\n${notes.join("\n")}`;

await sendHealth(text);

if (errors.length) {
  console.error(text);
  process.exit(1);
}

console.log(text);

