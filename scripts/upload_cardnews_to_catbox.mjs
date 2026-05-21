import fs from "node:fs";
import path from "node:path";

const draftPath = process.argv[2];
if (!draftPath) {
  console.error("Usage: node scripts/upload_cardnews_to_catbox.mjs DRAFT_JSON");
  process.exit(1);
}

const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
const localPaths = Array.isArray(draft.local_media_paths) ? draft.local_media_paths : [];
if (!localPaths.length) {
  throw new Error("No local_media_paths found. Generate cardnews images first.");
}

const urls = [];
for (const localPath of localPaths) {
  const bytes = fs.readFileSync(localPath);
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.set("reqtype", "fileupload");
  form.set("fileToUpload", blob, path.basename(localPath));
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
  });
  const text = (await res.text()).trim();
  if (!res.ok || !text.startsWith("https://")) {
    throw new Error(`Upload failed for ${localPath}: ${res.status} ${text}`);
  }
  urls.push(text);
}

draft.media_urls = urls;
fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

const outDir = path.dirname(localPaths[0]);
fs.writeFileSync(path.join(outDir, "catbox-urls.txt"), `${urls.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ draft: draftPath, media_urls: urls }, null, 2));
