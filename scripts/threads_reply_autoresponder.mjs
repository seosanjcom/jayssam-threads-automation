import fs from "node:fs";
import path from "node:path";

const GRAPH_BASE = "https://graph.threads.com/v1.0";
const KST = "Asia/Seoul";
const MAX_ROOT_POSTS = 12;
const MAX_AUTOREPLIES_PER_RUN = 3;
const REPLY_PUBLISH_WAIT_MS = 30000;

export const ACCOUNT_CONFIGS = {
  jayssam: {
    key: "jayssam",
    displayName: "제이쌤",
    accountMatchers: ["27960473083547672", "jayssam_edu"],
    publishLog: "outputs/meta-publish-log.json",
    stateFile: "outputs/reply-management/jayssam-state.json",
    telegramTokenEnv: "TELEGRAM_BOT_TOKEN",
    telegramChatEnv: "TELEGRAM_CHAT_ID",
    manualPatterns: [
      /(?:우리|제|저희)\s*아이.*(?:진로|학원|코딩|공부|성적|불안|상담)/i,
      /(?:중[123]|고[123]|초[1-6]).*(?:어떻게|어디|무엇|맞을까요|추천)/i,
      /진단|평가|상담\s*(?:받|해|가능)/i,
      /비용|가격|수강료|상담료/i,
      /문제\s*(?:있|생겼|되었)/i,
    ],
    safePatterns: [/(고마워|감사|도움|공감|저장)/i, /(?:수학|코딩).*시작/i, /ChatGPT.*(?:어떻게|쓴|사용)/i],
    replyFor(text) {
      if (/(고마워|감사|도움|공감|저장)/i.test(text)) return "고마워요. 집에서 바로 꺼내볼 수 있는 질문들로 계속 정리해볼게요.";
      if (/ChatGPT/i.test(text)) return "바로 막기보다, 아이가 바꾼 부분을 자기 말로 설명할 수 있는지 한 번 물어봐줘요.";
      return "점수 하나로 먼저 정하진 말고, 막혔을 때 다시 붙잡는 편인지부터 봐줘요.";
    },
  },
  lifemagazine: {
    key: "lifemagazine",
    displayName: "라이프매거진",
    accountMatchers: ["lifemagazine_"],
    publishLog: "outputs/lifemagazine/meta-publish-log.json",
    stateFile: "outputs/reply-management/lifemagazine-state.json",
    telegramTokenEnv: "LIFEMAGAZINE_TELEGRAM_BOT_TOKEN",
    telegramChatEnv: "LIFEMAGAZINE_TELEGRAM_CHAT_ID",
    manualPatterns: [
      /(?:먹|마시|섭취|복용|부작용|알레르기|임신|수유|아이|어린이|아기|건강|질환|병원|약)/i,
      /(?:정품|가품|환불|교환|배송|불량|파손)/i,
      /(?:정확한\s*가격|얼마.*배송비|최저가)/i,
    ],
    safePatterns: [/(고마워|감사|예쁘|유용|저장|추천)/i, /(?:크기|사이즈|수납|가방|가격|링크|어디서)/i],
    replyFor(text) {
      if (/(고마워|감사|예쁘|유용|저장|추천)/i.test(text)) return "봐줘서 고마워~ 실제로 자주 쓰는 장면 위주로 더 꼼꼼히 골라볼게!!";
      if (/(가격|얼마)/i.test(text)) return "가격은 수시로 바뀔 수 있어서 댓글 링크에서 현재 표시가를 한 번 확인해줘~";
      return "평소 넣는 물건이랑 가방 크기를 먼저 보고, 댓글 링크 상품 페이지의 상세 치수도 확인해봐!!";
    },
  },
  offnote: {
    key: "offnote",
    displayName: "오프노트",
    accountMatchers: ["offnote.kr"],
    publishLog: "outputs/afterwork-profit/meta-publish-log.json",
    stateFile: "outputs/reply-management/offnote-state.json",
    telegramTokenEnv: "OFFNOTE_TELEGRAM_BOT_TOKEN",
    telegramChatEnv: "OFFNOTE_TELEGRAM_CHAT_ID",
    manualPatterns: [
      /(?:얼마\s*벌|수익|월\s*\d+|보장|확실|무조건|환불|사기|피해)/i,
      /(?:상담|컨설팅|대행|가격|비용)/i,
      /(?:문제|불만|신고|화나|최악|거짓)/i,
    ],
    safePatterns: [/(고마워|감사|저도|시작|자료|카톡방|어디)/i, /(?:글감|제목|검색어|블로그).*?(?:어떻게|뭐|어디)/i],
    replyFor(text) {
      if (/(자료|카톡방|어디)/i.test(text)) return "자료랑 챌린지 공지는 카톡방에 따로 올려두고 있어. 프로필 링크로 들어와줘!";
      if (/(고마워|감사|저도|시작)/i.test(text)) return "좋아. 처음엔 글감 하나랑 제목 하나만 정해도 충분해. 천천히 시작해봐!";
      return "처음엔 검색어 하나를 정하고, 그 검색어로 사람들이 뭘 궁금해하는지부터 보면 훨씬 쉬워져.";
    },
  },
};

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecent(timestamp, hours = 96) {
  const time = Date.parse(timestamp || "");
  return Number.isFinite(time) && Date.now() - time <= hours * 60 * 60 * 1000;
}

function activePostIds(config) {
  const items = readJson(config.publishLog, []);
  return items
    .filter((item) => item && config.accountMatchers.includes(String(item.account || "")))
    .filter((item) => !String(item.status || "").startsWith("deleted_"))
    .filter((item) => isRecent(item.published_at))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .map((item) => String(item.threads_media_id || ""))
    .filter(Boolean)
    .slice(0, MAX_ROOT_POSTS);
}

export function classifyReply(config, reply) {
  const text = String(reply.text || "").trim();
  if (!text) return { action: "ignore", reason: "empty_reply" };
  if (reply.is_reply_owned_by_me === true) return { action: "ignore", reason: "owned_by_me" };
  if (/(https?:\/\/|bit\.ly|t\.me\/)/i.test(text)) return { action: "manual_review", reason: "external_link" };
  if (config.manualPatterns.some((pattern) => pattern.test(text))) return { action: "manual_review", reason: "sensitive_or_individual_question" };
  if (/(욕설|꺼져|죽어|병신|사기꾼|개새)/i.test(text)) return { action: "manual_review", reason: "hostile_or_abusive" };
  if (!config.safePatterns.some((pattern) => pattern.test(text))) return { action: "manual_review", reason: "unrecognised_question" };
  return { action: "auto_reply", reason: "safe_common_question", response: config.replyFor(text) };
}

async function graphGet(endpoint, token) {
  const response = await fetch(`${GRAPH_BASE}${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return JSON.parse(text);
}

async function graphPost(endpoint, fields, token) {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, { method: "POST", body });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return JSON.parse(text);
}

async function postReply(userId, parentReplyId, text, token) {
  const created = await graphPost(`/${userId}/threads`, {
    media_type: "TEXT",
    text,
    reply_to_id: parentReplyId,
  }, token);
  await new Promise((resolve) => setTimeout(resolve, REPLY_PUBLISH_WAIT_MS));
  return graphPost(`/${userId}/threads_publish`, { creation_id: created.id }, token);
}

async function sendTelegram(config, text) {
  const token = process.env[config.telegramTokenEnv];
  const chatId = process.env[config.telegramChatEnv];
  if (!token || !chatId) return;
  const body = new FormData();
  body.set("chat_id", chatId);
  body.set("text", text);
  body.set("disable_web_page_preview", "true");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", body });
  if (!response.ok) throw new Error(`Telegram notification failed: ${response.status}`);
}

function formatReplyForReview(reply, result) {
  const author = reply.username ? `@${reply.username}` : "작성자 미상";
  return [
    `[${result.config.displayName} 답글 확인 필요]`,
    `분류: ${result.reason}`,
    `작성자: ${author}`,
    `댓글: ${String(reply.text || "").slice(0, 500)}`,
    reply.permalink ? `바로가기: ${reply.permalink}` : "",
  ].filter(Boolean).join("\n");
}

export async function runReplyAutoreply({ accountKey, dryRun = false } = {}) {
  const config = ACCOUNT_CONFIGS[accountKey];
  if (!config) throw new Error(`Unknown account key: ${accountKey}`);
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID || "me";
  if (!token) throw new Error("THREADS_ACCESS_TOKEN is missing");

  const replyQuota = await graphGet(`/${userId}/threads_publishing_limit?fields=reply_quota_usage,reply_config`, token);
  const state = readJson(config.stateFile, { processed_reply_ids: [], events: [] });
  const processed = new Set(Array.isArray(state.processed_reply_ids) ? state.processed_reply_ids : []);
  const events = [];
  let autoReplies = 0;

  for (const postId of activePostIds(config)) {
    const payload = await graphGet(`/${postId}/conversation?fields=id,text,username,permalink,timestamp,is_reply,is_reply_owned_by_me,root_post,replied_to,hide_status&reverse=false`, token);
    for (const reply of Array.isArray(payload.data) ? payload.data : []) {
      const replyId = String(reply.id || "");
      if (!replyId || processed.has(replyId)) continue;
      const classified = classifyReply(config, reply);
      const event = { reply_id: replyId, post_id: postId, username: reply.username || "", text: reply.text || "", action: classified.action, reason: classified.reason, detected_at: new Date().toISOString() };

      if (classified.action === "auto_reply" && autoReplies < MAX_AUTOREPLIES_PER_RUN) {
        if (dryRun) {
          event.response_text = classified.response;
          event.reply_status = "dry_run";
        } else {
          const published = await postReply(userId, replyId, classified.response, token);
          event.response_text = classified.response;
          event.response_media_id = published.id;
          event.reply_status = "published";
        }
        autoReplies += 1;
      } else if (classified.action === "manual_review") {
        await sendTelegram(config, formatReplyForReview(reply, { ...classified, config }));
        event.reply_status = "sent_for_review";
      } else {
        event.reply_status = "ignored";
      }

      processed.add(replyId);
      events.push(event);
    }
  }

  const nextState = {
    processed_reply_ids: [...processed].slice(-1000),
    events: [...(Array.isArray(state.events) ? state.events : []), ...events].slice(-1000),
    updated_at: new Date().toISOString(),
    timezone: KST,
  };
  writeJson(config.stateFile, nextState);
  return { account: accountKey, post_ids: activePostIds(config), events, auto_replies: autoReplies, dry_run: dryRun, reply_quota: replyQuota.data?.[0] || null };
}

const directRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (directRun) {
  const account = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  runReplyAutoreply({ accountKey: account, dryRun })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
}
