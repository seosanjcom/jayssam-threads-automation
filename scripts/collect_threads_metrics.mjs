import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

async function graphGet(url, params) {
  const requestUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") requestUrl.searchParams.set(key, value);
  }
  const res = await fetch(requestUrl);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return JSON.parse(text);
}

loadEnv();

const token = process.env.THREADS_ACCESS_TOKEN;
if (!token) throw new Error("THREADS_ACCESS_TOKEN is missing in .env");

const root = process.cwd();
const logPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const publishLog = readJson(logPath, []);
const base = "https://graph.threads.net/v1.0";
const metricNames = ["views", "likes", "replies", "reposts", "quotes", "shares"];
const outDir = path.join(root, "outputs", "automation", "metrics");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "threads-post-metrics.csv");
const errorPath = path.join(outDir, "threads-post-metrics-errors.csv");

if (!fs.existsSync(outPath)) {
  fs.writeFileSync(outPath, "collected_at,draft_id,thread_id,topic,views,likes,replies,reposts,quotes,shares\n", "utf8");
}

if (!fs.existsSync(errorPath)) {
  fs.writeFileSync(errorPath, "collected_at,draft_id,thread_id,error\n", "utf8");
}

const now = new Date().toISOString();
const rows = [];
const errorRows = [];

for (const item of publishLog.filter((entry) => entry.threads_media_id)) {
  try {
    const insights = await graphGet(`${base}/${item.threads_media_id}/insights`, {
      metric: metricNames.join(","),
      access_token: token,
    });
    const values = Object.fromEntries(metricNames.map((name) => [name, 0]));
    for (const metric of insights.data || []) {
      const first = Array.isArray(metric.values) ? metric.values[0] : undefined;
      values[metric.name] = first?.value ?? metric.value ?? 0;
    }
    rows.push([
      now,
      item.draft_id,
      item.threads_media_id,
      item.topic || "",
      values.views,
      values.likes,
      values.replies,
      values.reposts,
      values.quotes,
      values.shares,
    ].map(csvEscape).join(","));
  } catch (error) {
    errorRows.push([
      now,
      item.draft_id,
      item.threads_media_id,
      error.message,
    ].map(csvEscape).join(","));
  }
}

if (rows.length) fs.appendFileSync(outPath, `${rows.join("\n")}\n`, "utf8");
if (errorRows.length) fs.appendFileSync(errorPath, `${errorRows.join("\n")}\n`, "utf8");
console.log(`Collected metrics for ${rows.length} post(s): ${outPath}`);
if (errorRows.length) console.log(`Skipped ${errorRows.length} post(s); see ${errorPath}`);
