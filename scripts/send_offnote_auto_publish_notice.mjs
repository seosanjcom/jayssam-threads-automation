import fs from "node:fs";
import path from "node:path";
import { loadSchedule } from "./offnote_schedule.mjs";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findJsonFiles(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  });
}

function scheduledTime(slot) {
  const schedule = loadSchedule(process.cwd());
  return `${schedule.slots[slot] || (slot === "night" ? "21:30" : "15:30")} KST`;
}

loadEnv();
const date = process.argv[2];
const slot = process.argv[3];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !["evening", "night"].includes(slot || "")) {
  throw new Error("Usage: node scripts/send_offnote_auto_publish_notice.mjs YYYY-MM-DD evening|night");
}
const token = process.env.OFFNOTE_TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.OFFNOTE_TELEGRAM_CHAT_ID || "";
if (!token || !chatId) {
  console.log("Offnote automatic notice skipped: Telegram credentials are missing.");
  process.exit(0);
}

const root = path.join("outputs", "afterwork-profit", "automation", date);
const candidate = findJsonFiles(root)
  .map((file) => ({ file, draft: readJson(file), mtime: fs.statSync(file).mtimeMs }))
  .filter((item) => item.draft.account === "offnote.kr")
  .filter((item) => String(item.draft.id || "").includes(`-${slot}-`))
  .filter((item) => ["approved", "pending_approval"].includes(item.draft.status))
  .sort((a, b) => b.mtime - a.mtime)[0];

if (!candidate) {
  console.log(`No auto-publish-ready Offnote draft found for ${date} ${slot}.`);
  process.exit(0);
}

const sentSlots = new Set(Array.isArray(candidate.draft.telegram_auto_notice_slots) ? candidate.draft.telegram_auto_notice_slots : []);
if (sentSlots.has(slot)) {
  console.log(`Offnote automatic notice already sent for ${candidate.draft.id}.`);
  process.exit(0);
}

const body = new FormData();
body.set("chat_id", chatId);
body.set("disable_web_page_preview", "true");
body.set("text", [
  "[오프노트 자동 발행 예정]",
  `예정: ${scheduledTime(slot)}`,
  `주제: ${candidate.draft.topic || candidate.draft.id}`,
  "승인 대기 없이 정해진 시각에 자동 발행해. 발행되면 완료 메시지도 바로 보낼게.",
  "",
  "[Threads 본문]",
  candidate.draft.threads_text || "",
].join("\n"));

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", body });
const result = await response.json().catch(() => ({}));
if (!response.ok || result.ok === false) throw new Error(`Offnote Telegram notice failed: ${JSON.stringify(result)}`);

candidate.draft.telegram_auto_notice_slots = [...sentSlots, slot];
candidate.draft.telegram_auto_notice_sent_at = new Date().toISOString();
writeJson(candidate.file, candidate.draft);
console.log(`Sent Offnote automatic publish notice for ${candidate.draft.id}.`);
