import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const automationRoot = path.join(root, "outputs", "automation");
const publishLogPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const requestedDraftPath = process.argv[2] || "";

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

const publishedDraftIds = new Set(readJsonIfExists(publishLogPath, []).map((log) => log.draft_id));

const sourceFiles = requestedDraftPath ? [path.resolve(root, requestedDraftPath)] : findJsonFiles(automationRoot);

const approved = sourceFiles
  .map((file) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
      return { file, data, mtime: fs.statSync(file).mtimeMs };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .filter((item) => !publishedDraftIds.has(item.data.id))
  .filter((item) => item.data.status === "approved")
  .sort((a, b) => b.mtime - a.mtime);

if (!approved.length) {
  console.log("No approved Threads post found.");
  process.exit(0);
}

const latest = approved[0];
console.log(`Publishing latest approved: ${latest.file}`);

const result = spawnSync("node", ["scripts/threads_publish.mjs", latest.file], {
  cwd: root,
  shell: true,
  encoding: "utf8"
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
