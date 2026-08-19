import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const account = "lifemagazine_";
const automationRoot = path.join("outputs", "lifemagazine", "automation");
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/lifemagazine/meta-publish-log.json";

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

function isDraftDue(data, now = new Date()) {
  if (!data.scheduled_publish_at) return true;
  const scheduled = Date.parse(data.scheduled_publish_at);
  if (Number.isNaN(scheduled)) return true;
  return scheduled <= new Date(now).getTime();
}

function kstDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(now));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isCurrentKstDraft(data, now = new Date()) {
  const expectedDate = kstDateKey(now);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(data.date || ""))) return data.date === expectedDate;
  if (data.scheduled_publish_at) return kstDateKey(data.scheduled_publish_at) === expectedDate;
  return false;
}

function writePublishFailure(file, message) {
  const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  data.status = "publish_failed";
  data.publish_failed_at = new Date().toISOString();
  data.publish_failure_reason = String(message || "Unknown publish failure").slice(0, 1000);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function sendTelegramNotice(text) {
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) {
    console.log("Lifemagazine Telegram notice skipped: credentials are missing.");
    return;
  }
  const body = new FormData();
  body.set("chat_id", chatId);
  body.set("text", text);
  body.set("disable_web_page_preview", "true");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", body });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) throw new Error(`Telegram notice failed: ${JSON.stringify(result)}`);
}

async function notifyPublishResult(draft, outcome, detail = "") {
  const title = draft.product_name || draft.topic || draft.id;
  const slot = draft.recommended_publish_time || "예정 슬롯";
  const text = outcome === "success"
    ? `[라이프매거진 자동 발행 완료]\n${slot}\n${title}\n공정위 고지 댓글까지 함께 게시했어.`
    : `[라이프매거진 자동 발행 실패]\n${slot}\n${title}\n${String(detail).slice(0, 500)}`;
  try {
    await sendTelegramNotice(text);
  } catch (error) {
    console.error(`Lifemagazine publish notifier error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function getLifemagazineSafetySkipReason({
  publishLogPath: logPath = publishLogPath,
  account: targetAccount = account,
  now = new Date(),
  dailyLimit = 2,
  minIntervalHours = 5,
} = {}) {
  const referenceTime = new Date(now).getTime();
  const recent = readJsonIfExists(logPath, []).filter((item) => {
    if (item.account !== targetAccount) return false;
    if (String(item.status || "").startsWith("deleted_")) return false;
    const publishedAt = Date.parse(item.published_at);
    return Number.isFinite(publishedAt) && referenceTime - publishedAt < 24 * 60 * 60 * 1000;
  });
  if (recent.length >= dailyLimit) {
    return `Safety stop: ${targetAccount} already has ${recent.length} post(s) in the last 24h. Limit=${dailyLimit}.`;
  }
  const latest = recent.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  if (latest) {
    const hoursSinceLatest = (referenceTime - Date.parse(latest.published_at)) / (60 * 60 * 1000);
    if (hoursSinceLatest < minIntervalHours) {
      return `Safety stop: last post was ${hoursSinceLatest.toFixed(2)}h ago. Minimum interval=${minIntervalHours}h.`;
    }
  }
  return "";
}

export function latestApprovedLifemagazineDraft(options = {}) {
  const root = options.root || process.cwd();
  const now = options.now || new Date();
  const logPath = options.publishLogPath || path.join(root, publishLogPath);
  const publishedIds = options.publishedIds || new Set(readJsonIfExists(logPath, []).map((log) => log.draft_id));
  const dir = path.join(root, automationRoot);

  return findJsonFiles(dir)
    .map((file) => {
      try {
        return { file, data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")), mtime: fs.statSync(file).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => item.data.account === account)
    .filter((item) => item.data.status === "approved")
    .filter((item) => !publishedIds.has(item.data.id))
    // 지연된 예약 회복 시에도 전날의 미발행 초안을 오늘 다시 올리지 않는다.
    .filter((item) => isCurrentKstDraft(item.data, now))
    .filter((item) => item.data.publish_on_approve === true || isDraftDue(item.data, now))
    .sort((a, b) => b.mtime - a.mtime)[0] || null;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();

  if (!process.env.THREADS_ACCESS_TOKEN && process.env.LIFEMAGAZINE_THREADS_ACCESS_TOKEN) {
    process.env.THREADS_ACCESS_TOKEN = process.env.LIFEMAGAZINE_THREADS_ACCESS_TOKEN;
  }
  if (!process.env.THREADS_APP_ID && process.env.LIFEMAGAZINE_THREADS_APP_ID) {
    process.env.THREADS_APP_ID = process.env.LIFEMAGAZINE_THREADS_APP_ID;
  }
  if (!process.env.THREADS_APP_SECRET && process.env.LIFEMAGAZINE_THREADS_APP_SECRET) {
    process.env.THREADS_APP_SECRET = process.env.LIFEMAGAZINE_THREADS_APP_SECRET;
  }

  const token = process.env.THREADS_ACCESS_TOKEN || "";
  if (!token || token.includes("replace_")) {
    console.log("Lifemagazine publish skipped: THREADS_ACCESS_TOKEN is missing.");
    process.exit(0);
  }

  const latest = latestApprovedLifemagazineDraft();
  if (!latest) {
    console.log("No due approved lifemagazine_ Threads post found.");
    process.exit(0);
  }

  const safetySkipReason = getLifemagazineSafetySkipReason();
  if (safetySkipReason) {
    console.log(`Lifemagazine publish skipped: ${safetySkipReason}`);
    process.exit(0);
  }

  const localMediaPaths = Array.isArray(latest.data.local_media_paths) ? latest.data.local_media_paths.filter(Boolean) : [];
  const mediaUrls = Array.isArray(latest.data.media_urls) ? latest.data.media_urls.filter(Boolean) : [];
  if (localMediaPaths.length > 0 && mediaUrls.length === 0) {
    console.log("Lifemagazine photo draft has local images. Uploading to public media_urls before publishing...");
    const upload = spawnSync("node", ["scripts/upload_cardnews_to_catbox.mjs", latest.file], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    if (upload.stdout) process.stdout.write(upload.stdout);
    if (upload.stderr) process.stderr.write(upload.stderr);
    if ((upload.status ?? 1) !== 0) {
      writePublishFailure(latest.file, `Image upload failed before publishing: ${upload.stderr || upload.stdout || "unknown error"}`);
      process.exit(upload.status ?? 1);
    }

    const verify = spawnSync("node", ["scripts/verify_media_urls.mjs", latest.file], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    if (verify.stdout) process.stdout.write(verify.stdout);
    if (verify.stderr) process.stderr.write(verify.stderr);
    if ((verify.status ?? 1) !== 0) {
      writePublishFailure(latest.file, `Image URL verification failed before publishing: ${verify.stderr || verify.stdout || "unknown error"}`);
      process.exit(verify.status ?? 1);
    }
  }

  console.log(`Publishing latest approved lifemagazine_ post: ${latest.file}`);
  const result = spawnSync("node", ["scripts/threads_publish.mjs", latest.file], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      THREADS_EXPECTED_USERNAME: process.env.THREADS_EXPECTED_USERNAME || "lifemagazine_",
      THREADS_PUBLISH_LOG: process.env.THREADS_PUBLISH_LOG || "outputs/lifemagazine/meta-publish-log.json",
      THREADS_REQUIRE_MEDIA: localMediaPaths.length > 0 ? "true" : (process.env.THREADS_REQUIRE_MEDIA || "false"),
      THREADS_REQUIRE_REPLIES: "true",
    },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    const detail = result.stderr || result.stdout || "Threads publish failed.";
    writePublishFailure(latest.file, detail);
    await notifyPublishResult(latest.data, "failure", detail);
  } else {
    await notifyPublishResult(latest.data, "success");
  }
  process.exit(result.status ?? 1);
}
