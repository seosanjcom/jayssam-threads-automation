import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeProductCandidate } from "./lifemagazine_product_candidates.mjs";

const root = process.cwd();

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

export function tomorrowKst(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + 1);
  return kst.toISOString().slice(0, 10);
}

export function buildProductQueueReminder(targetDate) {
  return [
    `[라이프매거진 상품 지정] ${targetDate}`,
    "",
    "내일 라이프매거진 상품 3개 직접 정할래?",
    "있으면 상품명 / 쿠팡링크 / 하고싶은말을 보내줘.",
    "",
    "하고싶은말이 있으면 그걸 본문에 먼저 녹이고,",
    "없으면 내가 생활 장면 잡아서 쓸게.",
    "",
    "답변 예시:",
    "내일 상품",
    "1. 대용량 머리끈",
    "링크 https://link.coupang.com/a/example",
    "하고싶은말 머리끈 맨날 잃어버리는 사람한테 쟁여템 느낌",
    "",
    "2. 케이블 정리 클립",
    "링크 https://link.coupang.com/a/example2",
    "하고싶은말 책상 위 충전선 굴러다니는 거 싫은 사람용",
    "",
    "상품은 있는데 할 말 없으면 상품명+링크만 보내도 돼.",
    "직접 고를 상품 없으면 이렇게 보내줘:",
    "내일은 자동으로 해줘",
    "",
    "내가 답변 확인하면 몇 개 저장됐는지 다시 확정 메시지 보낼게.",
  ].join("\n");
}

function isAutoReply(text) {
  return /자동으로\s*해줘|자동\s*후보|알아서\s*해줘/.test(String(text || ""));
}

function splitBlocks(text) {
  const normalized = String(text || "").replace(/\n\s*(?=(?:\d+[\.)]|[-•])\s+)/g, "\n@@PRODUCT@@");
  return normalized
    .split("\n@@PRODUCT@@")
    .map((block) => block.trim())
    .filter((block) => /^(?:\d+[\.)]|[-•])\s+/m.test(block));
}

function parseBlock(block, options = {}) {
  const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const first = lines[0] || "";
  const productName = first.replace(/^(?:\d+[\.)]|[-•])\s*/, "").trim();
  const linkLine = lines.find((line) => /https?:\/\/\S+/.test(line)) || "";
  const affiliateUrl = (linkLine.match(/https?:\/\/\S+/) || [""])[0].replace(/[),.]+$/, "");
  const imageLine = lines.find((line) => /^이미지|^사진/.test(line) && /https?:\/\/\S+/.test(line)) || "";
  const imageUrl = (imageLine.match(/https?:\/\/\S+/) || [""])[0].replace(/[),.]+$/, "");
  const noteLine = lines.find((line) => /^(하고싶은말|메모|내말|포인트)\s*/.test(line)) || "";
  const operatorNote = noteLine.replace(/^(하고싶은말|메모|내말|포인트)\s*/g, "").trim();

  return normalizeProductCandidate({
    source: "manual_queue",
    product_name: productName,
    affiliate_url: affiliateUrl,
    image_url: imageUrl,
    operator_note: operatorNote,
    usage_status: "not_confirmed",
  }, { collectedAt: options.collectedAt || new Date().toISOString() });
}

export function parseTelegramProductQueueReply(text, options = {}) {
  if (isAutoReply(text)) return { date: options.date, mode: "auto", products: [] };
  const products = splitBlocks(text)
    .map((block) => parseBlock(block, options))
    .filter((item) => item.product_name);
  return { date: options.date, mode: products.length ? "manual" : "unknown", products };
}

export function queuePathFor(date, options = {}) {
  return path.join(options.root || root, "inputs", "lifemagazine", "products", `${date}.json`);
}

export function saveManualProductQueue(queue, options = {}) {
  const date = queue.date || options.date;
  if (!date) throw new Error("date is required to save manual product queue.");
  const outPath = queuePathFor(date, options);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify({ date, mode: queue.mode, products: queue.products || [] }, null, 2)}\n`, "utf8");
  return outPath;
}

export function loadManualProductQueue(date, options = {}) {
  const filePath = queuePathFor(date, options);
  if (!fs.existsSync(filePath)) return [];
  const queue = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  if (queue.mode === "auto") return [];
  return Array.isArray(queue.products) ? queue.products.map((item) => normalizeProductCandidate(item)) : [];
}

export function buildProductQueueConfirmation(queue) {
  const date = queue.date || "";
  if (queue.mode === "auto") {
    return [
      `[라이프매거진 상품 지정 확인] ${date}`,
      "확인했어. 내일 상품은 자동 후보로 3개 잡아서 초안 만들게.",
      "초안/이미지는 발행 전에 다시 승인 요청 보낼게.",
    ].join("\n");
  }
  const products = queue.products || [];
  return [
    `[라이프매거진 상품 지정 확인] ${date}`,
    `${products.length}개 상품 확인했고 저장했어.`,
    "",
    ...products.map((item, index) => [
      `${index + 1}. ${item.product_name}`,
      item.affiliate_url ? `링크: ${item.affiliate_url}` : "링크: 없음 - 발행 전 보류 대상",
      item.operator_note ? `하고싶은말: ${item.operator_note}` : "하고싶은말: 없음 - 내가 생활 장면 잡아서 쓸게",
    ].join("\n")),
    "",
    "이걸로 내일 초안 만들고, 발행 전 미리보기에서 다시 승인 받게.",
  ].join("\n\n");
}

async function telegram(method, body) {
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok || json.ok === false) throw new Error(`${method} failed: ${text}`);
  return json;
}

export async function sendProductQueueReminder(options = {}) {
  const targetDate = options.date || tomorrowKst();
  const body = new FormData();
  body.set("chat_id", process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID);
  body.set("text", buildProductQueueReminder(targetDate));
  body.set("disable_web_page_preview", "true");
  await telegram("sendMessage", body);
  return { ok: true, targetDate };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (!token || !chatId || token.includes("replace_") || chatId.includes("replace_")) {
    console.log("Telegram product queue reminder skipped: LIFEMAGAZINE_TELEGRAM_BOT_TOKEN or LIFEMAGAZINE_TELEGRAM_CHAT_ID is missing.");
    process.exit(2);
  }
  const date = process.argv[2] || "";
  const result = await sendProductQueueReminder({ date });
  console.log(`Sent Lifemagazine product queue reminder for ${result.targetDate}`);
}
