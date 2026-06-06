import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { validateDailyQueue } from "./blog_marketing_policy.mjs";

test("blog queue requires at least five posts per account per day", () => {
  const errors = validateDailyQueue({
    accountKey: "temanju",
    date: "2026-06-06",
    posts: []
  });
  assert.match(errors.join("\n"), /at least 5 posts/);
});

test("shopping CPA posts are blocked without affiliate links and disclosure", () => {
  const errors = validateDailyQueue({
    accountKey: "temanju",
    date: "2026-06-06",
    posts: Array.from({ length: 5 }, (_, index) => ({
      id: `post-${index}`,
      title: "테스트용 블로그 제목입니다",
      body: "가".repeat(950),
      tags: ["a", "b", "c", "d", "e"],
      quality_rules: { SUA: true, AU: true, GU: true },
      content_type: index === 0 ? "shopping_cpa" : "search_answer"
    }))
  });
  assert.match(errors.join("\n"), /requires affiliate_links/);
  assert.match(errors.join("\n"), /affiliate disclosure/);
});

test("generated temanju queue has five posts and blocks placeholder CPA links", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-queue-"));
  try {
    fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "config"), { recursive: true });
    for (const file of ["blog_marketing_policy.mjs", "generate_blog_daily_queue.mjs", "validate_blog_daily_queue.mjs"]) {
      fs.copyFileSync(path.join(process.cwd(), "scripts", file), path.join(tmp, "scripts", file));
    }
    fs.copyFileSync(path.join(process.cwd(), "config", "blog-accounts.json"), path.join(tmp, "config", "blog-accounts.json"));
    const result = spawnSync("node", ["scripts/generate_blog_daily_queue.mjs", "temanju", "2026-06-06"], {
      cwd: tmp,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const output = JSON.parse(result.stdout).output;
    const queue = JSON.parse(fs.readFileSync(path.join(tmp, output), "utf8"));
    assert.equal(queue.posts.length, 5);
    assert.equal(queue.posts.filter((post) => post.content_type === "shopping_cpa").length, 2);
    assert.equal(queue.posts.filter((post) => post.status === "blocked_cpa_link_required").length, 2);
    for (const post of queue.posts) {
      assert.equal(post.quality_rules.SUA, true);
      assert.equal(post.quality_rules.AU, true);
      assert.equal(post.quality_rules.GU, true);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
