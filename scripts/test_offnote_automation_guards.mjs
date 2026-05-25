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
  copyScript("validate_offnote_draft.mjs");

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

  const shoppingGenerate = spawnSync("node", ["scripts/generate_offnote_daily_post.mjs", "2026-05-25", "evening"], {
    cwd: tmp,
    encoding: "utf8",
  });
  if (shoppingGenerate.status !== 0) {
    throw new Error(`shopping-route generate guard failed:\n${shoppingGenerate.stderr}\n${shoppingGenerate.stdout}`);
  }
  const shoppingGenerated = JSON.parse(shoppingGenerate.stdout);
  const shoppingGeneratedDraft = readJson(path.join(tmp, shoppingGenerated.draft));
  const generatedText = JSON.stringify(shoppingGeneratedDraft);
  if (/장마철 신발|운동화 냄새|냉감침구|여름 침구/.test(generatedText)) {
    throw new Error("Offnote generator produced shopping/product-route content that belongs to lifemagazine_.");
  }

  const badDraftPath = path.join(
    tmp,
    "outputs",
    "afterwork-profit",
    "automation",
    "2026-05-24",
    "OFFNOTE-20260524-evening-shopping-route.json",
  );
  writeJson(badDraftPath, {
    id: "OFFNOTE-20260524-evening-shopping-route",
    account: "offnote.kr",
    topic: "장마철 신발 냄새 검색어 선점",
    status: "approved",
    threads_text:
      "이번 주엔 이 키워드 미리 선점하세요.\n\n`장마철 신발 냄새`\n`운동화 냄새 제거`\n`신발 건조기 단점`\n\n비 오기 시작하면 사람들이 빨리 찾는 쪽입니다. 하지만 이건 쇼핑/상품형 소재라 오프노트가 아니라 라이프매거진에 들어가야 합니다.",
    thread_comments: [
      "1. 구매형: 신발 건조기 / 신발 탈취제 / 신발 제습제",
      "2. 쇼츠 제목은 신발 건조기 사기 전에 보는 3가지",
    ],
    cardnews_slides: [
      { title: "장마철 신발 냄새", body: "신발 건조기와 탈취제 비교" },
      { title: "구매형", body: "제품명보다 상황" },
      { title: "쇼츠", body: "사기 전에 보는 3가지" },
      { title: "블로그", body: "구매형 키워드" },
    ],
  });
  const badValidate = spawnSync("node", ["scripts/validate_offnote_draft.mjs", badDraftPath], {
    cwd: tmp,
    encoding: "utf8",
  });
  if (badValidate.status === 0 || !badValidate.stderr.includes("lifemagazine_")) {
    throw new Error(`Expected shopping-route validation failure, got:\n${badValidate.stderr}\n${badValidate.stdout}`);
  }

  const badPublish = spawnSync("node", ["scripts/publish_offnote_due.mjs", "2026-05-24", "evening"], {
    cwd: tmp,
    encoding: "utf8",
    env: {
      ...process.env,
      OFFNOTE_TELEGRAM_BOT_TOKEN: "",
      OFFNOTE_TELEGRAM_CHAT_ID: "",
    },
  });
  if (badPublish.status !== 0 || !badPublish.stdout.includes("Held offnote draft")) {
    throw new Error(`Expected shopping-route publish hold, got:\n${badPublish.stderr}\n${badPublish.stdout}`);
  }
  const heldDraft = readJson(badDraftPath);
  if (heldDraft.status !== "held" || !String(heldDraft.hold_reason || "").includes("lifemagazine_")) {
    throw new Error("Shopping-route draft was not held before offnote publish.");
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
