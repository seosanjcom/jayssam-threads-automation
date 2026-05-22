import fs from "node:fs";

const keys = [
  "SCHOOLINFO_API_KEY",
  "CAREERNET_API_KEY",
  "THREADS_ACCESS_TOKEN",
  "THREADS_USER_ID",
  "THREADS_ACCOUNT_HANDLE",
  "THREADS_AUTO_PUBLISH",
  "THREADS_SAFETY_MODE",
  "THREADS_DAILY_POST_LIMIT",
  "THREADS_MIN_INTERVAL_HOURS",
  "THREADS_PUBLISH_WAIT_MS",
  "THREADS_VERIFY_PROFILE_BEFORE_PUBLISH",
  "THREADS_EXPECTED_USERNAME",
  "THREADS_REDIRECT_URI",
  "THREADS_PUBLISH_LOG",
  "THREADS_APP_ID",
  "THREADS_APP_SECRET",
  "THREADS_OAUTH_SCOPES",
  "THREADS_REQUIRE_MEDIA",
  "THREADS_CAROUSEL_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
];

const defaults = {
  THREADS_ACCOUNT_HANDLE: "@jayssam_edu",
  THREADS_AUTO_PUBLISH: "true",
  THREADS_SAFETY_MODE: "true",
  THREADS_DAILY_POST_LIMIT: "2",
  THREADS_MIN_INTERVAL_HOURS: "6",
  THREADS_PUBLISH_WAIT_MS: "30000",
  THREADS_VERIFY_PROFILE_BEFORE_PUBLISH: "true",
  THREADS_EXPECTED_USERNAME: "jayssam_edu",
  THREADS_REDIRECT_URI: "https://blog.naver.com/taemomjoo",
  THREADS_PUBLISH_LOG: "outputs/meta-publish-log.json",
  THREADS_OAUTH_SCOPES: "threads_basic,threads_content_publish,threads_manage_insights",
  THREADS_REQUIRE_MEDIA: "true",
  THREADS_CAROUSEL_ENABLED: "true",
};

const lines = [];
for (const key of keys) {
  const value = process.env[key] || defaults[key] || "";
  if (value) lines.push(`${key}=${value}`);
}

fs.writeFileSync(".env", `${lines.join("\n")}\n`, "utf8");
console.log(`Created .env with ${lines.length} key(s) for GitHub Actions.`);
