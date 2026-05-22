import fs from "node:fs";

const draftPath = process.argv[2];
const repo = process.env.GITHUB_REPOSITORY || "seosanjcom/jayssam-threads-automation";
const ref = process.env.GITHUB_REF_NAME || "master";

if (!draftPath) {
  console.error("Usage: node scripts/use_github_raw_media.mjs DRAFT_JSON");
  process.exit(1);
}

const draft = JSON.parse(fs.readFileSync(draftPath, "utf8").replace(/^\uFEFF/, ""));
const localPaths = Array.isArray(draft.local_media_paths) ? draft.local_media_paths : [];
if (!localPaths.length) {
  throw new Error("No local_media_paths found. Generate cardnews images first.");
}

draft.media_urls = localPaths.map((item) => `https://raw.githubusercontent.com/${repo}/${ref}/${item.replaceAll("\\", "/")}`);
fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ draft: draftPath, media_urls: draft.media_urls }, null, 2));
