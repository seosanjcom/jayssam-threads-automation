import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { applyAffiliateCandidatesToQueue } from "./affiliate_candidate_queue.mjs";

function queueFixture() {
  return {
    accountKey: "taemomjo",
    date: "2026-06-06",
    posts: [
      {
        id: "taemomjo-20260606-01-shopping_cpa",
        status: "blocked_cpa_link_required",
        content_type: "shopping_cpa",
        title: "쿠팡 파트너스 글은 상품보다 구매 상황을 먼저 잡아야 합니다",
        body: [
          "먼저 결론부터 말하면, 수익형 블로그 글은 예쁜 문장보다 검색자가 지금 바로 비교할 기준을 먼저 줘야 합니다.",
          "비교 기준: 가격, 후기 수, 조건, 공식 사이트, 구매 상황.",
          "체크리스트",
          "1. 가격 확인",
          "2. 후기 수 확인",
          "3. 다음 행동: 링크 확인"
        ].join("\n").repeat(20),
        tags: ["블로그수익화", "부업블로그", "제휴마케팅", "쿠팡파트너스", "AEO"],
        quality_rules: { SUA: true, AU: true, GU: true },
        affiliate_links: [
          {
            platform: "coupang",
            label: "검수 필요 쿠팡 상품 링크",
            url: "https://example.com/replace-with-approved-affiliate-link",
            status: "needs_real_link"
          }
        ],
        disclosure: "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
      }
    ]
  };
}

test("affiliate candidates replace placeholder links and unblock CPA posts", () => {
  const result = applyAffiliateCandidatesToQueue({
    queue: queueFixture(),
    products: [
      { platform: "coupang", productName: "신발 냄새 제거제", price: 18900, url: "https://link.coupang.com/a/real123", reviewCount: 2400 },
      { platform: "coupang", productName: "임시 링크", price: 19900, url: "https://example.com/nope", reviewCount: 1000 }
    ]
  });
  const post = result.queue.posts[0];
  assert.equal(post.status, "ready_to_review");
  assert.equal(post.affiliate_links[0].url, "https://link.coupang.com/a/real123");
  assert.equal(post.affiliate_links[0].status, "ready");
  assert.equal(result.replacedPosts, 1);
  assert.ok(result.errors.length === 0);
});

test("affiliate candidate CLI writes reviewed queue and blocks missing candidates", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "affiliate-candidates-"));
  try {
    const queueDir = path.join(tmp, "outputs", "blog", "taemomjo", "automation", "2026-06-06");
    const inputDir = path.join(tmp, "inputs", "blog", "affiliate-products", "2026-06-06");
    fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
    fs.mkdirSync(queueDir, { recursive: true });
    fs.mkdirSync(inputDir, { recursive: true });
    for (const file of ["affiliate_candidate_queue.mjs", "blog_marketing_policy.mjs"]) {
      fs.copyFileSync(path.join(process.cwd(), "scripts", file), path.join(tmp, "scripts", file));
    }
    fs.writeFileSync(path.join(queueDir, "taemomjo-20260606-daily-queue.json"), JSON.stringify(queueFixture(), null, 2), "utf8");
    fs.writeFileSync(path.join(inputDir, "taemomjo.json"), JSON.stringify({
      products: [
        { platform: "coupang", productName: "신발 냄새 제거제", price: 18900, url: "https://link.coupang.com/a/real123", reviewCount: 2400 }
      ]
    }), "utf8");

    const result = spawnSync("node", ["scripts/affiliate_candidate_queue.mjs", "taemomjo", "2026-06-06"], {
      cwd: tmp,
      encoding: "utf8"
    });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const reviewedPath = path.join(queueDir, "taemomjo-20260606-reviewed-queue.json");
    assert.equal(fs.existsSync(reviewedPath), true);
    const reviewed = JSON.parse(fs.readFileSync(reviewedPath, "utf8"));
    assert.equal(reviewed.posts[0].status, "ready_to_review");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
