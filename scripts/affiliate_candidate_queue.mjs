import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DISCLOSURES,
  requiresCpa,
  scoreAeo,
  selectAffiliateCandidates,
  validateBlogPost
} from "./blog_marketing_policy.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function dateKey(date) {
  return date.replaceAll("-", "");
}

function queuePath(accountKey, date) {
  return path.join("outputs", "blog", accountKey, "automation", date, `${accountKey}-${dateKey(date)}-daily-queue.json`);
}

function reviewedQueuePath(accountKey, date) {
  return path.join("outputs", "blog", accountKey, "automation", date, `${accountKey}-${dateKey(date)}-reviewed-queue.json`);
}

function productsPath(accountKey, date) {
  return path.join("inputs", "blog", "affiliate-products", date, `${accountKey}.json`);
}

function ensureDisclosure(body, disclosure) {
  if (!disclosure || body.includes(disclosure)) return body;
  return `${body}\n\n${disclosure}`;
}

function replacePostLinks(post, candidates) {
  const links = candidates.map((candidate) => ({
    platform: candidate.platform,
    label: candidate.label,
    url: candidate.url,
    price: candidate.price,
    reviewCount: candidate.reviewCount,
    score: candidate.score,
    status: "ready"
  }));
  const disclosure = links[0] ? DISCLOSURES[links[0].platform] : post.disclosure;
  const next = {
    ...post,
    affiliate_links: links,
    disclosure,
    body: ensureDisclosure(post.body || "", disclosure)
  };
  next.aeo = scoreAeo(next);
  const errors = validateBlogPost({ ...next, status: "ready_to_review" });
  next.status = errors.length ? "blocked_affiliate_review_required" : "ready_to_review";
  next.review_errors = errors;
  return next;
}

export function applyAffiliateCandidatesToQueue({ queue, products = [] }) {
  const posts = [];
  const errors = [];
  let replacedPosts = 0;

  for (const post of queue.posts || []) {
    if (!requiresCpa(post.content_type)) {
      posts.push(post);
      continue;
    }
    const candidates = selectAffiliateCandidates({ contentType: post.content_type, products, limit: 2 });
    if (!candidates.length) {
      posts.push({
        ...post,
        status: "blocked_cpa_link_required",
        affiliate_review_note: "승인된 쿠팡/네이버 쇼핑 커넥트 후보가 없어 발행 차단"
      });
      errors.push(`${post.id}: approved affiliate candidate is missing.`);
      continue;
    }
    const replaced = replacePostLinks(post, candidates);
    if (replaced.status === "ready_to_review") replacedPosts += 1;
    else errors.push(`${post.id}: ${replaced.review_errors.join("; ")}`);
    posts.push(replaced);
  }

  return {
    queue: {
      ...queue,
      affiliateReviewedAt: new Date().toISOString(),
      posts
    },
    replacedPosts,
    errors
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const accountKey = process.argv[2] || "taemomjo";
  const date = process.argv[3];
  if (!date) {
    console.error("Usage: node scripts/affiliate_candidate_queue.mjs <accountKey> <YYYY-MM-DD>");
    process.exit(1);
  }
  const queue = readJson(queuePath(accountKey, date));
  const input = fs.existsSync(productsPath(accountKey, date)) ? readJson(productsPath(accountKey, date)) : { products: [] };
  const result = applyAffiliateCandidatesToQueue({ queue, products: input.products || [] });
  const output = reviewedQueuePath(accountKey, date);
  writeJson(output, result.queue);
  console.log(JSON.stringify({ ok: true, output, replacedPosts: result.replacedPosts, errors: result.errors }, null, 2));
}
