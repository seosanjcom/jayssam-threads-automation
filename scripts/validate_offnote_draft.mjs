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
const suspiciousFragments = ["횄", "횂", "챙", "챘", "揶", "筌", "野"].filter((item) => text.includes(item));
const shoppingRouteTerms = [
  /제휴\s*링크.*구매\s*링크/s,
  /상품\s*링크/,
  /쿠팡\s*상품\s*추천/,
  /유튜브에\s*나온\s*제품/,
  /연예인.*제품/,
];
const forcedCtaTerms = [
  /인스타 같은 글에 댓글/,
  /카톡방/,
  /자료.*(?:받|공유|다운)/,
  /링크.*(?:댓글|프로필)/,
  /DM.*(?:줘|주세요)/i,
];
const bannedPositioning = [
  /나처럼\s*해/,
  /나처럼\s*수익화/,
  /성공담/,
  /망한\s*것/,
  /버텼(?:다|던)/,
  /불안(?:했|한|하다)/,
  /수익\s*보장/,
  /기준\s*(?:알려|정리|공유|풀)/,
  /다음과 같아/,
  /이걸 확인해보자/,
];

const errors = [];
if (draft.account !== "offnote.kr") errors.push(`account must be offnote.kr, got ${draft.account}`);
if (!['pending_approval', 'approved', 'published', 'held', 'publish_failed', 'ready_to_review'].includes(String(draft.status || ""))) {
  errors.push(`unsupported offnote status: ${draft.status}`);
}
if (draft.content_mode !== "digital_nomad_personal_note" && draft.content_mode !== "offnote_personal_note") {
  errors.push(`offnote draft must use personal-note content mode, got ${draft.content_mode || "empty"}`);
}
if (!draft.threads_text || draft.threads_text.length < 60) {
  errors.push("threads_text is too short for a meaningful offnote personal note");
}
if (draft.threads_text && draft.threads_text.length > 500) {
  errors.push(`threads_text is too long for Threads API (${draft.threads_text.length}/500)`);
}
if (hangul < 40) errors.push(`too little Hangul text detected (${hangul})`);
if (han > hangul * 0.1) errors.push(`possible mojibake: too many Han characters (${han}) vs Hangul (${hangul})`);
if (replacement > 0) errors.push(`replacement characters detected (${replacement})`);
if (questionMarks > 2) errors.push(`possible mojibake: too many question marks (${questionMarks})`);
if (suspiciousFragments.length > 0) errors.push(`suspicious mojibake fragments: ${suspiciousFragments.join(", ")}`);
if (shoppingRouteTerms.some((pattern) => pattern.test(text))) {
  errors.push("shopping/product-route content belongs to lifemagazine_, not offnote.kr");
}
if (forcedCtaTerms.some((pattern) => pattern.test(text))) {
  errors.push("offnote personal-note drafts must not use forced material or conversion CTA language");
}
if (bannedPositioning.some((pattern) => pattern.test(text))) {
  errors.push("offnote draft contains banned anxious, boastful, or explanatory positioning language");
}
if ((draft.thread_comments || []).length > 0) {
  errors.push("offnote personal-note drafts should not add promotional comment expansion");
}
if (Array.isArray(draft.cardnews_slides) && draft.cardnews_slides.length > 0) {
  errors.push("offnote personal-note drafts should be text-first and must not require cardnews slides");
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, file, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, file, hangul, han, content_mode: draft.content_mode }, null, 2));
