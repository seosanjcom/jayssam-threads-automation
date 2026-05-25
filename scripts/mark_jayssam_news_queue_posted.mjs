import fs from "node:fs";

const draftPath = process.argv[2];
const queuePath = process.env.JAYSSAM_NEWS_QUEUE_PATH || "content/jayssam-news-queue.csv";
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const token = process.env.THREADS_ACCESS_TOKEN || "";
const expectedUsername = (process.env.THREADS_EXPECTED_USERNAME || "jayssam_edu").replace(/^@/, "");

if (!draftPath) {
  console.error("Usage: node scripts/mark_jayssam_news_queue_posted.mjs DRAFT_JSON");
  process.exit(1);
}

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value !== ""));
}

function stringifyCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
          return text;
        })
        .join(","),
    )
    .join("\n") + "\n";
}

async function fetchPermalink(threadId) {
  if (!token || !threadId) return "";
  const url = new URL(`https://graph.threads.net/v1.0/${threadId}`);
  url.searchParams.set("fields", "id,permalink,username");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = await res.json();
  return data.permalink || "";
}

const draft = readJson(draftPath, null);
if (!draft?.queue_id) {
  console.log("Draft is not from Jayssam news queue; skip queue mark.");
  process.exit(0);
}

if (!fs.existsSync(queuePath)) {
  console.log(`Queue file not found: ${queuePath}`);
  process.exit(0);
}

const log = readJson(publishLogPath, []);
const publish = [...log].reverse().find((item) => item.draft_id === draft.id);
if (!publish) {
  console.log(`No publish log found for ${draft.id}; skip queue mark.`);
  process.exit(0);
}

const permalink = await fetchPermalink(publish.threads_media_id);
const rows = parseCsv(fs.readFileSync(queuePath, "utf8").replace(/^\uFEFF/, ""));
const header = rows[0] || [];
const ensureColumn = (name) => {
  let index = header.indexOf(name);
  if (index === -1) {
    header.push(name);
    rows.slice(1).forEach((row) => row.push(""));
    index = header.length - 1;
  }
  return index;
};

const idIndex = ensureColumn("id");
const doneIndex = ensureColumn("done_mark");
const statusIndex = ensureColumn("status");
const postedUrlIndex = ensureColumn("posted_url");
const publishedAtIndex = ensureColumn("published_at");

let updated = false;
for (const row of rows.slice(1)) {
  if (row[idIndex] !== draft.queue_id) continue;
  row[doneIndex] = "✅";
  row[statusIndex] = "posted";
  row[postedUrlIndex] = permalink || `https://www.threads.com/@${expectedUsername}`;
  row[publishedAtIndex] = publish.published_at || new Date().toISOString();
  updated = true;
}

if (!updated) {
  console.log(`Queue id not found: ${draft.queue_id}`);
  process.exit(0);
}

fs.writeFileSync(queuePath, stringifyCsv(rows), "utf8");
console.log(`Marked Jayssam queue row posted: ${draft.queue_id}`);
