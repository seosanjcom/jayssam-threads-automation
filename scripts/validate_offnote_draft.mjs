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
const body = String(draft.threads_text || "");
const hangul = (body.match(/[\uAC00-\uD7A3]/g) || []).length;
const han = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
const replacement = (text.match(/\uFFFD/g) || []).length;
const questionMarks = (body.match(/\?/g) || []).length;
const exclamations = (body.match(/!/g) || []).length;
const emotionMarks = (body.match(/(?:ㅋㅋ|ㅠ|👀|🫶🏻|😂|😻|🥹|🤔|\.\.\.|…|!{2,}|\?{2,})/g) || []).length;
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
  /댓글(?:로)?\s*(?:남겨|알려|달아)/,
  /다들\s*이런\s*경험/,
  /여러분은\s*어떻게\s*생각/,
  /DM.*(?:줘|주세요)/i,
];
const polishedConclusionPatterns = [
  /지금은\s*장소보다.*더\s*중요해졌다/s,
  /친절한\s*것과.*다른\s*일이라서/s,
  /급한\s*쪽은.*나보다\s*상대/s,
  /결국\s*중요한\s*건/,
  /이런\s*순간이.*(?:삶|일상)/,
  /그래서\s*다시\s*한번\s*느꼈/,
  /소통이\s*중요/,
  /프리랜서라면/,
  /디지털노마드에게/,
  /오늘은.*(?:팁|공유|알려)/,
  /10년\s*동안\s*일하며/,
  /~에\s*더\s*가깝다/,
  /~이\s*더\s*중요하다/,
  /~이\s*필요하다/,
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
if (!["pending_approval", "approved", "published", "held", "publish_failed", "ready_to_review"].includes(String(draft.status || ""))) {
  errors.push(`unsupported offnote status: ${draft.status}`);
}
if (draft.content_mode !== "digital_nomad_personal_note" && draft.content_mode !== "offnote_personal_note") {
  errors.push(`offnote draft must use personal-note content mode, got ${draft.content_mode || "empty"}`);
}
if (!body || body.trim().length < 8) errors.push("threads_text is too short even for a one-line offnote record");
if (body.length > 500) errors.push(`threads_text is too long for Threads API (${body.length}/500)`);
if (hangul < 8) errors.push(`too little Hangul text detected (${hangul})`);
if (han > hangul * 0.1) errors.push(`possible mojibake: too many Han characters (${han}) vs Hangul (${hangul})`);
if (replacement > 0) errors.push(`replacement characters detected (${replacement})`);
if (questionMarks > 1) errors.push(`record-style offnote draft must contain at most one question mark (${questionMarks})`);
if (exclamations > 2) errors.push(`record-style offnote draft has too many exclamation marks (${exclamations})`);
if (emotionMarks > 1) errors.push(`record-style offnote draft has too many emotion markers (${emotionMarks})`);
if (suspiciousFragments.length > 0) errors.push(`suspicious mojibake fragments: ${suspiciousFragments.join(", ")}`);
if (shoppingRouteTerms.some((pattern) => pattern.test(text))) errors.push("shopping/product-route content belongs to lifemagazine_, not offnote.kr");
if (forcedCtaTerms.some((pattern) => pattern.test(text))) errors.push("offnote personal-note drafts must not use conversion CTA language");
if (bannedPositioning.some((pattern) => pattern.test(text))) errors.push("offnote draft contains banned anxious, boastful, or explanatory positioning language");
if (polishedConclusionPatterns.some((pattern) => pattern.test(body))) errors.push("offnote draft uses a polished lesson, generic conclusion, or content-writer framing");
if ((draft.thread_comments || []).length > 0) errors.push("offnote personal-note drafts should not add promotional comment expansion");
if (Array.isArray(draft.cardnews_slides) && draft.cardnews_slides.length > 0) errors.push("offnote personal-note drafts should be text-first and must not require cardnews slides");

if (errors.length) {
  console.error(JSON.stringify({ ok: false, file, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, file, hangul, han, content_mode: draft.content_mode, record_shape: draft.record_shape || "legacy" }, null, 2));
