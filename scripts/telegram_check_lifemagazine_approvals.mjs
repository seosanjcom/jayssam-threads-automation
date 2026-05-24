import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const automationRoot = path.join(root, "outputs", "lifemagazine", "automation");
const statePath = path.join(root, "outputs", "lifemagazine", "telegram-approval-state.json");

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function findDraftById(id) {
  return findJsonFiles(automationRoot)
    .map((file) => {
      try {
        return { file, data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .find((item) =>
      item.data.account === "lifemagazine_" &&
      (item.data.id === id || item.data.telegram_approval_token === id) &&
      item.data.status !== "published"
    );
}

export function applyLifemagazineApprovalAction(draft, action) {
  if (draft.account !== "lifemagazine_") throw new Error(`Refusing to update non-lifemagazine draft: ${draft.account}`);
  if (draft.status !== "pending_approval") throw new Error(`Draft must be pending_approval, got ${draft.status}`);
  if (action === "approve") {
    return { ...draft, status: "approved", approved_at: new Date().toISOString(), publish_on_approve: false };
  }
  if (action === "hold") {
    return { ...draft, status: "held", held_at: new Date().toISOString() };
  }
  throw new Error(`Unknown lifemagazine approval action: ${action}`);
}

async function telegram(method, body) {
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok || json.ok === false) throw new Error(`${method} failed: ${text}`);
  return json;
}

async function sendMessage(text) {
  const body = new FormData();
  body.set("chat_id", process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID);
  body.set("text", text);
  return telegram("sendMessage", body);
}

async function handleCallback(callback) {
  if (!callback?.data?.startsWith("lifemagazine:") && !callback?.data?.startsWith("life:")) return;
  const [, action, id] = callback.data.split(":");
  const item = findDraftById(id);
  if (!item) {
    await sendMessage(`lifemagazine approval failed: draft not found (${id})`);
    return;
  }
  const updated = applyLifemagazineApprovalAction(item.data, action);
  writeJson(item.file, updated);
  const suffix = updated.status === "approved"
    ? "정해진 발행 시간에 publish가 처리돼."
    : "보류 상태로 바꿨어.";
  await sendMessage(`lifemagazine_ ${updated.status}: ${id}\n${suffix}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (!token || !chatId || token.includes("replace_") || chatId.includes("replace_")) {
    console.log("Telegram approval checker skipped: LIFEMAGAZINE_TELEGRAM_BOT_TOKEN or LIFEMAGAZINE_TELEGRAM_CHAT_ID is missing.");
    process.exit(0);
  }

  const state = readJsonIfExists(statePath, { offset: 0 });
  const updates = await telegram("getUpdates", new URLSearchParams({
    offset: String(Number(state.offset || 0) + 1),
    timeout: "0",
  }));
  let maxOffset = Number(state.offset || 0);
  for (const update of updates.result || []) {
    maxOffset = Math.max(maxOffset, update.update_id);
    await handleCallback(update.callback_query);
  }
  writeJson(statePath, { offset: maxOffset, checked_at: new Date().toISOString() });
}
