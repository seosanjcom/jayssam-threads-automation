import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function kstDateText() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function notify(message) {
  const token = process.env.JAYSSAM_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.JAYSSAM_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log(message);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`watchdog telegram failed: ${res.status} ${text}`);
}

loadEnv();

const slot = process.argv[2] || "afternoon";
const dateText = process.argv[3] || kstDateText();
const dateKey = dateText.replaceAll("-", "");
const logPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const log = readJson(logPath, []);
const expectedPrefixes = [
  `JAY-${dateKey}-${slot}-`,
  // 구형 뉴스 큐 초안의 감시 호환성은 유지한다.
  `GHA-${dateKey}-${slot}-`,
];
const account = process.env.THREADS_USER_ID || "";
const found = log.find((item) => expectedPrefixes.some((prefix) => String(item.draft_id || "").startsWith(prefix)) && (!account || item.account === account));

if (found) {
  await notify(`[제이쌤 자동화 확인]\n${dateText} ${slot} 게시 로그 확인 완료\nthreads_media_id: ${found.threads_media_id || found.media_id || "recorded"}`);
  console.log(`Publish watchdog passed for ${expectedPrefixes.join(", ")}`);
  process.exit(0);
}

await notify(`[제이쌤 자동화 경고]\n${dateText} ${slot} 게시 로그가 없습니다.\nGitHub Actions 실행 로그를 바로 확인해야 합니다.`);
throw new Error(`Publish watchdog failed: no publish log for ${expectedPrefixes.join(", ")}`);
