import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSchedule } from "./offnote_schedule.mjs";

const KST = "Asia/Seoul";
const RECENT_DEDUPE_DAYS = 21;
const TRAIT_WINDOW_DAYS = 14;
const OUTPUT_ROOT = path.join("outputs", "afterwork-profit", "automation");
const PUBLISH_LOG = path.join("outputs", "afterwork-profit", "meta-publish-log.json");
const DAILY_FACTS_ROOT = path.join("outputs", "afterwork-profit", "offnote-daily-facts");
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const EVERGREEN_POOL_FILE = path.join(SCRIPT_DIR, "offnote_evergreen_observations.json");

function kstDate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKey(date) { return date.replaceAll("-", ""); }
function dayNumber(date) { return Number(String(date).replaceAll("-", "")) || 0; }
function readJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) : fallback; } catch { return fallback; }
}

function daysBetween(from, to) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function countLines(text) { return String(text || "").split("\n").filter(Boolean).length; }
function lineBand(text) {
  const count = countLines(text);
  if (count <= 1) return "one";
  if (count <= 3) return "short";
  if (count <= 5) return "medium";
  return "long";
}

function endingFamily(note) {
  if (note.ending_family) return note.ending_family;
  const last = String(note.text || "").split("\n").filter(Boolean).at(-1) || "";
  if (last.includes("?")) return "question";
  if (/(없음|옴|중|임)$/.test(last)) return "fragment";
  if (/(요|네요)$/.test(last)) return "polite_observation";
  if (/(끝남|보냄|여기까지)$/.test(last)) return "complete";
  return "declarative";
}

function readRecentDrafts(date, window = TRAIT_WINDOW_DAYS) {
  const rows = [];
  if (!fs.existsSync(OUTPUT_ROOT)) return rows;
  for (const day of fs.readdirSync(OUTPUT_ROOT)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(day, date) < 0 || daysBetween(day, date) > window) continue;
    const folder = path.join(OUTPUT_ROOT, day);
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json"))) {
      const draft = readJson(path.join(folder, file), {});
      if (draft && !String(draft.status || "").startsWith("deleted_")) rows.push(draft);
    }
  }
  return rows.sort((a, b) => String(b.created_at || b.date || "").localeCompare(String(a.created_at || a.date || "")));
}

function recentContentIds(date) {
  const ids = new Set();
  for (const row of readJson(PUBLISH_LOG, [])) {
    if (!row || String(row.status || "").startsWith("deleted_")) continue;
    const published = String(row.published_at || "").slice(0, 10);
    if (published && daysBetween(published, date) >= 0 && daysBetween(published, date) <= RECENT_DEDUPE_DAYS) ids.add(String(row.content_id || row.draft_id || ""));
  }
  for (const draft of readRecentDrafts(date, RECENT_DEDUPE_DAYS)) ids.add(String(draft.content_id || draft.id || ""));
  return ids;
}

function existingDraftForSlot(date, slot) {
  const folder = path.join(OUTPUT_ROOT, date);
  if (!fs.existsSync(folder)) return "";
  const prefix = `OFFNOTE-${dateKey(date)}-${slot}-`;
  const files = fs.readdirSync(folder)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .map((file) => path.join(folder, file))
    .filter((file) => {
      const draft = readJson(file, {});
      return !["superseded_by_manual_input", "deleted", "deleted_by_operator"].includes(draft.status);
    })
    .sort();
  return files.length ? files[0] : "";
}

function normalizeActualFacts(date) {
  const raw = readJson(path.join(DAILY_FACTS_ROOT, `${date}.json`), []);
  const items = Array.isArray(raw) ? raw : Array.isArray(raw.facts) ? raw.facts : Array.isArray(raw.records) ? raw.records : [];
  return items.map((item, index) => {
    const value = typeof item === "string" ? { text: item } : item || {};
    return {
      id: String(value.id || `actual-${dateKey(date)}-${index + 1}`),
      title: String(value.title || "오늘 기록"),
      shape: String(value.shape || "memo"),
      tag: String(value.tag || "일하는일상"),
      text: String(value.text || "").trim(),
      subject_cluster: String(value.subject_cluster || "actual_work"),
      ending_family: String(value.ending_family || "input_record"),
      source_mode: String(value.source_mode || (value.source === "telegram_manual_input" ? "telegram_manual_input" : "daily_fact_input")),
      priority: Boolean(value.priority || value.source_mode === "telegram_manual_input"),
      priority_slot: String(value.priority_slot || ""),
    };
  }).filter((item) => item.text.length >= 8 && item.text.length <= 500);
}

function loadEvergreenPool() {
  const raw = readJson(EVERGREEN_POOL_FILE, []);
  const items = Array.isArray(raw) ? raw : [];
  return items.map((item, index) => ({
    id: String(item.id || `evergreen-${index + 1}`),
    title: String(item.title || item.tag || "디지털 일상"),
    shape: String(item.shape || "memo"),
    tag: String(item.tag || "일하는일상"),
    text: String(item.text || "").trim(),
    subject_cluster: String(item.subject_cluster || item.tag || "digital_work"),
    ending_family: String(item.ending_family || "observation"),
    source_mode: "curated_evergreen_observation",
    portfolio: String(item.portfolio || "digital_work"),
    funnel_stage: String(item.funnel_stage || "record"),
  })).filter((item) => item.text.length >= 8 && item.text.length <= 500);
}

function countBy(rows, key) {
  return rows.reduce((result, row) => {
    const value = String(row[key] || "unknown");
    result.set(value, (result.get(value) || 0) + 1);
    return result;
  }, new Map());
}

function pickNote(date, slot) {
  const recentIds = recentContentIds(date);
  const history = readRecentDrafts(date);
  const actualPool = normalizeActualFacts(date).filter((note) => !recentIds.has(note.id));
  const priorityPool = actualPool.filter((note) => note.priority || note.source_mode === "telegram_manual_input");
  const slotPriorityPool = priorityPool.filter((note) => !note.priority_slot || note.priority_slot === slot);
  const selectedActualPool = slotPriorityPool.length ? slotPriorityPool : actualPool;
  const pool = selectedActualPool.length ? selectedActualPool : loadEvergreenPool().filter((note) => !recentIds.has(note.id));
  if (!pool.length) {
    const fallbackPool = loadEvergreenPool();
    if (!fallbackPool.length) return null;
    return fallbackPool[(dayNumber(date) + (slot === "night" ? 1 : 0)) % fallbackPool.length];
  }

  const offset = (dayNumber(date) + (slot === "night" ? 7 : 0)) % pool.length;
  const endings = countBy(history, "record_ending_family");
  const clusters = countBy(history, "subject_cluster");
  const bands = countBy(history, "line_band");
  const lastTwoFamilies = history.slice(0, 2).map((row) => String(row.record_ending_family || ""));
  const recentClusters = history.slice(0, 4).map((row) => String(row.subject_cluster || ""));

  return pool
    .map((note, index) => {
      const family = endingFamily(note);
      const cluster = String(note.subject_cluster || "unknown");
      const band = lineBand(note.text);
      let score = (index - offset + pool.length) % pool.length;
      if (lastTwoFamilies.includes(family)) score += 100;
      if (recentClusters.filter((value) => value === cluster).length >= 2) score += 50;
      if ((clusters.get(cluster) || 0) >= 5) score += 35;
      if ((endings.get(family) || 0) >= 5) score += 24;
      if ((bands.get(band) || 0) >= 7) score += 16;
      return { note, score };
    })
    .sort((left, right) => left.score - right.score || String(left.note.id).localeCompare(String(right.note.id)))[0].note;
}

function personalNoteText(note) {
  return note.text.length <= 500 ? note.text : note.text.slice(0, 499).trimEnd() + "…";
}

function makeDraft(date, slot) {
  const note = pickNote(date, slot);
  const schedule = loadSchedule(process.cwd());
  if (!note) {
    return null;
  }
  const text = personalNoteText(note);
  const family = endingFamily(note);
  return {
    id: `OFFNOTE-${dateKey(date)}-${slot}-${note.id}`,
    content_id: note.id,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    date,
    slot,
    topic: note.title,
    topic_tag: note.tag,
    status: "approved",
    created_at: new Date().toISOString(),
    source: "github-actions-offnote-auto-generator",
    recommended_publish_time: `${schedule.slots[slot] || (slot === "night" ? "21:30" : "15:30")} KST`,
    content_mode: "digital_nomad_personal_note",
    pillar: "offnote_unfinished_work_record",
    record_shape: note.shape,
    source_mode: note.source_mode || "curated_evergreen_observation",
    manual_input_id: note.source_mode === "telegram_manual_input" ? note.id : "",
    subject_cluster: note.subject_cluster || "unknown",
    record_ending_family: family,
    line_band: lineBand(text),
    portfolio: note.portfolio || "actual_work",
    funnel_stage: note.funnel_stage || (note.source_mode === "telegram_manual_input" ? "manual_record" : "record"),
    threads_text: text,
    thread_comments: [],
    cardnews_slides: [],
    offnote_tone_profile: {
      voice: "디지털로 일하고 만들고 수익을 만드는 여러 방식을 실제 장면으로 기록하는 노트",
      structure: "실제 일일 입력이 있으면 우선 사용하고, 없으면 검증된 상시 관찰형 소재에서 자동 생성",
      ending_policy: "미결정·완료·관찰·다음 생각·실제 질문을 분산하며, 교훈과 독자 교육으로 닫지 않음",
      portfolio_policy: "기존 일상 기록과 대행·콘텐츠·웹·디지털상품·제휴·강의 준비 소재를 보존하고, 실제 입력이 없을 때만 검증된 관찰 풀에서 균형 순환",
      course_funnel_policy: "온라인 강의를 직접 홍보하지 않고, 실제 작업·실험·정리 과정에서 강의로 확장할 만한 문제만 메타데이터로 축적",
    },
    safety_rules: [
      "Do not invent a client name or exact performance number.",
      "Use daily fact input if available, otherwise use curated observation pool safely.",
      "Do not add a KakaoTalk, Instagram, materials, or generic comment CTA.",
      "Do not add a lesson, value statement, or polished conclusion after the event.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const outDir = path.join(OUTPUT_ROOT, date);
fs.mkdirSync(outDir, { recursive: true });

const existingPath = existingDraftForSlot(date, slot);
let draft = existingPath ? readJson(existingPath, null) : null;
const availableFacts = normalizeActualFacts(date);
const hasPriorityForSlot = availableFacts.some((note) =>
  (note.priority || note.source_mode === "telegram_manual_input") && (!note.priority_slot || note.priority_slot === slot)
);
if (draft && hasPriorityForSlot && draft.source_mode !== "telegram_manual_input") {
  draft.status = "superseded_by_manual_input";
  draft.superseded_at = new Date().toISOString();
  fs.writeFileSync(existingPath, JSON.stringify(draft, null, 2), "utf8");
  draft = null;
}
if (!draft || String(draft.status || "").startsWith("deleted_")) {
  draft = makeDraft(date, slot);
  if (draft) {
    const filename = `${draft.id}.json`;
    fs.writeFileSync(path.join(outDir, filename), JSON.stringify(draft, null, 2), "utf8");
    console.log(`Successfully generated Offnote draft for ${date} [${slot}]: ${filename}`);
  } else {
    console.log(`No draft generated for ${date} [${slot}]`);
  }
} else {
  console.log(`Reusing existing Offnote draft for ${date} [${slot}]: ${draft.id}`);
}
