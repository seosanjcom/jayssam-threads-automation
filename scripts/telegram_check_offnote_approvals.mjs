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

function readJson(file, fallback = null) {
  if (!fs.existsSync(file)) return fallback;
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

function findDraftById(root, id) {
  const automationRoot = path.join(root, "outputs", "afterwork-profit", "automation");
  return findJsonFiles(automationRoot)
    .map((file) => {
      try {
        return { file, data: readJson(file) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .find((item) =>
      item.data.account === "offnote.kr" &&
      (item.data.id === id || item.data.telegram_approval_token === id) &&
      item.data.status !== "published"
    );
}

function findLatestPendingDraft(root) {
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
    .filter((item) => item.data.account === "offnote.kr" && item.data.status === "pending_approval")
    .sort((a, b) => b.mtime - a.mtime)[0];
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

async function sendMessage(text) {
  const body = new FormData();
  body.set("chat_id", process.env.OFFNOTE_TELEGRAM_CHAT_ID);
  body.set("text", text);
  await telegram("sendMessage", body);
}

async function answerCallback(callbackId, text) {
  const body = new FormData();
  body.set("callback_query_id", callbackId);
  body.set("text", text);
  try {
    await telegram("answerCallbackQuery", body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("query is too old") && !message.includes("query ID is invalid")) {
      throw error;
    }
    console.log(`Callback answer skipped: ${message}`);
  }
}

async function publishDraft(root, draftItem, approvalSource) {
  const draft = draftItem.data;
  if (draft.status === "published") {
    await sendMessage(`offnote.kr already published: ${draft.id}`);
    return;
  }
  const retryableStatuses = new Set(["pending_approval", "approved", "publish_failed"]);
  if (!retryableStatuses.has(draft.status)) {
    await sendMessage(`offnote.kr not published: ${draft.id} is status=${draft.status}.`);
    return;
  }

  const isRetry = draft.status === "approved" || draft.status === "publish_failed";
  draft.status = "approved";
  draft.approved_at = draft.approved_at || new Date().toISOString();
  draft.approval_source = approvalSource;
  if (isRetry) draft.publish_retry_requested_at = new Date().toISOString();
  writeJson(draftItem.file, draft);

  const result = spawnSync("node", ["scripts/threads_publish.mjs", draftItem.file], {
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
    },
  });

  if (result.status === 0) {
    const updated = readJson(draftItem.file);
    updated.status = "published";
    updated.published_at = new Date().toISOString();
    updated.telegram_approval = {
      source: approvalSource,
      approved_at: draft.approved_at,
    };
    writeJson(draftItem.file, updated);
    await sendMessage(`offnote.kr published: ${draft.id}`);
    return;
  }

  const failed = readJson(draftItem.file);
  failed.status = "publish_failed";
  failed.publish_failed_at = new Date().toISOString();
  failed.publish_error = `${result.stderr || ""}${result.stdout || ""}`.trim();
  writeJson(draftItem.file, failed);
  await sendMessage(`offnote.kr publish failed: ${draft.id}\n${failed.publish_error.slice(0, 1200)}`);
}

loadEnv();

const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.OFFNOTE_TELEGRAM_CHAT_ID || "";
if (!token || token.includes("replace_") || !chatId || chatId.includes("replace_")) {
  console.log("Telegram approval checker skipped: OFFNOTE_TELEGRAM_BOT_TOKEN or OFFNOTE_TELEGRAM_CHAT_ID is missing.");
  process.exit(0);
}

const root = process.cwd();
const statePath = path.join(root, "outputs", "afterwork-profit", "telegram-approval-state.json");
const errorPath = path.join(
  root,
  "outputs",
  "afterwork-profit",
  "automation",
  "offnote-telegram-approval-checker-last-error.json",
);

function normalizeError(err) {
  if (!(err instanceof Error)) return { message: String(err) };
  const cause = err.cause;
  const out = { name: err.name, message: err.message, stack: err.stack };
  if (cause && typeof cause === "object") out.cause = cause;
  return out;
}

try {
  const state = readJson(statePath, { offset: 0, processed_callbacks: [] });
  const offset = Number(state.offset || 0);

  const updatesUrl = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  updatesUrl.searchParams.set("timeout", "0");
  updatesUrl.searchParams.set("allowed_updates", JSON.stringify(["message", "callback_query"]));
  if (offset > 0) updatesUrl.searchParams.set("offset", String(offset));

  const res = await fetch(updatesUrl);
  const json = await res.json();
  if (!json.ok) throw new Error(JSON.stringify(json));

  let nextOffset = offset;
  const processed = new Set(state.processed_callbacks || []);

  for (const update of json.result || []) {
    nextOffset = Math.max(nextOffset, Number(update.update_id) + 1);
    const message = update.message;
    if (message?.text) {
      const fromChat = message.chat?.id;
      if (String(fromChat) !== String(chatId)) continue;
      const text = String(message.text || "").trim();
      const [command = "", draftIdFromText = ""] = text.split(/\s+/, 2);
      const normalizedCommand = command.toLowerCase();
      const approveCommands = new Set(["\uC2B9\uC778", "\uBC1C\uD589", "\uAC8C\uC2DC", "approve", "publish"]);
      const holdCommands = new Set(["\uBCF4\uB958", "hold"]);

      if (approveCommands.has(normalizedCommand)) {
        const draftId = draftIdFromText || "";
        const draftItem = draftId ? findDraftById(root, draftId) : findLatestPendingDraft(root);
        if (!draftItem) {
          await sendMessage(`offnote approval failed: pending draft not found${draftId ? ` (${draftId})` : ""}`);
          continue;
        }
        await publishDraft(root, draftItem, `telegram_text:${text}`);
        continue;
      }

      if (holdCommands.has(normalizedCommand)) {
        const draftId = draftIdFromText || "";
        const draftItem = draftId ? findDraftById(root, draftId) : findLatestPendingDraft(root);
        if (!draftItem) {
          await sendMessage(`offnote hold failed: pending draft not found${draftId ? ` (${draftId})` : ""}`);
          continue;
        }
        const draft = draftItem.data;
        draft.status = "held";
        draft.held_at = new Date().toISOString();
        draft.hold_source = `telegram_text:${text}`;
        writeJson(draftItem.file, draft);
        await sendMessage(`offnote.kr held: ${draft.id}`);
        continue;
      }
    }

    const callback = update.callback_query;
    if (!callback?.data?.startsWith("offnote:")) continue;
    if (processed.has(callback.id)) continue;
    processed.add(callback.id);

    const fromChat = callback.message?.chat?.id;
    if (String(fromChat) !== String(chatId)) {
      await answerCallback(callback.id, "This bot is not connected to this chat.");
      continue;
    }

    const [, action, draftId] = callback.data.split(":");
    const draftItem = findDraftById(root, draftId);
    if (!draftItem) {
      await answerCallback(callback.id, "Draft not found.");
      await sendMessage(`offnote approval failed: draft not found (${draftId})`);
      continue;
    }

    const draft = draftItem.data;
    if (action === "hold") {
      draft.status = "held";
      draft.held_at = new Date().toISOString();
      writeJson(draftItem.file, draft);
      await answerCallback(callback.id, "Held.");
      await sendMessage(`offnote.kr held: ${draftId}`);
      continue;
    }

    if (action !== "approve") continue;
    if (draft.status === "published") {
      await answerCallback(callback.id, "Already published.");
      continue;
    }
    if (!["pending_approval", "approved", "publish_failed"].includes(draft.status)) {
      await answerCallback(callback.id, "This draft cannot be published now.");
      await sendMessage(`offnote.kr not published: ${draftId} is status=${draft.status}.`);
      continue;
    }

    await answerCallback(callback.id, draft.status === "pending_approval" ? "Publishing..." : "Retrying publication...");
    await publishDraft(root, draftItem, `telegram_callback:${callback.id}`);
  }

  state.offset = nextOffset;
  state.processed_callbacks = [...processed].slice(-200);
  writeJson(statePath, state);

  if (fs.existsSync(errorPath)) fs.unlinkSync(errorPath);
  console.log(`Checked Telegram approvals. Updates=${json.result?.length || 0}`);
} catch (err) {
  writeJson(errorPath, { at: new Date().toISOString(), error: normalizeError(err) });
  console.error(err);
  process.exit(1);
}
