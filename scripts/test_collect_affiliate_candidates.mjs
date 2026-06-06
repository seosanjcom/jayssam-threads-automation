import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { collectNaverShoppingCandidates, buildCandidatePayload } from "./collect_affiliate_candidates.mjs";

test("naver shopping candidates are normalized for affiliate review", async () => {
  const candidates = await collectNaverShoppingCandidates({
    query: "장마철 신발 냄새 제거제",
    clientId: "client",
    clientSecret: "secret",
    fetchImpl: async (url, options) => {
      assert.match(String(url), /openapi\.naver\.com\/v1\/search\/shop\.json/);
      assert.equal(options.headers["X-Naver-Client-Id"], "client");
      assert.equal(options.headers["X-Naver-Client-Secret"], "secret");
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              title: "<b>신발 냄새 제거제</b>",
              lprice: "18900",
              link: "https://smartstore.naver.com/example/products/1",
              mallName: "ExampleMall"
            }
          ]
        })
      };
    }
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].platform, "naver_shopping_connect");
  assert.equal(candidates[0].productName, "신발 냄새 제거제");
  assert.equal(candidates[0].price, 18900);
  assert.equal(candidates[0].status, "candidate_needs_affiliate_conversion");
});

test("candidate payload records missing API credentials instead of creating fake links", async () => {
  const payload = await buildCandidatePayload({
    accountKey: "taemomjo",
    date: "2026-06-06",
    queries: ["장마철 신발 냄새 제거제"],
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch must not be called without credentials");
    }
  });
  assert.equal(payload.products.length, 0);
  assert.match(payload.notes.join("\n"), /NAVER_SEARCH_CLIENT_ID/);
});

test("collector CLI writes account candidate file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "affiliate-collector-"));
  try {
    fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "config"), { recursive: true });
    fs.copyFileSync(path.join(process.cwd(), "scripts", "collect_affiliate_candidates.mjs"), path.join(tmp, "scripts", "collect_affiliate_candidates.mjs"));
    fs.copyFileSync(path.join(process.cwd(), "scripts", "blog_marketing_policy.mjs"), path.join(tmp, "scripts", "blog_marketing_policy.mjs"));
    fs.copyFileSync(path.join(process.cwd(), "config", "blog-accounts.json"), path.join(tmp, "config", "blog-accounts.json"));
    const result = spawnSync("node", ["scripts/collect_affiliate_candidates.mjs", "taemomjo", "2026-06-06"], {
      cwd: tmp,
      encoding: "utf8",
      env: { ...process.env, NAVER_SEARCH_CLIENT_ID: "", NAVER_SEARCH_CLIENT_SECRET: "" }
    });
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
    const outPath = path.join(tmp, "inputs", "blog", "affiliate-products", "2026-06-06", "taemomjo.json");
    assert.equal(fs.existsSync(outPath), true);
    const payload = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert.equal(payload.accountKey, "taemomjo");
    assert.ok(Array.isArray(payload.products));
    assert.match(payload.notes.join("\n"), /NAVER_SEARCH_CLIENT_ID/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
