import fs from "node:fs";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN || "";
if (!token || token.startsWith("replace_")) {
  throw new Error("Put TELEGRAM_BOT_TOKEN in .env first.");
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const json = await res.json();
if (!json.ok) throw new Error(JSON.stringify(json));

const chats = [];
for (const item of json.result || []) {
  const chat = item.message?.chat || item.channel_post?.chat || item.my_chat_member?.chat;
  if (!chat) continue;
  chats.push({
    id: chat.id,
    type: chat.type,
    title: chat.title,
    username: chat.username,
    first_name: chat.first_name,
  });
}

console.log(JSON.stringify(chats, null, 2));
