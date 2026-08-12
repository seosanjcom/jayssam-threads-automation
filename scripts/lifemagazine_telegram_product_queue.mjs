import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeProductCandidate } from "./lifemagazine_product_candidates.mjs";
import { resolveProductLink } from "./product_link_resolver.mjs";

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
    "내일 라이프매거진 상품을 직접 정할래?",
    "상품 링크만 그대로 보내도 돼. 링크를 열어 상품명·가격·이미지를 읽고, 생활 장면 중심으로 글을 만들게.",
    "쿠팡 단축 링크가 막히면 ‘상품명: ...’을 링크와 같이 보내면 파트너스 API로 확인할 수 있어.",
    "",
    "원하는 말투나 꼭 넣을 포인트가 있으면 링크 다음 줄에 적어줘.",
    "",
    "답변 예시:",
    "https://link.coupang.com/a/example",
    "포인트: 아침마다 머리끈 찾느라 시간 쓰는 사람용, 쟁여템 느낌",
    "",
    "상품 여러 개라면 링크를 줄마다 보내도 돼.",
    "직접 고를 상품이 없으면 이렇게 보내줘:",
    "내일은 자동으로 해줘",
    "",
    "링크를 받으면 파악한 상품 정보와 초안을 다시 보여주고 승인받을게.",
  ].join("\n");
}

function isAutoReply(text) {
  return /자동으로\s*해줘|자동\s*후보|알아서\s*해줘/.test(String(text || ""));
}

function extractUrls(text) {
  return [...String(text || "").matchAll(/https?:\/\/[^\s<>()]+/gi)]
    .map((match) => match[0].replace(/[),.]+$/, ""))
    .filter(Boolean);
}

function extractProductNameHint(text) {
  const match = String(text || "").match(/(?:^|\n)\s*(?:상품명|제품명|상품\s*이름)\s*[:：]\s*([^\n]+)/i);
  return match ? match[1].trim().slice(0, 180) : "";
}

function cleanOperatorNote(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s<>()]+/gi, "")
    .replace(/^(?:내일\s*상품|상품\s*링크|링크|상품명|제품명|상품\s*이름|포인트|하고싶은말|메모|내말)\s*[:：]?\s*/gim, "")
    .replace(/(?:^|\n)\s*(?:\d+[.)]|[-•])\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500);
}

function splitBlocks(text) {
  const normalized = String(text || "").replace(/\n\s*(?=(?:\d+[\.)]|[-•])\s*)/g, "\n@@PRODUCT@@");
  return normalized
    .split("\n@@PRODUCT@@")
    .map((block) => block.trim())
    .filter((block) => /^(?:\d+[\.)]|[-•])\s*/m.test(block));
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
  const operatorNote = noteLine.replace(/^(하고싶은말|메모|내말|포인트)\s*[:：]?\s*/g, "").trim();

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

  const blocks = splitBlocks(text);
  const numberedProducts = blocks
    .map((block) => parseBlock(block, options))
    .filter((item) => item.product_name || item.affiliate_url);
  if (numberedProducts.length) return { date: options.date, mode: "manual", products: numberedProducts };

  const urls = extractUrls(text);
  const operatorNote = cleanOperatorNote(text);
  const productName = extractProductNameHint(text);
  const products = urls.map((affiliateUrl) => normalizeProductCandidate({
    source: "manual_queue",
    product_name: productName,
    affiliate_url: affiliateUrl,
    operator_note: operatorNote,
    usage_status: "not_confirmed",
  }, { collectedAt: options.collectedAt || new Date().toISOString() }));
  return { date: options.date, mode: products.length ? "manual" : "unknown", products };
}

export async function enrichProductQueueLinks(queue, options = {}) {
  const resolver = options.resolveLink || resolveProductLink;
  const products = [];
  for (const product of queue.products || []) {
    const resolved = product.affiliate_url ? await resolver(product.affiliate_url, { ...options, productName: product.product_name || "" }) : {};
    products.push(normalizeProductCandidate({
      ...product,
      product_name: product.product_name || resolved.product_name || "",
      product_url: resolved.product_url || product.product_url || product.affiliate_url,
      affiliate_url: product.affiliate_url,
      image_url: product.image_url || resolved.image_url || "",
      price: product.price || resolved.price || 0,
      brand: product.brand || resolved.brand || "",
      description: product.description || resolved.description || "",
      metadata_status: resolved.metadata_status || product.metadata_status || "not_requested",
      metadata_error: resolved.metadata_error || product.metadata_error || "",
      operator_note: product.operator_note || "",
      source: "manual_queue",
      usage_status: "not_confirmed",
    }, { collectedAt: product.collected_at || options.collectedAt || new Date().toISOString() }));
  }
  return { ...queue, products };
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

function productMetadataSummary(item) {
  const details = [];
  if (item.brand) details.push(item.brand);
  if (item.price) details.push(`${Number(item.price).toLocaleString("ko-KR")}원`);
  if (item.metadata_status === "fetch_failed") details.push("링크 정보 확인 제한");
  return details.length ? ` (${details.join(" · ")})` : "";
}

export function buildProductQueueConfirmation(queue) {
  const date = queue.date || "";
  if (queue.mode === "auto") {
    return [
      `[라이프매거진 상품 지정 확인] ${date}`,
      "확인했어. 내일 상품은 검증 가능한 생활용품 후보로만 골라 초안을 만들게.",
      "초안/이미지는 발행 전에 다시 승인 요청 보낼게.",
    ].join("\n");
  }
  const products = queue.products || [];
  return [
    `[라이프매거진 상품 지정 확인] ${date}`,
    `${products.length}개 링크를 저장했어. 상품 정보를 확인한 뒤, 확인된 정보만 글에 반영할게.`,
    "",
    ...products.map((item, index) => [
      `${index + 1}. ${item.product_name || "상품명 확인 필요"}${productMetadataSummary(item)}`,
      item.affiliate_url ? `링크: ${item.affiliate_url}` : "링크: 없음 - 발행 전 보류 대상",
      item.operator_note ? `원하는 포인트: ${item.operator_note}` : "원하는 포인트: 없음 - 상품 정보와 생활 장면을 기준으로 작성",
    ].join("\n")),
    "",
    "초안을 만든 뒤 미리보기에서 다시 승인받을게.",
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
