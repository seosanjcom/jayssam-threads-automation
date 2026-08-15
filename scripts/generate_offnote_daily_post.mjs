import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KST = "Asia/Seoul";
const RECENT_DEDUPE_DAYS = 21;
const TRAIT_WINDOW_DAYS = 14;
const OUTPUT_ROOT = path.join("outputs", "afterwork-profit", "automation");
const PUBLISH_LOG = path.join("outputs", "afterwork-profit", "meta-publish-log.json");
const DAILY_FACTS_ROOT = path.join("outputs", "afterwork-profit", "offnote-daily-facts");
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LENGTH_SEQUENCE = ["one", "short", "medium", "one", "short", "long", "short", "medium", "one", "short", "medium", "long", "one", "short", "medium", "short", "one", "long", "short", "medium"];

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

// 실제 입력이 없을 때는 ‘오늘 무슨 일이 있었다’고 꾸며내지 않는다.
// 검증된 짧은 관찰형만 사용하며, 실제 사실 입력이 있으면 그것을 최우선으로 쓴다.
const EVERGREEN_RECORDS = readJson(path.join(SCRIPT_DIR, "offnote_evergreen_observations.json"), []);

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
  const files = fs.readdirSync(folder).filter((file) => file.startsWith(prefix) && file.endsWith(".json")).sort();
  return files.length ? path.join(folder, files[0]) : "";
}

function normalizeActualFacts(date) {
  const raw = readJson(path.join(DAILY_FACTS_ROOT, `${date}.json`), []);
  const items = Array.isArray(raw) ? raw : Array.isArray(raw.records) ? raw.records : [];
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
      source_mode: "daily_fact_input",
    };
  }).filter((item) => item.text.length >= 8 && item.text.length <= 500);
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
  const actual = normalizeActualFacts(date).filter((note) => !recentIds.has(note.id));
  const pool = (actual.length ? actual : EVERGREEN_RECORDS).filter((note) => !recentIds.has(String(note.id)));
  if (!pool.length) throw new Error("최근 21일 안에 재사용하지 않을 오프노트 기록 소재가 부족합니다. 새 실제 입력 또는 관찰형 소재를 추가하세요.");

  const endings = countBy(history, "record_ending_family");
  const clusters = countBy(history, "subject_cluster");
  const bands = countBy(history, "line_band");
  const lastTwoFamilies = history.slice(0, 2).map((row) => String(row.record_ending_family || ""));
  const recentClusters = history.slice(0, 4).map((row) => String(row.subject_cluster || ""));
  const offset = (dayNumber(date) + (slot === "night" ? 17 : 0)) % pool.length;
  const preferredBand = LENGTH_SEQUENCE[(dayNumber(date) + (slot === "night" ? 1 : 0)) % LENGTH_SEQUENCE.length];

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
      if (band !== preferredBand) score += 42;
      return { note, score };
    })
    .sort((left, right) => left.score - right.score || String(left.note.id).localeCompare(String(right.note.id)))[0].note;
}

function personalNoteText(note) {
  return note.text.length <= 500 ? note.text : note.text.slice(0, 499).trimEnd() + "…";
}

function makeDraft(date, slot) {
  const note = pickNote(date, slot);
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
    source: "github-actions-offnote-digital-nomad-notes",
    recommended_publish_time: slot === "night" ? "21:30 KST" : "15:30 KST",
    content_mode: "digital_nomad_personal_note",
    pillar: "offnote_unfinished_work_record",
    record_shape: note.shape,
    source_mode: note.source_mode || "curated_evergreen_observation",
    subject_cluster: note.subject_cluster || "unknown",
    record_ending_family: family,
    line_band: lineBand(text),
    threads_text: text,
    thread_comments: [],
    cardnews_slides: [],
    offnote_tone_profile: {
      voice: "일을 능숙하게 굴리지만 매번 답을 알고 있는 척하지 않는 사람의 작업·이동 기록",
      structure: "실제 입력이 있으면 그 사실을 우선하고, 없으면 사실을 주장하지 않는 짧은 관찰형으로 제한",
      ending_policy: "미결정·완료·관찰·다음 생각·실제 질문을 분산하며, 교훈과 독자 교육으로 닫지 않음",
      ending_variation: "해요체·평서형·명사형·생략형을 상황에 따라 섞고 같은 끝맺음 계열의 연속을 피함",
      cta_policy: "일상 글에는 CTA 없음. 질문은 실제 판단이 필요한 날에만 하나까지 허용.",
      banned_framing: ["불안", "버텼다", "아무것도 못 했다", "성공 비법", "나처럼 해", "수익 보장", "자기계발 조언"],
    },
    safety_rules: [
      "Do not invent a daily event, time, place, client, performance number, or detailed factual claim.",
      "Use actual daily fact input first; otherwise use only a curated evergreen observation that makes no false daily claim.",
      "Do not add a KakaoTalk, Instagram, materials, or generic comment CTA.",
      "Do not add a lesson, value statement, or polished conclusion after the event.",
      "Avoid repeating subject clusters, length bands, or ending families across recent records.",
      "Do not reuse the same content_id within 21 days.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const outDir = path.join(OUTPUT_ROOT, date);
fs.mkdirSync(outDir, { recursive: true });
const createdFlagPath = path.join("outputs", "afterwork-profit", "preview-created.txt");
const existingSlotPath = existingDraftForSlot(date, slot);

if (existingSlotPath) {
  const existing = readJson(existingSlotPath, {});
  if (new Set(["approved", "pending_approval", "published", "held", "publish_failed", "ready_to_review"]).has(existing.status)) {
    const portableExistingPath = existingSlotPath.replaceAll("\\", "/");
    fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableExistingPath}\n`, "utf8");
    fs.writeFileSync(createdFlagPath, "false\n", "utf8");
    console.log(JSON.stringify({ ok: true, created: false, draft: portableExistingPath, id: existing.id, status: existing.status }, null, 2));
    process.exit(0);
  }
}

const draft = makeDraft(date, slot);
const outPath = path.join(outDir, `${draft.id}.json`);
const portableOutPath = outPath.replaceAll("\\", "/");
fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
fs.writeFileSync(createdFlagPath, "true\n", "utf8");
console.log(JSON.stringify({ ok: true, created: true, draft: portableOutPath, id: draft.id }, null, 2));
