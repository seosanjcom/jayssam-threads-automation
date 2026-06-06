import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { buildPerformanceReport } from "./blog_performance_loop.mjs";

function sampleQueue(accountKey) {
  return {
    accountKey,
    date: "2026-06-06",
    posts: [
      {
        id: `${accountKey}-winner`,
        title: "이번 주 선점할 장마철 신발 냄새 키워드",
        status: "ready_to_review",
        content_type: "shopping_cpa",
        affiliate_links: [{ platform: "coupang", url: "https://link.coupang.com/a/real123", status: "ready" }]
      },
      {
        id: `${accountKey}-weak`,
        title: "부업 블로그 글쓰기 기준",
        status: "ready_to_review",
        content_type: "search_answer"
      },
      {
        id: `${accountKey}-blocked`,
        title: "링크 없는 쇼핑 글",
        status: "blocked_cpa_link_required",
        content_type: "shopping_cpa",
        affiliate_links: [{ platform: "coupang", url: "https://example.com/replace", status: "needs_real_link" }]
      }
    ]
  };
}

test("performance report turns metrics into account actions and next-day recommendations", () => {
  const report = buildPerformanceReport({
    date: "2026-06-06",
    queues: [sampleQueue("taemomjo"), sampleQueue("offnote_blog")],
    metrics: {
      "taemomjo-winner": { views: 280, clicks: 14, conversions: 2, revenueKrw: 6400, comments: 3 },
      "taemomjo-weak": { views: 80, clicks: 0, conversions: 0, revenueKrw: 0, comments: 0 },
      "offnote_blog-winner": { views: 90, clicks: 3, conversions: 0, revenueKrw: 0, comments: 1 }
    }
  });

  assert.equal(report.date, "2026-06-06");
  assert.equal(report.accounts.length, 2);
  const taemomjo = report.accounts.find((item) => item.accountKey === "taemomjo");
  assert.equal(taemomjo.postsPlanned, 3);
  assert.equal(taemomjo.blockedCpaPosts, 1);
  assert.equal(taemomjo.affiliateClicks, 14);
  assert.equal(taemomjo.revenueKrw, 6400);
  assert.ok(taemomjo.nextDayActions.some((action) => action.includes("확장")));
  assert.ok(taemomjo.nextDayActions.some((action) => action.includes("제휴 링크")));
  assert.ok(report.globalActions.some((action) => action.includes("하루 5개")));
});

test("performance loop CLI writes JSON and Markdown reports", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "blog-performance-"));
  try {
    fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "outputs", "blog", "taemomjo", "automation", "2026-06-06"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "outputs", "blog", "performance", "2026-06-06"), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), "scripts", "blog_performance_loop.mjs"), path.join(tmp, "scripts", "blog_performance_loop.mjs"));
    fs.copyFileSync(path.join(process.cwd(), "scripts", "blog_marketing_policy.mjs"), path.join(tmp, "scripts", "blog_marketing_policy.mjs"));
    fs.writeFileSync(
      path.join(tmp, "outputs", "blog", "taemomjo", "automation", "2026-06-06", "taemomjo-20260606-daily-queue.json"),
      JSON.stringify(sampleQueue("taemomjo"), null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(tmp, "outputs", "blog", "performance", "2026-06-06", "blog-performance-input.json"),
      JSON.stringify({
        metrics: {
          "taemomjo-winner": { views: 280, clicks: 14, conversions: 2, revenueKrw: 6400, comments: 3 }
        }
      }),
      "utf8"
    );

    const result = spawnSync("node", ["scripts/blog_performance_loop.mjs", "2026-06-06"], {
      cwd: tmp,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const jsonPath = path.join(tmp, "outputs", "blog", "performance", "2026-06-06", "revenue-performance-report.json");
    const markdownPath = path.join(tmp, "outputs", "blog", "performance", "2026-06-06", "revenue-performance-report.md");
    assert.equal(fs.existsSync(jsonPath), true);
    assert.equal(fs.existsSync(markdownPath), true);
    const markdown = fs.readFileSync(markdownPath, "utf8");
    assert.match(markdown, /TAEMOMJO|taemomjo/);
    assert.match(markdown, /제휴/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
