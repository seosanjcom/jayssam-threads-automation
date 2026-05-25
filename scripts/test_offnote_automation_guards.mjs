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

function runNode(args, extra = {}) {
  return spawnSync("node", args, {
    cwd: tmp,
    encoding: "utf8",
    ...extra,
  });
}

try {
  copyScript("generate_offnote_daily_post.mjs");
  copyScript("publish_offnote_due.mjs");
  copyScript("validate_offnote_draft.mjs");

  const firstGenerate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
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

  const generate = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-23", "evening"]);
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

  const blogDates = ["2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30"];
  const generatedBlogDrafts = blogDates.map((date) => {
    const result = runNode(["scripts/generate_offnote_daily_post.mjs", date, "evening"]);
    if (result.status !== 0) {
      throw new Error(`blog-focused generate failed for ${date}:\n${result.stderr}\n${result.stdout}`);
    }
    return readJson(path.join(tmp, JSON.parse(result.stdout).draft));
  });

  const generatedText = JSON.stringify(generatedBlogDrafts);
  if (!/체험단|블로그|생활비|네일샵|미용실|카페/.test(generatedText)) {
    throw new Error("Offnote generator should focus on approachable blog and experience-review content.");
  }
  if (/이번 주엔 이 키워드 미리 선점하세요/.test(generatedText)) {
    throw new Error("Offnote generator is still stuck on the old keyword-preemption template.");
  }
  if (/제휴 링크|구매링크|민경님|소유님|유튜브에 나온 제품/.test(generatedText)) {
    throw new Error("Offnote generator produced lifemagazine-style affiliate or celebrity-shopping content.");
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
    topic: "민경님 유튜브 컨실러 추천템",
    status: "approved",
    threads_text:
      "[제휴 링크 포함]\n\n민경님이 유튜브에서 언급한 컨실러가 궁금해서 찾아봤습니다. 정보는 댓글에 정리했고 구매링크도 함께 남겨둘게요.",
    thread_comments: [
      "1. 구매링크: https://example.com/item",
      "2. 이 댓글에는 제휴 링크가 포함되어 있습니다.",
    ],
    cardnews_slides: [
      { title: "민경님 컨실러", body: "유튜브에 나온 제품" },
      { title: "상품 링크", body: "댓글에 정리" },
      { title: "제휴 링크", body: "공정위 문구 필요" },
      { title: "라이프매거진", body: "연예인 라이프 소재" },
    ],
  });
  const badValidate = runNode(["scripts/validate_offnote_draft.mjs", badDraftPath]);
  if (badValidate.status === 0 || !badValidate.stderr.includes("lifemagazine_")) {
    throw new Error(`Expected shopping-route validation failure, got:\n${badValidate.stderr}\n${badValidate.stdout}`);
  }

  const badPublish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-24", "evening"], {
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

  const publish = runNode(["scripts/publish_offnote_due.mjs", "2026-05-23", "evening"], {
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

  console.log(JSON.stringify({ ok: true, guard: "offnote blog focus and publish guards pass" }, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
