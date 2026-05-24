import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  const lines = fs.readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

async function graphPost(url, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: "POST", body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

async function graphPostWithRetry(url, params, { retries = 3, delayMs = 10000, label = "request" } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await graphPost(url, params);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "");
      const retryable =
        message.includes("Invalid Carousel Children") ||
        message.includes("is_transient") ||
        message.includes("temporarily");
      if (!retryable || attempt === retries) break;
      console.log(`${label} failed on attempt ${attempt}/${retries}; retrying after ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

async function graphGet(url, params) {
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") requestUrl.searchParams.set(key, value);
  }
  const res = await fetch(requestUrl);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(filePath.replace(/[\\/][^\\/]+$/, ""), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function enforceLocalSafety({ logPath, account, dailyLimit, minIntervalHours }) {
  const now = Date.now();
  const log = readJsonIfExists(logPath, []);
  const recent = log.filter((item) => {
    if (item.account !== account) return false;
    if (String(item.status || "").startsWith("deleted_")) return false;
    return now - Date.parse(item.published_at) < 24 * 60 * 60 * 1000;
  });
  if (recent.length >= dailyLimit) {
    throw new Error(`Safety stop: ${account} already has ${recent.length} post(s) in the last 24h. Limit=${dailyLimit}.`);
  }
  const latest = recent.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  if (latest) {
    const hoursSinceLatest = (now - Date.parse(latest.published_at)) / (60 * 60 * 1000);
    if (hoursSinceLatest < minIntervalHours) {
      throw new Error(`Safety stop: last post was ${hoursSinceLatest.toFixed(2)}h ago. Minimum interval=${minIntervalHours}h.`);
    }
  }
}

function appendPublishLog({ logPath, account, draft, publish }) {
  const log = readJsonIfExists(logPath, []);
  log.push({
    account,
    draft_id: draft.id,
    topic: draft.topic,
    topic_tag: draft.topic_tag || draft.topicTag || "",
    threads_media_id: publish.id,
    reply_ids: Array.isArray(draft.published_reply_ids) ? draft.published_reply_ids : [],
    published_at: new Date().toISOString(),
  });
  writeJson(logPath, log);
}

function collectReplyTexts(draft) {
  const source = draft.thread_comments || draft.reply_comments || draft.comment_replies || draft.comments || [];
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => (typeof item === "string" ? item : item.text || item.body || item.comment || ""))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => (item.length > 500 ? item.slice(0, 497).trimEnd() + "..." : item))
    .slice(0, 5);
}

function assertPublishableDraft(draft) {
  const threadsText = String(draft.threads_text || "");
  const replyTexts = collectReplyTexts(draft);
  const localMediaPaths = Array.isArray(draft.local_media_paths) ? draft.local_media_paths.filter(Boolean) : [];
  const mediaUrls = Array.isArray(draft.media_urls) ? draft.media_urls.filter(Boolean) : [];
  const collectedText = JSON.stringify({
    topic: draft.topic,
    threads_text: draft.threads_text,
    thread_comments: draft.thread_comments,
    cardnews_slides: draft.cardnews_slides,
  });
  const hangul = (collectedText.match(/[\uAC00-\uD7A3]/g) || []).length;
  const han = (collectedText.match(/[\u4E00-\u9FFF]/g) || []).length;
  const questionMarks = (collectedText.match(/\?/g) || []).length;
  const replacement = (collectedText.match(/\uFFFD/g) || []).length;
  const suspiciousFragments = ["\u5A9B", "\u0080", "\u75AB", "\u6930", "\u7B4C", "\u91CE", "\u56A5", "\u63F6", "\u923A"].filter((item) =>
    collectedText.includes(item),
  );
  const isLifemagazine = draft.account === "lifemagazine_";

  if (draft.account === "offnote.kr") {
    if (threadsText.length < 180) {
      throw new Error(`Safety stop: offnote.kr threads_text is too short (${threadsText.length}/180).`);
    }
    if (threadsText.length > 500) {
      throw new Error(`Safety stop: offnote.kr threads_text exceeds Threads API limit (${threadsText.length}/500).`);
    }
    if (hangul < 120) {
      throw new Error(`Safety stop: too little Korean text detected (${hangul}).`);
    }
    if (han > hangul * 0.25 || questionMarks > 5 || replacement > 0 || suspiciousFragments.length > 0) {
      throw new Error("Safety stop: possible mojibake detected in offnote.kr draft.");
    }
  }

  if (isLifemagazine) {
    const bodyHangul = (threadsText.match(/[\uAC00-\uD7A3]/g) || []).length;
    const bodyQuestionMarks = (threadsText.match(/\?/g) || []).length;
    if (threadsText.length > 500) {
      throw new Error(`Safety stop: lifemagazine_ threads_text exceeds Threads API limit (${threadsText.length}/500).`);
    }
    if (bodyQuestionMarks >= 3 && bodyHangul < 15) {
      throw new Error("Safety stop: possible mojibake or broken Korean detected in lifemagazine_ draft.");
    }
    if (replacement > 0 || suspiciousFragments.length > 0) {
      throw new Error("Safety stop: possible mojibake detected in lifemagazine_ draft.");
    }
    if (localMediaPaths.length > 0 && mediaUrls.length === 0) {
      throw new Error("Safety stop: lifemagazine_ draft has local photos but no public media_urls. Upload and verify a public image URL before publishing.");
    }
    if (
      replyTexts.length > 0 &&
      String(process.env.THREADS_REQUIRE_REPLIES || "false").toLowerCase() === "true" &&
      String(process.env.THREADS_REPLY_PERMISSION_CONFIRMED || "false").toLowerCase() !== "true"
    ) {
      throw new Error("Safety stop: lifemagazine_ comments cannot be guaranteed yet. Set THREADS_REPLY_PERMISSION_CONFIRMED=true only after Meta reply permission is confirmed.");
    }
  }
}

loadEnv();

const draftPath = process.argv[2];
if (!draftPath) {
  console.error("Usage: node scripts/threads_publish.mjs outputs/automation/YYYY-MM-DD/AUTO-....json");
  process.exit(1);
}

const token = process.env.THREADS_ACCESS_TOKEN;
const userId = process.env.THREADS_USER_ID || "me";
const autoPublish = String(process.env.THREADS_AUTO_PUBLISH || "false").toLowerCase() === "true";
const publishWaitMs = Number(process.env.THREADS_PUBLISH_WAIT_MS || "30000");
const safetyMode = String(process.env.THREADS_SAFETY_MODE || "true").toLowerCase() !== "false";
const verifyProfileBeforePublish = String(process.env.THREADS_VERIFY_PROFILE_BEFORE_PUBLISH || "false").toLowerCase() === "true";
const expectedUsername = (process.env.THREADS_EXPECTED_USERNAME || "").trim().toLowerCase();
const dailyLimit = Number(process.env.THREADS_DAILY_POST_LIMIT || "1");
const minIntervalHours = Number(process.env.THREADS_MIN_INTERVAL_HOURS || "8");
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const carouselEnabled = String(process.env.THREADS_CAROUSEL_ENABLED || "false").toLowerCase() === "true";
const publishReplies = String(process.env.THREADS_PUBLISH_REPLIES || "true").toLowerCase() !== "false";
const replyWaitMs = Number(process.env.THREADS_REPLY_WAIT_MS || "8000");
const draft = JSON.parse(fs.readFileSync(draftPath, "utf8").replace(/^\uFEFF/, ""));

if (!autoPublish) {
  console.log("THREADS_AUTO_PUBLISH=false, dry run only.");
  console.log(draft.threads_text);
  process.exit(0);
}

if (!token) {
  throw new Error("THREADS_ACCESS_TOKEN is missing in .env");
}

if (draft.status !== "approved") {
  throw new Error(`Refusing to publish status=${draft.status}. Set status to approved first.`);
}

const base = "https://graph.threads.net/v1.0";
const account = draft.account || userId;
const allMediaUrls = Array.isArray(draft.media_urls) ? draft.media_urls.filter(Boolean) : [];
const mediaUrls = carouselEnabled ? allMediaUrls : allMediaUrls.slice(0, 1);
const requiresCardnews = process.env.THREADS_REQUIRE_MEDIA === "true";
const topicTag = String(draft.topic_tag || draft.topicTag || "").trim();
const topicParams = topicTag ? { topic_tag: topicTag.slice(0, 50) } : {};

assertPublishableDraft(draft);

if (requiresCardnews && mediaUrls.length === 0) {
  throw new Error("Refusing to publish without required media_urls.");
}

if (
  process.env.THREADS_REQUIRE_REPLIES === "true" &&
  collectReplyTexts(draft).length > 0 &&
  !publishReplies
) {
  throw new Error("Refusing to publish because THREADS_REQUIRE_REPLIES=true but THREADS_PUBLISH_REPLIES=false.");
}

if (safetyMode) {
  enforceLocalSafety({ logPath: publishLogPath, account, dailyLimit, minIntervalHours });
}

if (verifyProfileBeforePublish) {
  const profile = await graphGet(`${base}/${userId}`, {
    fields: "id,username,name,is_verified",
    access_token: token,
  });
  if (expectedUsername && String(profile.username || "").toLowerCase() !== expectedUsername) {
    throw new Error(`Safety stop: connected Threads username is @${profile.username}, expected @${expectedUsername}.`);
  }
}

let create;

if (mediaUrls.length > 1) {
  const children = [];
  for (const imageUrl of mediaUrls) {
    const child = await graphPost(`${base}/${userId}/threads`, {
      media_type: "IMAGE",
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: token,
    });
    children.push(child.id);
  }
  await sleep(Math.max(10000, Math.min(publishWaitMs, 30000)));
  try {
    create = await graphPostWithRetry(`${base}/${userId}/threads`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      text: draft.threads_text,
      ...topicParams,
      access_token: token,
    }, { retries: 4, delayMs: 15000, label: "carousel container" });
  } catch (error) {
    if (process.env.THREADS_ALLOW_SINGLE_IMAGE_FALLBACK === "true") {
      console.log(`Carousel creation failed, falling back to first image: ${error.message}`);
      create = await graphPost(`${base}/${userId}/threads`, {
        media_type: "IMAGE",
        image_url: mediaUrls[0],
        text: draft.threads_text,
        ...topicParams,
        access_token: token,
      });
    } else {
      throw error;
    }
  }
} else if (mediaUrls.length === 1) {
  create = await graphPost(`${base}/${userId}/threads`, {
    media_type: "IMAGE",
    image_url: mediaUrls[0],
    text: draft.threads_text,
    ...topicParams,
    access_token: token,
  });
} else {
  create = await graphPost(`${base}/${userId}/threads`, {
    media_type: "TEXT",
    text: draft.threads_text,
    ...topicParams,
    access_token: token
  });
}

if (publishWaitMs > 0) {
  await sleep(publishWaitMs);
}

const publish = await graphPost(`${base}/${userId}/threads_publish`, {
  creation_id: create.id,
  access_token: token
});

const replyPublishes = [];
if (publishReplies) {
  let replyToId = publish.id;
  for (const replyText of collectReplyTexts(draft)) {
    const replyCreate = await graphPost(`${base}/${userId}/threads`, {
      media_type: "TEXT",
      text: replyText,
      reply_to_id: replyToId,
      access_token: token,
    });
    if (replyWaitMs > 0) await sleep(replyWaitMs);
    const replyPublish = await graphPost(`${base}/${userId}/threads_publish`, {
      creation_id: replyCreate.id,
      access_token: token,
    });
    replyPublishes.push(replyPublish);
    replyToId = replyPublish.id;
  }
  if (replyPublishes.length > 0) {
    draft.published_reply_ids = replyPublishes.map((item) => item.id);
    fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

if (safetyMode) {
  appendPublishLog({ logPath: publishLogPath, account, draft, publish });
}

console.log(JSON.stringify({ creation: create, publish, replies: replyPublishes }, null, 2));

