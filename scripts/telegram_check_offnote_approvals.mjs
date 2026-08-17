import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  formatSchedule,
  kstDate,
  kstTime,
  loadSchedule,
  timeToMinutes,
  updateSlotTimes,
} from "./offnote_schedule.mjs";

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
  if (process.env.OFFNOTE_TELEGRAM_DRY_RUN === "true" && method !== "getUpdates") {
    console.log(`[telegram dry-run] ${method}: ${body?.get?.("text") || body?.get?.("callback_query_id") || ""}`);
    return { ok: true, result: { dry_run: true } };
  }
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

async function getUpdates(token, offset) {
  const fixture = process.env.OFFNOTE_TELEGRAM_UPDATES_FILE;
  if (fixture) {
    const raw = readJson(fixture, []);
    return Array.isArray(raw) ? raw : Array.isArray(raw.result) ? raw.result : [];
  }
  const updatesUrl = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  updatesUrl.searchParams.set("timeout", "0");
  updatesUrl.searchParams.set("allowed_updates", JSON.stringify(["message", "callback_query"]));
  if (offset > 0) updatesUrl.searchParams.set("offset", String(offset));
  const res = await fetch(updatesUrl);
  const json = await res.json();
  if (!json.ok) throw new Error(JSON.stringify(json));
  return json.result || [];
}

async function sendMessage(text) {
  const body = new FormData();
  body.set("chat_id", process.env.OFFNOTE_TELEGRAM_CHAT_ID);
  body.set("text", text);
  body.set("disable_web_page_preview", "true");
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
    if (!message.includes("query is too old") && !message.includes("query ID is invalid")) throw error;
    console.log(`Callback answer skipped: ${message}`);
  }
}

function testOrCurrentDate() {
  return process.env.OFFNOTE_TEST_DATE || kstDate();
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dailyFactsPath(root, date) {
  return path.join(root, "outputs", "afterwork-profit", "offnote-daily-facts", `${date}.json`);
}

function readDailyFacts(root, date) {
  const raw = readJson(dailyFactsPath(root, date), { date, facts: [] });
  return {
    date,
    facts: Array.isArray(raw) ? raw : Array.isArray(raw.facts) ? raw.facts : [],
    prepared_at: raw.prepared_at || "",
  };
}

function manualFactId(date, update) {
  const suffix = String(update.update_id || Date.now()).replace(/[^0-9A-Za-z_-]/g, "");
  return `telegram-${date.replaceAll("-", "")}-${suffix || Date.now()}`;
}

function prioritySlotFor(root, date) {
  const schedule = loadSchedule(root);
  const routingNow = process.env.OFFNOTE_TEST_NOW ? new Date(process.env.OFFNOTE_TEST_NOW) : new Date();
  const now = timeToMinutes(kstTime(routingNow));
  const evening = timeToMinutes(schedule.slots.evening);
  const night = timeToMinutes(schedule.slots.night);
  const facts = readDailyFacts(root, date).facts;
  const taken = new Set(facts.map((fact) => fact?.priority_slot).filter(Boolean));

  const preferred = now < evening ? ["evening", "night"] : now < night ? ["night"] : [];
  for (const slot of preferred) {
    if (!taken.has(slot)) return { date, slot };
  }
  return { date: addDays(date, 1), slot: "evening" };
}

function cleanManualText(text) {
  return String(text || "")
    .trim()
    .replace(/^(?:\/record|\/기록|\/오프노트|기록|긴급(?:\s*메시지)?)[\s:：-]*/i, "")
    .trim();
}

function saveManualFact(root, text, update) {
  const cleanText = cleanManualText(text);
  if (cleanText.length < 8) throw new Error("수동 기록은 8자 이상 보내줘.");
  if (cleanText.length > 500) throw new Error("수동 기록은 500자 이내로 보내줘.");
  if (/쿠팡\s*상품|상품\s*링크|제휴\s*링크|카톡방|댓글.*(?:남겨|알려|달아)/.test(cleanText)) {
    throw new Error("오프노트 기록에는 상품 링크·제휴 문구·댓글 유도 문장을 넣을 수 없어.");
  }

  const baseDate = testOrCurrentDate();
  const target = prioritySlotFor(root, baseDate);
  const factsFile = dailyFactsPath(root, target.date);
  const daily = readDailyFacts(root, target.date);
  if (daily.facts.length >= 2) {
    target.date = addDays(target.date, 1);
    target.slot = "evening";
    daily.facts = readDailyFacts(root, target.date).facts;
  }

  const id = manualFactId(target.date, update);
  if (daily.facts.some((fact) => fact?.id === id)) return { date: target.date, slot: target.slot, id, duplicate: true };
  daily.facts.push({
    id,
    title: "텔레그램 수동 기록",
    text: cleanText,
    tag: "오프노트기록",
    subject_cluster: "telegram_manual",
    shape: "memo",
    ending_family: "input_record",
    source: "telegram_manual_input",
    source_mode: "telegram_manual_input",
    priority: true,
    priority_slot: target.slot,
    telegram_update_id: update.update_id || null,
    received_at: new Date().toISOString(),
  });
  writeJson(factsFile, { date: target.date, facts: daily.facts, prepared_at: daily.prepared_at || new Date().toISOString(), updated_at: new Date().toISOString() });
  return { date: target.date, slot: target.slot, id, duplicate: false };
}

function firstToken(text) {
  return String(text || "").trim().split(/\s+/, 1)[0].toLowerCase();
}

function extractTimes(text) {
  return [...String(text || "").matchAll(/\b(\d{1,2}:\d{2})\b/g)].map((match) => match[1]);
}

function isScheduleToken(token) {
  return new Set(["시간", "발행시간", "스케줄", "/시간", "/발행시간", "/스케줄", "/schedule", "schedule"]).has(token);
}

function isHelpToken(token) {
  return new Set(["/help", "도움말", "help"]).has(token);
}

function commandHelp() {
  return [
    "오프노트 텔레그램 명령",
    "그냥 보낼 문장 → 다음 발행 슬롯 우선 기록",
    "/기록 내용 → 다음 발행 슬롯 우선 기록",
    "/시간 → 현재 발행 시간 확인",
    "/시간 16:00 22:00 → 발행 시간 변경",
    "승인 / 보류 → 기존 초안 처리",
    "시간 변경은 이후 실행부터 적용되고, 놓친 슬롯을 소급 발행하지 않아.",
  ].join("\n");
}

async function handleScheduleCommand(root, text) {
  const token = firstToken(text);
  if (!isScheduleToken(token)) return false;
  const times = extractTimes(text);
  if (times.length === 0) {
    await sendMessage(formatSchedule(loadSchedule(root)));
    return true;
  }
  if (times.length !== 2) {
    await sendMessage("시간 변경은 예시처럼 보내줘: /시간 16:00 22:00");
    return true;
  }
  try {
    const updated = updateSlotTimes(root, times[0], times[1], { updated_by: `telegram:${process.env.OFFNOTE_TELEGRAM_CHAT_ID}` });
    await sendMessage(`발행 시간을 변경했어.\n${formatSchedule(updated)}\n앞으로 실행되는 슬롯부터 적용돼.`);
  } catch (error) {
    await sendMessage(`발행 시간 변경을 반영하지 못했어. ${error instanceof Error ? error.message : String(error)}`);
  }
  return true;
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

  const result = process.env.OFFNOTE_TELEGRAM_DRY_RUN === "true"
    ? { status: 0, stdout: "[telegram dry-run] threads publish skipped", stderr: "" }
    : spawnSync("node", ["scripts/threads_publish.mjs", draftItem.file], {
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
    updated.status = process.env.OFFNOTE_TELEGRAM_DRY_RUN === "true" ? draft.status : "published";
    updated.published_at = process.env.OFFNOTE_TELEGRAM_DRY_RUN === "true" ? undefined : new Date().toISOString();
    updated.telegram_approval = { source: approvalSource, approved_at: draft.approved_at };
    writeJson(draftItem.file, updated);
    await sendMessage(process.env.OFFNOTE_TELEGRAM_DRY_RUN === "true" ? `[드라이런] 발행 API 호출 없이 승인 흐름만 확인했어: ${draft.id}` : `offnote.kr published: ${draft.id}`);
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
  console.log("Telegram checker skipped: OFFNOTE_TELEGRAM_BOT_TOKEN or OFFNOTE_TELEGRAM_CHAT_ID is missing.");
  process.exit(0);
}

const root = process.cwd();
const statePath = path.join(root, "outputs", "afterwork-profit", "telegram-approval-state.json");
const errorPath = path.join(root, "outputs", "afterwork-profit", "automation", "offnote-telegram-approval-checker-last-error.json");

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
  const updates = await getUpdates(token, offset);
  let nextOffset = offset;
  const processed = new Set(state.processed_callbacks || []);

  for (const update of updates) {
    nextOffset = Math.max(nextOffset, Number(update.update_id) + 1);
    const message = update.message;
    if (message?.text) {
      const fromChat = message.chat?.id;
      if (String(fromChat) !== String(chatId)) continue;
      const text = String(message.text || "").trim();
      const [command = "", draftIdFromText = ""] = text.split(/\s+/, 2);
      const normalizedCommand = command.toLowerCase();
      const approveCommands = new Set(["승인", "발행", "게시", "approve", "publish"]);
      const holdCommands = new Set(["보류", "hold"]);

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

      if (await handleScheduleCommand(root, text)) continue;
      if (isHelpToken(normalizedCommand)) {
        await sendMessage(commandHelp());
        continue;
      }

      try {
        const saved = saveManualFact(root, text, update);
        await sendMessage(saved.duplicate
          ? `이미 저장된 텔레그램 기록이야: ${saved.id}`
          : `다음 오프노트 발행 슬롯에 우선 기록했어.\n날짜: ${saved.date}\n슬롯: ${saved.slot}\n이 입력이 없더라도 다른 슬롯은 자동 소재로 계속 발행돼.`);
      } catch (error) {
        await sendMessage(`수동 기록을 저장하지 못했어. ${error instanceof Error ? error.message : String(error)}`);
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
  console.log(`Checked Telegram updates. Updates=${updates.length}`);
} catch (err) {
  writeJson(errorPath, { at: new Date().toISOString(), error: normalizeError(err) });
  console.error(err);
  process.exit(1);
}
