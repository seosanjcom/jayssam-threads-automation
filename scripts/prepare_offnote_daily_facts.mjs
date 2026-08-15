import fs from "node:fs";
import path from "node:path";

const [date, sourceFile] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !sourceFile) {
  console.error("Usage: node scripts/prepare_offnote_daily_facts.mjs YYYY-MM-DD FACTS_JSON");
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

const raw = readJson(sourceFile);
const facts = Array.isArray(raw) ? raw : raw.facts;
if (!Array.isArray(facts) || facts.length < 1 || facts.length > 2) {
  throw new Error("Daily fact input must include one or two facts.");
}

const ids = new Set();
const normalized = facts.map((value, index) => {
  const item = typeof value === "string" ? { text: value } : value || {};
  const text = String(item.text || "").trim();
  const id = String(item.id || `fact-${date.replaceAll("-", "")}-${index + 1}`);
  if (text.length < 8 || text.length > 500) throw new Error(`Fact ${index + 1} must be between 8 and 500 characters.`);
  if (ids.has(id)) throw new Error(`Duplicate fact id: ${id}`);
  if (/쿠팡\s*상품|상품\s*링크|제휴\s*링크|카톡방|댓글.*(?:남겨|알려|달아)/.test(text)) throw new Error(`Fact ${id} is not an offnote personal record.`);
  ids.add(id);
  return {
    id,
    title: String(item.title || "오늘 기록"),
    text,
    tag: String(item.tag || "일하는일상"),
    subject_cluster: String(item.subject_cluster || "actual_work"),
    shape: String(item.shape || "memo"),
    source: String(item.source || "operator_daily_note"),
  };
});

const target = path.join("outputs", "afterwork-profit", "offnote-daily-facts", `${date}.json`);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify({ date, facts: normalized, prepared_at: new Date().toISOString() }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, date, facts: normalized.length, target: target.replaceAll("\\", "/") }, null, 2));
