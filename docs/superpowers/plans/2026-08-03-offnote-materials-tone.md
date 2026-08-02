# Offnote Materials Tone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Offnote Threads automation into an approval-gated materials-focused account voice with Instagram comment and KakaoTalk room CTAs.

**Architecture:** Replace the current mojibake topic generator path for Offnote with a focused materials-topic generator. Keep the existing draft/Telegram/publish pipeline, but make generated drafts `pending_approval` and remove scheduled auto-publish for newly generated drafts.

**Tech Stack:** Node.js ESM scripts, GitHub Actions YAML, existing Telegram approval scripts, Node test scripts.

## Global Constraints

- Offnote copy must use `자료` language instead of `기준` framing.
- Generated Offnote Threads text must include Instagram same-post comment CTA and KakaoTalk room materials/challenge/class notice.
- Generated Offnote drafts must default to `pending_approval`.
- Scheduled Offnote jobs must not publish a newly generated draft without user approval.
- Avoid “나처럼 해”, “성공담”, “망한 것/배운 것/수정한 것”, and repetitive 3-comment expansion patterns.

---

## File Structure

- Modify `scripts/generate_offnote_daily_post.mjs`: replace generated copy source with Offnote materials topic catalog and short CTA variants.
- Modify `scripts/validate_offnote_draft.mjs`: enforce materials tone and CTA rules.
- Modify `.github/workflows/offnote-threads-automation.yml`: route scheduled publish slots to preview/approval only, preserving manual publish.
- Modify `scripts/test_offnote_automation_guards.mjs`: assert approval-gated generation, tone phrases, and validator rejection of banned framing.

### Task 1: Offnote Materials Draft Generator

**Files:**
- Modify: `scripts/generate_offnote_daily_post.mjs`
- Test: `scripts/test_offnote_automation_guards.mjs`

**Interfaces:**
- Produces draft JSON with `status: "pending_approval"`, `threads_text: string`, `thread_comments: []`, `offnote_tone_profile: object`.
- Consumes existing CLI args: `node scripts/generate_offnote_daily_post.mjs YYYY-MM-DD slot`.

- [ ] **Step 1: Add failing tests**

Add assertions after the first generation in `scripts/test_offnote_automation_guards.mjs`:

```js
if (firstDraft.status !== "pending_approval") {
  throw new Error(`Expected generated offnote draft to require approval, got ${firstDraft.status}`);
}
if (!/자료/.test(firstDraft.threads_text) || !/인스타 같은 글에 댓글/.test(firstDraft.threads_text) || !/카톡방/.test(firstDraft.threads_text)) {
  throw new Error(`Offnote draft does not match materials CTA tone:\n${firstDraft.threads_text}`);
}
if (/기준|나처럼|성공담|망한|배운|수정한/.test(firstDraft.threads_text)) {
  throw new Error(`Offnote draft contains banned framing:\n${firstDraft.threads_text}`);
}
if ((firstDraft.thread_comments || []).length > 1) {
  throw new Error("Offnote materials drafts should not use repetitive comment expansion.");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_offnote_automation_guards.mjs`

Expected: FAIL because existing generator creates `approved` drafts and old/mojibake content.

- [ ] **Step 3: Implement focused materials generator**

In `scripts/generate_offnote_daily_post.mjs`, replace old topic pools with:

```js
const MATERIAL_TOPICS = [
  { slug: "blog-monetization-start", label: "블로그 수익화", materials: ["글감 잡는 법", "제목 잡는 법", "검색어 보는 법", "제휴글 쓰는 법"] },
  { slug: "blog-title-search", label: "블로그 제목", materials: ["지역 넣는 법", "대상 넣는 법", "상황 넣는 법", "검색어 예시"] },
  { slug: "affiliate-post", label: "제휴글", materials: ["상품 고르는 법", "광고처럼 안 보이게 쓰는 법", "링크 넣는 위치", "고지문구"] },
  { slug: "shorts-topic-script", label: "유튜브 쇼츠", materials: ["주제 잡는 법", "짧은 대본 구조", "얼굴 없이 만드는 법", "반복 포맷"] },
  { slug: "instagram-threads-ideas", label: "인스타/쓰레드", materials: ["글감 모으는 법", "댓글 열리는 질문", "공지방 연결", "자료형 콘텐츠"] },
  { slug: "experience-campaign", label: "체험단/협찬", materials: ["신청 전 준비", "후기글 구조", "사진 체크", "광고티 줄이는 법"] },
];
```

Create text with short KST/date seeded variations and canonical CTA phrases. Set `status: "pending_approval"` and `thread_comments: []`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_offnote_automation_guards.mjs`

Expected: PASS.

### Task 2: Offnote Validator Tone Guards

**Files:**
- Modify: `scripts/validate_offnote_draft.mjs`
- Test: `scripts/test_offnote_automation_guards.mjs`

**Interfaces:**
- Consumes generated draft JSON.
- Produces validation failure on missing CTA or banned framing.

- [ ] **Step 1: Add bad draft assertions**

Extend test to write a bad Offnote draft with `threads_text: "블로그 수익화 기준 알려줄게. 나처럼 해."` and assert `validate_offnote_draft.mjs` exits non-zero.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test_offnote_automation_guards.mjs`

Expected: FAIL until validator checks banned terms.

- [ ] **Step 3: Implement validator rules**

Add validation:

```js
const text = `${draft.threads_text || ""}\n${(draft.thread_comments || []).join("\n")}`;
if (!/자료/.test(text)) errors.push("offnote materials draft must mention 자료.");
if (!/인스타 같은 글에 댓글/.test(text)) errors.push("offnote materials draft must route requests to Instagram same-post comments.");
if (!/카톡방/.test(text)) errors.push("offnote materials draft must mention KakaoTalk room notices.");
if (/기준|나처럼|성공담|망한|배운|수정한/.test(text)) errors.push("offnote draft contains banned positioning language.");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test_offnote_automation_guards.mjs`

Expected: PASS.

### Task 3: Approval-Gated Workflow

**Files:**
- Modify: `.github/workflows/offnote-threads-automation.yml`
- Test: shell syntax checks via existing workflow script checks.

**Interfaces:**
- Scheduled `0 9 * * *` and gated night slots generate/send preview, not publish.
- Manual `manual_publish` still publishes selected draft.

- [ ] **Step 1: Modify route names**

Change scheduled publish route outputs from `auto_publish` to `preview`, or keep route mode but remove publish steps for schedules. Preferred: route scheduled 18:00/21:00 to `preview`.

- [ ] **Step 2: Remove scheduled auto-publish execution**

Ensure steps named `Generate Offnote auto-publish draft` and `Auto-publish due Offnote draft` no longer run for scheduled events.

- [ ] **Step 3: Run syntax checks**

Run:

```powershell
node --check scripts/generate_offnote_daily_post.mjs
node --check scripts/validate_offnote_draft.mjs
node --check scripts/telegram_check_offnote_approvals.mjs
```

Expected: all pass.

### Task 4: Verification and Integration

**Files:**
- No new code files.

**Interfaces:**
- Produces pushed PR.

- [ ] **Step 1: Generate sample draft**

Run:

```powershell
node scripts/generate_offnote_daily_post.mjs 2026-08-03 evening
node scripts/validate_offnote_draft.mjs "$(Get-Content outputs/afterwork-profit/latest-draft-path.txt)"
```

Expected: draft validates and contains new Offnote tone.

- [ ] **Step 2: Run targeted tests**

Run:

```powershell
node scripts/test_offnote_automation_guards.mjs
```

Expected: PASS.

- [ ] **Step 3: Commit and push**

Run:

```powershell
git add .github/workflows/offnote-threads-automation.yml scripts/generate_offnote_daily_post.mjs scripts/validate_offnote_draft.mjs scripts/test_offnote_automation_guards.mjs docs/superpowers/specs/2026-08-03-offnote-materials-tone-design.md docs/superpowers/plans/2026-08-03-offnote-materials-tone.md
git commit -m "Revise Offnote materials tone automation"
git push -u origin codex/offnote-tone-approval
```

Expected: branch pushed.

- [ ] **Step 4: Create PR**

Run:

```powershell
gh pr create -R seosanjcom/jayssam-threads-automation --base master --head codex/offnote-tone-approval --title "Revise Offnote materials tone automation" --body "Switches Offnote to approval-gated materials-focused drafts with Instagram/KakaoTalk CTAs."
```

Expected: PR created.
