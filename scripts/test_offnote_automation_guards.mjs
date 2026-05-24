import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "offnote-guard-"));

function copyScript(name) {
  const target = path.join(tmp, "scripts", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "scripts", name), target);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

try {
  copyScript("generate_offnote_daily_post.mjs");
  copyScript("publish_offnote_due.mjs");

  const firstGenerate = spawnSync("node", ["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"], {
    cwd: tmp,
    encoding: "utf8",
  });
  if (firstGenerate.status !== 0) {
    throw new Error(`initial generate guard failed:\n${firstGenerate.stderr}\n${firstGenerate.stdout}`);
  }

  const generated = JSON.parse(firstGenerate.stdout);
  const draftPath = path.join(tmp, generated.draft);
  const publishedDraft = {
    ...readJson(draftPath),
    status: "published",
    media_urls: ["https://example.com/card.png"],
    published_at: "2026-05-23T08:29:48.793Z",
  };
  writeJson(draftPath, publishedDraft);

  const generate = spawnSync("node", ["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"], {
    cwd: tmp,
    encoding: "utf8",
  });
  if (generate.status !== 0) {
    throw new Error(`generate guard failed:\n${generate.stderr}\n${generate.stdout}`);
  }

  const afterGenerate = readJson(draftPath);
  if (afterGenerate.status !== "published" || afterGenerate.published_at !== publishedDraft.published_at) {
    throw new Error("Published draft was overwritten by preview generation.");
  }

  const flag = fs.readFileSync(path.join(tmp, "outputs", "afterwork-profit", "preview-created.txt"), "utf8").trim();
  if (flag !== "false") {
    throw new Error(`Expected preview-created=false for existing published draft, got ${flag}`);
  }

  const publish = spawnSync("node", ["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], {
    cwd: tmp,
    encoding: "utf8",
    env: {
      ...process.env,
      OFFNOTE_TELEGRAM_BOT_TOKEN: "",
      OFFNOTE_TELEGRAM_CHAT_ID: "",
    },
  });
  if (publish.status !== 0) {
    throw new Error(`auto-publish guard failed:\n${publish.stderr}\n${publish.stdout}`);
  }
  if (!publish.stdout.includes("already published")) {
    throw new Error(`Expected already-published skip message, got:\n${publish.stdout}`);
  }

  console.log(JSON.stringify({ ok: true, guard: "published drafts are not overwritten or republished" }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
