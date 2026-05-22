import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function pickConfigured(...values) {
  return values.find((value) => value && !String(value).startsWith("replace_")) || "";
}

loadEnv();

const token = pickConfigured(process.env.JAYSSAM_TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN);
const chatId = pickConfigured(process.env.JAYSSAM_TELEGRAM_CHAT_ID, process.env.TELEGRAM_CHAT_ID);
const message = process.argv.slice(2).join(" ").trim();

if (!token || !chatId || !message) {
  console.log("Telegram message skipped: token, chat id, or message is missing.");
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: chatId,
    text: message,
    disable_web_page_preview: true,
  }),
});

const text = await res.text();
if (!res.ok) throw new Error(`sendMessage failed: ${res.status} ${text}`);
console.log("Telegram message sent.");
