import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CDN_REPOSITORY = process.env.THREADS_CARDNEWS_CDN_REPOSITORY || "seosanjcom/jayssam-threads-automation";

function gitText(args) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function publicCdnUrl(localPath, { root, revision, repository } = {}) {
  const resolvedPath = path.resolve(root || process.cwd(), localPath);
  const relativePath = path.relative(root || process.cwd(), resolvedPath).split(path.sep).join("/");
  if (!relativePath || relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    throw new Error(`Card image must be inside the repository: ${localPath}`);
  }
  if (!fs.existsSync(resolvedPath)) throw new Error(`Card image not found: ${localPath}`);
  return `https://cdn.jsdelivr.net/gh/${repository || CDN_REPOSITORY}@${revision}/${relativePath}`;
}

const draftPath = process.argv[2];
if (!draftPath) {
  console.error("Usage: node scripts/upload_cardnews_to_catbox.mjs DRAFT_JSON");
  process.exit(1);
}

const draft = JSON.parse(fs.readFileSync(draftPath, "utf8").replace(/^\uFEFF/, ""));
const localPaths = Array.isArray(draft.local_media_paths) ? draft.local_media_paths : [];
if (!localPaths.length) {
  throw new Error("No local_media_paths found. Generate cardnews images first.");
}

// Catbox now rejects anonymous GitHub-hosted uploads with HTTP 412. Card assets are committed before
// this script runs; an immutable jsDelivr URL avoids the rejected third-party upload path altogether.
const repositoryRoot = gitText(["rev-parse", "--show-toplevel"]);
const revision = gitText(["rev-parse", "HEAD"]);
const urls = localPaths.map((localPath) => publicCdnUrl(localPath, {
  root: repositoryRoot,
  revision,
  repository: CDN_REPOSITORY,
}));

draft.media_urls = urls;
fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

const firstPath = path.isAbsolute(localPaths[0]) ? localPaths[0] : path.join(process.cwd(), localPaths[0]);
const outDir = path.dirname(firstPath);
fs.writeFileSync(path.join(outDir, "cdn-urls.txt"), `${urls.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ draft: draftPath, media_urls: urls, delivery: "jsdelivr_commit_cdn", revision }, null, 2));
