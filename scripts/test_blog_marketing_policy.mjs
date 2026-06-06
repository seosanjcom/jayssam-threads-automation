import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { scoreAeo, selectAffiliateCandidates, validateDailyQueue } from "./blog_marketing_policy.mjs";

const mojibakePattern = /[�]|寃|媛|吏|釉|荑|湲|鍮|臾|諛|(?:\?[ㄱ-ㅎㅏ-ㅣ])|(?:[ㄱ-ㅎㅏ-ㅣ]\?)|(?:좏|뚰|쒕|먯|섎|덈|닿|쓽|낅|룄|곗|뺣)/;

test("automation source text must not contain broken Korean mojibake", () => {
  const files = [
    "scripts/blog_marketing_policy.mjs",
    "scripts/generate_blog_daily_queue.mjs",
    "config/blog-accounts.json"
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.equal(mojibakePattern.test(content), false, `${file} contains broken Korean text`);
  }
});

test("blog queue requires at least five posts per account per day", () => {
  const errors = validateDailyQueue({
    accountKey: "temanju",
    date: "2026-06-06",
    posts: []
  });
  assert.match(errors.join("\n"), /at least 5 publishable posts/);
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

test("generated temanju queue has five publishable posts and blocks placeholder CPA candidates", () => {
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
    assert.ok(queue.posts.length >= 5);
    assert.equal(queue.posts.filter((post) => post.status === "ready_to_review").length, 5);
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

test("TAEMOMJO queue exists as the main revenue blog with five daily posts", () => {
  const result = spawnSync("node", ["scripts/generate_blog_daily_queue.mjs", "taemomjo", "2026-06-06"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const output = JSON.parse(result.stdout).output;
  const queue = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(queue.accountKey, "taemomjo");
  assert.ok(queue.posts.length >= 5);
  assert.equal(queue.posts.filter((post) => post.status === "ready_to_review").length, 5);
  assert.equal(queue.posts.filter((post) => post.content_type === "shopping_cpa").length, 2);
});

test("AEO scoring blocks thin posts below 85", () => {
  const weak = scoreAeo({
    title: "좋은 상품 추천",
    body: "이거 괜찮아요. 한번 보세요.",
    tags: ["추천"],
    content_type: "search_answer"
  });
  assert.ok(weak.score < 85);
  assert.equal(weak.publishable, false);
  assert.ok(weak.reasons.length > 0);
});

test("AEO scoring approves answer-first posts with FAQ and comparison criteria", () => {
  const strong = scoreAeo({
    title: "2026 장마철 신발 냄새 제거제 고르는 기준 5가지",
    body: [
      "장마철 신발 냄새 제거제는 향보다 건조력과 탈취 지속 시간을 먼저 봐야 합니다.",
      "운동화, 구두, 아이 신발은 기준이 조금 다릅니다.",
      "아래 기준대로 고르면 실패 확률을 줄일 수 있습니다.",
      "비교 기준: 건조 방식, 탈취 지속 시간, 사용 횟수, 가격, 후기 수",
      "체크리스트: 신발 소재, 사용 장소, 건조 시간, 교체 주기, 가족 사용 여부.",
      "이 글은 장마철에 신발 냄새가 반복되는 사람을 위해 작성합니다. 상품을 고를 때 향만 보면 실패하기 쉽습니다. 비가 많이 오는 날에는 냄새보다 습기 관리가 먼저이고, 출근화인지 운동화인지 아이 신발인지에 따라 필요한 기준이 달라집니다.",
      "가격을 볼 때는 1회 사용 비용, 교체 주기, 후기 수, 사용 가능한 신발 종류를 같이 봐야 합니다. 같은 가격이라도 여러 켤레에 쓸 수 있는 제품과 한 켤레 전용 제품은 실제 비용이 다릅니다.",
      "구매 전에 후기에서 향이 좋다는 말보다 건조가 빠른지, 재사용이 가능한지, 신발 안쪽까지 들어가는지, 장마철에 효과가 있었는지를 확인하세요.",
      "FAQ",
      "Q. 향이 강한 제품이면 좋은가요?",
      "A. 냄새를 덮는 제품보다 습기를 줄이는 제품을 먼저 봐야 합니다.",
      "다음 행동: 쿠팡과 네이버에서 후기 500개 이상 제품을 비교하세요."
    ].join("\n").repeat(3),
    tags: ["장마철", "신발냄새", "생활용품", "비교", "구매가이드"],
    quality_rules: { SUA: true, AU: true, GU: true },
    content_type: "search_answer"
  });
  assert.ok(strong.score >= 85, JSON.stringify(strong));
  assert.equal(strong.publishable, true);
});

test("affiliate candidate selection picks real links and rejects placeholders", () => {
  const candidates = selectAffiliateCandidates({
    contentType: "shopping_cpa",
    products: [
      { platform: "coupang", productName: "저가 후보", price: 9000, url: "https://example.com/replace-with-approved-affiliate-link", reviewCount: 800 },
      { platform: "naver_shopping_connect", productName: "장마철 신발 건조제", price: 24900, url: "https://smartstore.naver.com/example/products/1", reviewCount: 1200 },
      { platform: "coupang", productName: "신발 냄새 제거제", price: 18900, url: "https://link.coupang.com/a/real123", reviewCount: 2400 }
    ]
  });
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].platform, "coupang");
  assert.ok(candidates.every((item) => item.status === "ready"));
});
