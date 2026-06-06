import fs from "node:fs";
import path from "node:path";
import { normalizeDateKst } from "./blog_marketing_policy.mjs";

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeFileEnsured(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function readQueuesForDate(date) {
  const root = path.join("outputs", "blog");
  if (!fs.existsSync(root)) return [];
  const queues = [];
  for (const accountKey of fs.readdirSync(root)) {
    const queueDir = path.join(root, accountKey, "automation", date);
    if (!fs.existsSync(queueDir)) continue;
    for (const file of fs.readdirSync(queueDir)) {
      if (file.endsWith("-daily-queue.json")) {
        queues.push(readJsonIfExists(path.join(queueDir, file), null));
      }
    }
  }
  return queues.filter(Boolean);
}

function postMetrics(metrics, postId) {
  const item = metrics[postId] || {};
  return {
    views: Number(item.views || 0),
    clicks: Number(item.clicks || 0),
    conversions: Number(item.conversions || 0),
    revenueKrw: Number(item.revenueKrw || 0),
    comments: Number(item.comments || 0)
  };
}

function actionForPost(post, metric) {
  if (String(post.status || "").startsWith("blocked_cpa")) {
    return `제휴 링크 검수 필요: "${post.title}"은 승인 링크 없으면 발행 금지, 대체 글로 슬롯 유지`;
  }
  if (metric.clicks >= 10 || metric.conversions > 0 || metric.revenueKrw > 0) {
    return `확장: "${post.title}"을 같은 검색 의도 3개로 나눠 후속 글 작성`;
  }
  if (metric.views >= 80 && metric.clicks === 0) {
    return `수정: "${post.title}"은 도달은 있으나 클릭이 없어 가격/후기/비교표를 상단으로 이동`;
  }
  if (metric.views < 50 && post.status === "ready_to_review") {
    return `재작성: "${post.title}"은 제목을 실제 검색 질문형으로 바꾸고 첫 3줄 결론 강화`;
  }
  return `유지: "${post.title}"은 다음 데이터까지 관찰`;
}

function summarizeAccount(queue, metrics) {
  const posts = Array.isArray(queue.posts) ? queue.posts : [];
  const enriched = posts.map((post) => ({
    id: post.id,
    title: post.title,
    status: post.status,
    contentType: post.content_type,
    metrics: postMetrics(metrics, post.id)
  }));
  const totals = enriched.reduce(
    (acc, post) => {
      acc.views += post.metrics.views;
      acc.clicks += post.metrics.clicks;
      acc.conversions += post.metrics.conversions;
      acc.revenueKrw += post.metrics.revenueKrw;
      acc.comments += post.metrics.comments;
      return acc;
    },
    { views: 0, clicks: 0, conversions: 0, revenueKrw: 0, comments: 0 }
  );
  const topPosts = [...enriched]
    .sort((a, b) => (b.metrics.revenueKrw - a.metrics.revenueKrw) || (b.metrics.clicks - a.metrics.clicks) || (b.metrics.views - a.metrics.views))
    .slice(0, 3);
  const weakPosts = enriched
    .filter((post) => post.status === "ready_to_review" && (post.metrics.views < 50 || (post.metrics.views >= 80 && post.metrics.clicks === 0)))
    .slice(0, 3);
  const blockedCpaPosts = posts.filter((post) => String(post.status || "").startsWith("blocked_cpa")).length;
  const readyPosts = posts.filter((post) => post.status === "ready_to_review").length;
  const nextDayActions = [...posts]
    .sort((a, b) => {
      const aMetric = postMetrics(metrics, a.id);
      const bMetric = postMetrics(metrics, b.id);
      return (bMetric.revenueKrw - aMetric.revenueKrw) || (bMetric.clicks - aMetric.clicks);
    })
    .slice(0, 5)
    .map((post) => actionForPost(post, postMetrics(metrics, post.id)));

  if (readyPosts < 5) {
    nextDayActions.unshift("하루 5개 발행 기준 미달: 대체 검색형 글을 자동 생성해 발행 가능 슬롯을 채워야 함");
  }
  if (blockedCpaPosts > 0) {
    nextDayActions.unshift("제휴 링크 미검수 글 존재: 쿠팡/네이버 쇼핑 커넥트 승인 링크 없으면 발행하지 말 것");
  }

  return {
    accountKey: queue.accountKey,
    date: queue.date,
    postsPlanned: posts.length,
    readyPosts,
    blockedCpaPosts,
    views: totals.views,
    affiliateClicks: totals.clicks,
    conversions: totals.conversions,
    revenueKrw: totals.revenueKrw,
    comments: totals.comments,
    topPosts,
    weakPosts,
    nextDayActions
  };
}

export function buildPerformanceReport({ date = normalizeDateKst(), queues = [], metrics = {} }) {
  const accounts = queues.map((queue) => summarizeAccount(queue, metrics));
  const totalReadyPosts = accounts.reduce((sum, account) => sum + account.readyPosts, 0);
  const totalBlockedCpa = accounts.reduce((sum, account) => sum + account.blockedCpaPosts, 0);
  const totalRevenueKrw = accounts.reduce((sum, account) => sum + account.revenueKrw, 0);
  const totalClicks = accounts.reduce((sum, account) => sum + account.affiliateClicks, 0);
  const globalActions = [];

  for (const account of accounts) {
    if (account.readyPosts < 5) {
      globalActions.push(`${account.accountKey}: 하루 5개 발행 가능 글을 채우기 위해 대체 검색형 글 생성`);
    }
    if (account.blockedCpaPosts > 0) {
      globalActions.push(`${account.accountKey}: 제휴 링크 미검수 글 ${account.blockedCpaPosts}개는 승인 링크 확보 전 발행 금지`);
    }
    if (account.affiliateClicks < 10) {
      globalActions.push(`${account.accountKey}: 클릭 10회 미만, 제목보다 본문 상단 비교표와 가격/후기 기준 강화`);
    }
  }
  if (totalReadyPosts >= accounts.length * 5) {
    globalActions.push("하루 5개 발행 기준은 충족, 성과 상위 글을 다음날 3개 후속 주제로 확장");
  }
  if (totalBlockedCpa === 0 && totalClicks >= accounts.length * 10) {
    globalActions.push("CPA 링크와 클릭 기준이 충족된 계정은 쇼핑 비교 글 비중을 늘림");
  }

  return {
    date,
    accounts,
    totals: {
      readyPosts: totalReadyPosts,
      blockedCpaPosts: totalBlockedCpa,
      affiliateClicks: totalClicks,
      revenueKrw: totalRevenueKrw
    },
    globalActions: [...new Set(globalActions)]
  };
}

export function renderPerformanceMarkdown(report) {
  const lines = [
    `# 블로그 수익 자동화 성과 리포트 - ${report.date}`,
    "",
    `- 발행 가능 글: ${report.totals.readyPosts}개`,
    `- 제휴 링크 미검수 차단 글: ${report.totals.blockedCpaPosts}개`,
    `- 제휴 클릭: ${report.totals.affiliateClicks}회`,
    `- 수익: ${report.totals.revenueKrw.toLocaleString("ko-KR")}원`,
    "",
    "## 계정별 판단"
  ];
  for (const account of report.accounts) {
    lines.push(
      "",
      `### ${account.accountKey}`,
      `- 준비 글: ${account.readyPosts}/${account.postsPlanned}`,
      `- 차단 CPA 글: ${account.blockedCpaPosts}개`,
      `- 조회/클릭/전환/수익: ${account.views} / ${account.affiliateClicks} / ${account.conversions} / ${account.revenueKrw.toLocaleString("ko-KR")}원`,
      "- 다음날 조치:"
    );
    for (const action of account.nextDayActions) lines.push(`  - ${action}`);
  }
  lines.push("", "## 전체 조치");
  for (const action of report.globalActions) lines.push(`- ${action}`);
  lines.push("");
  return lines.join("\n");
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("blog_performance_loop.mjs");
if (isDirectRun) {
  const date = process.argv[2] || normalizeDateKst();
  const inputPath = path.join("outputs", "blog", "performance", date, "blog-performance-input.json");
  const input = readJsonIfExists(inputPath, { metrics: {} });
  const queues = readQueuesForDate(date);
  const report = buildPerformanceReport({ date, queues, metrics: input.metrics || {} });
  const outDir = path.join("outputs", "blog", "performance", date);
  const jsonPath = path.join(outDir, "revenue-performance-report.json");
  const markdownPath = path.join(outDir, "revenue-performance-report.md");
  writeFileEnsured(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileEnsured(markdownPath, renderPerformanceMarkdown(report));
  console.log(JSON.stringify({ ok: true, date, accounts: report.accounts.length, output: jsonPath }, null, 2));
}
