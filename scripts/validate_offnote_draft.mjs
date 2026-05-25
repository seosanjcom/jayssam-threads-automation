import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/validate_offnote_draft.mjs DRAFT_JSON");
  process.exit(1);
}

const draft = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

function collectText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectText).join("\n");
  if (typeof value === "object") return Object.values(value).map(collectText).join("\n");
  return "";
}

const text = collectText({
  topic: draft.topic,
  threads_text: draft.threads_text,
  thread_comments: draft.thread_comments,
  cardnews_slides: draft.cardnews_slides,
});

const hangul = (text.match(/[\uAC00-\uD7A3]/g) || []).length;
const han = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
const replacement = (text.match(/\uFFFD/g) || []).length;
const questionMarks = (text.match(/\?/g) || []).length;
const suspiciousFragments = ["Ã", "Â", "ì", "ë", "揶", "媛", "留", "寃"].filter((item) => text.includes(item));
const shoppingRouteTerms = [
  /냉감(?:패드|이불|침구)/,
  /여름 침구/,
  /장마철 신발/,
  /운동화 냄새/,
  /신발 (?:건조기|탈취제|제습제|말리는 법|냄새)/,
  /상품 링크/,
  /구매\s*(?:링크|시)/,
  /추천템/,
  /제휴 링크/,
];

const errors = [];
if (draft.account !== "offnote.kr") errors.push(`account must be offnote.kr, got ${draft.account}`);
if (!draft.threads_text || draft.threads_text.length < 180) {
  errors.push("threads_text is too short for a real offnote preview");
}
if (draft.threads_text && draft.threads_text.length > 500) {
  errors.push(`threads_text is too long for Threads API (${draft.threads_text.length}/500)`);
}
if (hangul < 120) errors.push(`too little Hangul text detected (${hangul})`);
if (han > hangul * 0.25) errors.push(`possible mojibake: too many Han characters (${han}) vs Hangul (${hangul})`);
if (replacement > 0) errors.push(`replacement characters detected (${replacement})`);
if (questionMarks > 5) errors.push(`possible mojibake: too many question marks (${questionMarks})`);
if (suspiciousFragments.length > 0) {
  errors.push(`suspicious mojibake fragments: ${suspiciousFragments.join(", ")}`);
}
if (shoppingRouteTerms.some((pattern) => pattern.test(text))) {
  errors.push("shopping/product-route content belongs to lifemagazine_, not offnote.kr");
}
if (!Array.isArray(draft.thread_comments) || draft.thread_comments.length < 2) {
  errors.push("thread_comments must include at least 2 information-expansion comments");
}
if (!Array.isArray(draft.cardnews_slides) || draft.cardnews_slides.length < 4) {
  errors.push("cardnews_slides must include at least 4 slides");
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, file, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, file, hangul, han }, null, 2));

