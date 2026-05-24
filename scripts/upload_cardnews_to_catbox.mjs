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
  const resolvedPath = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  const bytes = fs.readFileSync(resolvedPath);
  const blob = new Blob([bytes], { type: contentType });
  const form = new FormData();
  form.set("reqtype", "fileupload");
  form.set("fileToUpload", blob, path.basename(resolvedPath));
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

const firstPath = path.isAbsolute(localPaths[0]) ? localPaths[0] : path.join(process.cwd(), localPaths[0]);
const outDir = path.dirname(firstPath);
fs.writeFileSync(path.join(outDir, "catbox-urls.txt"), `${urls.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ draft: draftPath, media_urls: urls }, null, 2));
