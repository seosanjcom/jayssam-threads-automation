# Threads Studio Conversation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the local Threads studio so the user can manage Jayssam, Offnote, and Lifemagazine from one clear program, with Lifemagazine using a user-provided input flow only.

**Architecture:** Keep the existing Node HTTP server and draft APIs. Refactor the home UI into an account operations dashboard plus an account-specific workspace: Lifemagazine gets a guided composer, while Offnote and Jayssam show automation status, due drafts, failures, and scheduled posts. Preserve current GitHub Actions and draft JSON contracts.

**Tech Stack:** Node.js ESM, built-in `http`, filesystem-backed JSON drafts, existing test file `scripts/test_lifemagazine_draft.mjs`.

---

### Task 1: Add Studio View Model Tests

**Files:**
- Modify: `scripts/test_lifemagazine_draft.mjs`
- Modify: `scripts/threads_studio_server.mjs`

- [x] **Step 1: Write failing tests for the three-account dashboard**

Add tests that build sample drafts for `lifemagazine_`, `offnote.kr`, and `jayssam_edu`, call `buildOperationsDashboard`, and assert these values:

```js
assert.equal(dashboard.accountSummaries.length, 3);
assert.equal(dashboard.accountSummaries.find((item) => item.account.accountKey === "lifemagazine").todayScheduled, 0);
assert.equal(dashboard.accountSummaries.find((item) => item.account.accountKey === "offnote").todayScheduled, 1);
assert.equal(dashboard.accountSummaries.find((item) => item.account.accountKey === "jayssam").failed, 1);
```

- [x] **Step 2: Run test and verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because the current HTML/view model does not expose the new account-specific labels and status sections.

- [x] **Step 3: Add view model helpers**

In `scripts/threads_studio_server.mjs`, add small helpers:

```js
function accountActionLabel(accountKey) {
  if (accountKey === "lifemagazine") return "수동 작성";
  if (accountKey === "offnote") return "자동 초안";
  if (accountKey === "jayssam") return "교육 자동화";
  return "자동화";
}
```

- [x] **Step 4: Run tests**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

### Task 2: Replace Studio Home With Account Operations Layout

**Files:**
- Modify: `scripts/threads_studio_server.mjs`
- Test: `scripts/test_lifemagazine_draft.mjs`

- [x] **Step 1: Write failing HTML tests**

Add assertions that `renderStudioHome` includes:

```js
assert.match(html, /오늘 상태/);
assert.match(html, /라이프매거진 수동 작성/);
assert.match(html, /오프노트 자동화 확인/);
assert.match(html, /제이쌤 교육 자동화/);
assert.match(html, /실패한 발행/);
assert.match(html, /내일 예정/);
```

- [x] **Step 2: Run test and verify failure**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL until the layout is updated.

- [x] **Step 3: Implement the new home sections**

In `renderStudioHome`, replace the card-heavy generic layout with:

```html
<section class="status-strip">오늘 상태...</section>
<section class="quick-actions">무엇을 할까요?...</section>
<section class="workspace-grid">...</section>
```

Keep existing draft data sources. Do not change publishing scripts or workflow files.

- [x] **Step 4: Run test**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

### Task 3: Rebuild Lifemagazine Composer As Guided Manual Input

**Files:**
- Modify: `scripts/threads_studio_server.mjs`
- Test: `scripts/test_lifemagazine_draft.mjs`

- [x] **Step 1: Write failing tests**

Add tests that assert the composer includes these labels:

```js
assert.match(html, /사진\/영상/);
assert.match(html, /출처 메모/);
assert.match(html, /상품명/);
assert.match(html, /상품링크/);
assert.match(html, /공식 언급템/);
assert.match(html, /비슷한 무드/);
assert.match(html, /초안 만들기/);
```

- [x] **Step 2: Run failing test**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL because current composer reads like a form, not a guided manual flow.

- [x] **Step 3: Implement composer copy and structure**

Update `renderLifemagazineComposer` so it explicitly states:

```html
<h2>라이프매거진 수동 작성</h2>
<p>사진, 영상, 상품링크, 메모를 줄 때만 초안을 만듭니다.</p>
```

Keep the existing POST target `/api/lifemagazine/drafts` and field names to avoid backend churn.

- [x] **Step 4: Run test**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

### Task 4: Add Offnote And Jayssam Review Panels

**Files:**
- Modify: `scripts/threads_studio_server.mjs`
- Test: `scripts/test_lifemagazine_draft.mjs`

- [x] **Step 1: Write failing tests**

Assert that the home output includes:

```js
assert.match(html, /오프노트 오늘 글/);
assert.match(html, /제이쌤 오늘 글/);
assert.match(html, /승인 대기/);
assert.match(html, /발행 실패 이유/);
```

- [x] **Step 2: Run failing test**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: FAIL until panels are rendered.

- [x] **Step 3: Implement review panels**

Add `renderAccountReviewPanel(account, drafts)` that shows:

```html
<h2>{displayName} 오늘 글</h2>
<ul>
  <li>오늘 발행 완료</li>
  <li>오늘/내일 예정</li>
  <li>승인 대기</li>
  <li>발행 실패 이유</li>
</ul>
```

Reuse `renderTaskItem`, `renderIssueItem`, and `normalizeDraft` rather than creating a second data model.

- [x] **Step 4: Run test**

Run: `node --test scripts/test_lifemagazine_draft.mjs`

Expected: PASS.

### Task 5: Verify Server And Commit

**Files:**
- Modify: `scripts/threads_studio_server.mjs`
- Modify: `scripts/test_lifemagazine_draft.mjs`

- [x] **Step 1: Syntax checks**

Run:

```powershell
node --check scripts/threads_studio_server.mjs
node --check scripts/generate_lifemagazine_draft.mjs
node --check scripts/validate_lifemagazine_draft.mjs
```

Expected: all exit 0.

- [x] **Step 2: Test suite**

Run:

```powershell
node --test scripts/test_lifemagazine_draft.mjs
```

Expected: all tests pass.

- [x] **Step 3: Smoke test local app**

Run:

```powershell
Invoke-WebRequest -Uri "http://localhost:8788/" -UseBasicParsing
```

Expected: status 200 and HTML contains `라이프매거진 수동 작성`.

- [ ] **Step 4: Commit and push**

Run:

```powershell
git add scripts/threads_studio_server.mjs scripts/test_lifemagazine_draft.mjs docs/superpowers/plans/2026-05-27-threads-studio-conversation-ux.md
git commit -m "Improve Threads studio account workflows"
git pull --rebase origin master
git push origin master
```

Expected: push succeeds.
