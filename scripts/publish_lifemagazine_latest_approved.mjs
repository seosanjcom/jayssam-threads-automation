import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const account = "lifemagazine_";
const automationRoot = path.join("outputs", "lifemagazine", "automation");
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/lifemagazine/meta-publish-log.json";

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsonFiles(full));
    if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function isDraftDue(data, now = new Date()) {
  if (!data.scheduled_publish_at) return true;
  const scheduled = Date.parse(data.scheduled_publish_at);
  if (Number.isNaN(scheduled)) return true;
  return scheduled <= new Date(now).getTime();
}

export function latestApprovedLifemagazineDraft(options = {}) {
  const root = options.root || process.cwd();
  const now = options.now || new Date();
  const logPath = options.publishLogPath || path.join(root, publishLogPath);
  const publishedIds = options.publishedIds || new Set(readJsonIfExists(logPath, []).map((log) => log.draft_id));
  const dir = path.join(root, automationRoot);

  return findJsonFiles(dir)
    .map((file) => {
      try {
        return { file, data: JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")), mtime: fs.statSync(file).mtimeMs };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => item.data.account === account)
    .filter((item) => item.data.status === "approved")
    .filter((item) => !publishedIds.has(item.data.id))
    .filter((item) => isDraftDue(item.data, now))
    .sort((a, b) => b.mtime - a.mtime)[0] || null;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();

  if (!process.env.THREADS_ACCESS_TOKEN && process.env.LIFEMAGAZINE_THREADS_ACCESS_TOKEN) {
    process.env.THREADS_ACCESS_TOKEN = process.env.LIFEMAGAZINE_THREADS_ACCESS_TOKEN;
  }
  if (!process.env.THREADS_APP_ID && process.env.LIFEMAGAZINE_THREADS_APP_ID) {
    process.env.THREADS_APP_ID = process.env.LIFEMAGAZINE_THREADS_APP_ID;
  }
  if (!process.env.THREADS_APP_SECRET && process.env.LIFEMAGAZINE_THREADS_APP_SECRET) {
    process.env.THREADS_APP_SECRET = process.env.LIFEMAGAZINE_THREADS_APP_SECRET;
  }

  const token = process.env.THREADS_ACCESS_TOKEN || "";
  if (!token || token.includes("replace_")) {
    console.log("Lifemagazine publish skipped: THREADS_ACCESS_TOKEN is missing.");
    process.exit(0);
  }

  const latest = latestApprovedLifemagazineDraft();
  if (!latest) {
    console.log("No due approved lifemagazine_ Threads post found.");
    process.exit(0);
  }

  console.log(`Publishing latest approved lifemagazine_ post: ${latest.file}`);
  const result = spawnSync("node", ["scripts/threads_publish.mjs", latest.file], {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    env: {
      ...process.env,
      THREADS_EXPECTED_USERNAME: process.env.THREADS_EXPECTED_USERNAME || "lifemagazine_",
      THREADS_PUBLISH_LOG: process.env.THREADS_PUBLISH_LOG || "outputs/lifemagazine/meta-publish-log.json",
    },
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}
