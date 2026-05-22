import fs from "node:fs";

const draftPath = process.argv[2];

if (!draftPath) {
  console.error("Usage: node scripts/verify_media_urls.mjs DRAFT_JSON");
  process.exit(1);
}

const draft = JSON.parse(fs.readFileSync(draftPath, "utf8").replace(/^\uFEFF/, ""));
const urls = Array.isArray(draft.media_urls) ? draft.media_urls.filter(Boolean) : [];

if (!urls.length) {
  throw new Error("No media_urls found to verify.");
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const url of urls) {
  let ok = false;
  let lastStatus = "";
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const res = await fetch(url, { method: "GET" });
    lastStatus = `${res.status} ${res.statusText}`;
    if (res.ok) {
      ok = true;
      break;
    }
    await sleep(5000);
  }
  if (!ok) {
    throw new Error(`Media URL is not reachable: ${url} (${lastStatus})`);
  }
}

console.log(`Verified ${urls.length} media URL(s).`);
