import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDateKst } from "./blog_marketing_policy.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .trim();
}

function defaultQueriesForAccount(accountKey) {
  if (accountKey === "taemomjo" || accountKey === "temanju") {
    return ["장마철 신발 냄새 제거제", "여름 제습 생활용품", "아이 방학 간식 추천"];
  }
  return ["퇴근 후 블로그 부업", "쇼츠 부업 장비", "체험단 신청 준비물"];
}

export async function collectNaverShoppingCandidates({
  query,
  clientId,
  clientSecret,
  display = 10,
  fetchImpl = globalThis.fetch
}) {
  if (!clientId || !clientSecret) return [];
  const url = new URL("https://openapi.naver.com/v1/search/shop.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", "sim");
  const response = await fetchImpl(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    }
  });
  if (!response.ok) {
    throw new Error(`Naver shopping search failed for "${query}": ${response.status}`);
  }
  const data = await response.json();
  return (data.items || []).map((item) => ({
    platform: "naver_shopping_connect",
    productName: stripHtml(item.title),
    label: stripHtml(item.title),
    price: Number(item.lprice || 0),
    url: item.link,
    mallName: item.mallName || "",
    query,
    status: "candidate_needs_affiliate_conversion"
  }));
}

function manualProductsFor(accountKey, date) {
  const filePath = path.join("inputs", "blog", "affiliate-products-manual", date, `${accountKey}.json`);
  if (!fs.existsSync(filePath)) return [];
  const payload = readJson(filePath);
  return payload.products || [];
}

export async function buildCandidatePayload({
  accountKey,
  date = normalizeDateKst(),
  queries = defaultQueriesForAccount(accountKey),
  env = process.env,
  fetchImpl = globalThis.fetch
}) {
  const notes = [
    "네이버 쇼핑 검색 후보는 상품 후보일 뿐입니다. 네이버 쇼핑 커넥트 승인 링크로 변환되기 전에는 발행 큐를 해제하지 않습니다.",
    "쿠팡 파트너스 링크는 inputs/blog/affiliate-products-manual/<date>/<account>.json에 승인 링크를 넣으면 자동 검수됩니다."
  ];
  const products = [...manualProductsFor(accountKey, date)];
  const clientId = env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    notes.push("NAVER_SEARCH_CLIENT_ID 또는 NAVER_SEARCH_CLIENT_SECRET이 없어 네이버 쇼핑 후보 자동 수집을 건너뜁니다.");
  } else {
    for (const query of queries) {
      const candidates = await collectNaverShoppingCandidates({ query, clientId, clientSecret, fetchImpl });
      products.push(...candidates);
    }
  }

  return {
    accountKey,
    date,
    source: "naver_shopping_search_and_manual_affiliate_candidates",
    queries,
    products,
    notes
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const accountKey = process.argv[2] || "taemomjo";
  const date = process.argv[3] || normalizeDateKst();
  const payload = await buildCandidatePayload({ accountKey, date });
  const outPath = path.join("inputs", "blog", "affiliate-products", date, `${accountKey}.json`);
  writeJson(outPath, payload);
  console.log(JSON.stringify({ ok: true, output: outPath, products: payload.products.length, notes: payload.notes }, null, 2));
}
