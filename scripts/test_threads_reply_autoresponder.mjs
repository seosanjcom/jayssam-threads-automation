import assert from "node:assert/strict";
import { ACCOUNT_CONFIGS, classifyReply } from "./threads_reply_autoresponder.mjs";

const classify = (account, text, extra = {}) => classifyReply(ACCOUNT_CONFIGS[account], { text, ...extra });

assert.equal(classify("jayssam", "수학 5등급인데 코딩 시작해도 될까요?").action, "auto_reply");
assert.equal(classify("jayssam", "중2 아이 진로를 상담받고 싶어요.").action, "manual_review");
assert.equal(classify("jayssam", "좋은 글 감사합니다").action, "auto_reply");

assert.equal(classify("lifemagazine", "이 파우치 수납은 잘 되나요?").action, "auto_reply");
assert.equal(classify("lifemagazine", "링티 아이 매일 먹여도 되나요?").action, "manual_review");
assert.equal(classify("lifemagazine", "배송이 너무 늦는데요").action, "manual_review");

assert.equal(classify("offnote", "자료는 어디서 받아요?").action, "auto_reply");
assert.equal(classify("offnote", "월에 얼마 벌 수 있나요?").action, "manual_review");
assert.equal(classify("offnote", "저도 시작해볼게요").action, "auto_reply");

assert.equal(classify("offnote", "https://spam.example 링크 봐주세요").action, "manual_review");
assert.equal(classify("offnote", "감사합니다", { is_reply_owned_by_me: true }).action, "ignore");

console.log(JSON.stringify({ ok: true, guard: "Threads reply autoresponder classification passes" }, null, 2));
