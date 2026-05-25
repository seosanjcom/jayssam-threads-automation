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

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function graphGet(url, params = {}) {
  const endpoint = new URL(url);
  for (const [key, value] of Object.entries(params)) endpoint.searchParams.set(key, value);
  const res = await fetch(endpoint);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${endpoint.pathname} failed: ${JSON.stringify(json)}`);
  return json;
}

async function graphDelete(id, token) {
  const endpoint = new URL(`https://graph.threads.net/v1.0/${id}`);
  endpoint.searchParams.set("access_token", token);
  const res = await fetch(endpoint, { method: "DELETE" });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.error) {
    throw new Error(`DELETE ${id} failed: ${JSON.stringify(json)}`);
  }
  return json;
}

loadEnv();

const ids = process.argv.slice(2).flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
if (ids.length === 0) {
  console.error("Usage: node scripts/delete_threads_posts.mjs POST_ID [POST_ID...]");
  process.exit(1);
}

const token = process.env.THREADS_ACCESS_TOKEN;
const expectedUsername = process.env.THREADS_EXPECTED_USERNAME || "";
if (!token) throw new Error("THREADS_ACCESS_TOKEN is missing.");
if (!expectedUsername) throw new Error("THREADS_EXPECTED_USERNAME is required before deletion.");

const base = "https://graph.threads.net/v1.0";
const profile = await graphGet(`${base}/me`, {
  fields: "id,username,name",
  access_token: token,
});
if (String(profile.username || "").toLowerCase() !== expectedUsername.toLowerCase()) {
  throw new Error(`Refusing to delete from @${profile.username}; expected @${expectedUsername}.`);
}

const results = [];
for (const id of ids) {
  results.push({ id, result: await graphDelete(id, token) });
}

const logPath = process.env.THREADS_PUBLISH_LOG || "outputs/meta-publish-log.json";
const log = readJson(logPath, []);
const idSet = new Set(ids);
for (const item of log) {
  const relatedIds = [
    item.threads_media_id,
    item.media_id,
    ...(Array.isArray(item.reply_ids) ? item.reply_ids : []),
    ...(Array.isArray(item.published_reply_ids) ? item.published_reply_ids : []),
  ].filter(Boolean);
  if (relatedIds.some((id) => idSet.has(String(id)))) {
    item.status = "deleted_wrong_account_route";
    item.deleted_at = new Date().toISOString();
    item.delete_reason = "shopping/product-route content belongs to lifemagazine_, not offnote.kr";
    item.deleted_threads_ids = ids;
  }
}
writeJson(logPath, log);

console.log(JSON.stringify({ ok: true, profile: profile.username, deleted: results }, null, 2));
