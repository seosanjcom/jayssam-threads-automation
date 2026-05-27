import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  TONE_STYLES,
  generateLifemagazineDraft,
  saveLifemagazineDraft,
} from "./generate_lifemagazine_draft.mjs";
import { sendLifemagazinePreview } from "./send_lifemagazine_preview_telegram.mjs";
import { validateLifemagazineDraft } from "./validate_lifemagazine_draft.mjs";

const root = process.cwd();
const port = Number(process.env.THREADS_STUDIO_PORT || "8788");
const accountsPath = path.join(root, "config", "threads-accounts.json");

const STATUS_LABELS = {
  draft: "초안",
  ready_to_review: "초안",
  pending_approval: "승인 기다림",
  approved: "발행 대기",
  published: "발행 완료",
  publish_failed: "발행 실패",
  held: "보류",
};

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function kstDate(offsetDays = 0) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function todayKst() {
  return kstDate(0);
}

function readJson(filePath, fallback = null) {
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

function findJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJsonFiles(full));
    if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseProductLinks(value) {
  return parseLines(value).map((line) => {
    const [label, ...rest] = line.split("|");
    if (rest.length === 0) return { label: "추천 링크", url: label.trim() };
    return { label: label.trim(), url: rest.join("|").trim() };
  });
}

function parseContentDisposition(value = "") {
  const out = {};
  for (const part of value.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) continue;
    out[rawKey] = rawValue.join("=").replace(/^"|"$/g, "");
  }
  return out;
}

export function parseMultipartFormData(body, contentType = "") {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundaryText = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundaryText) return { fields: {}, files: [] };

  const boundary = Buffer.from(`--${boundaryText}`);
  const fields = {};
  const files = [];
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    cursor += boundary.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;
    const headers = Object.fromEntries(body.subarray(cursor, headerEnd).toString("utf8").split(/\r\n/).map((line) => {
      const [key, ...rest] = line.split(":");
      return [key.toLowerCase(), rest.join(":").trim()];
    }));
    const disposition = parseContentDisposition(headers["content-disposition"]);
    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundaryText}`), dataStart);
    if (nextBoundary === -1) break;
    const data = body.subarray(dataStart, nextBoundary);

    if (disposition.filename) {
      files.push({
        fieldName: disposition.name || "",
        filename: disposition.filename,
        contentType: headers["content-type"] || "application/octet-stream",
        data,
      });
    } else if (disposition.name) {
      fields[disposition.name] = data.toString("utf8");
    }

    cursor = body.indexOf(boundary, nextBoundary + 2);
  }

  return { fields, files };
}

function safeFilename(filename) {
  const parsed = path.parse(String(filename || "image"));
  const base = parsed.name
    .normalize("NFC")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "image";
  const ext = (parsed.ext || ".png").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".png";
  return `${base}${ext}`;
}

export function saveUploadedMediaFiles(files, options = {}) {
  const workspaceRoot = options.root || root;
  const date = options.date || todayKst();
  const stamp = new Date(options.now || Date.now()).toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
  const mediaDir = path.join(workspaceRoot, "outputs", "lifemagazine", "media", date);
  fs.mkdirSync(mediaDir, { recursive: true });

  return files
    .filter((file) => file.fieldName === "photos" && file.data?.length)
    .slice(0, 10)
    .map((file, index) => {
      const filename = `${stamp}-${index + 1}-${safeFilename(file.filename)}`;
      const fullPath = path.join(mediaDir, filename);
      fs.writeFileSync(fullPath, file.data);
      return path.relative(workspaceRoot, fullPath);
    });
}

function loadAccounts() {
  return readJson(accountsPath, { accounts: [] }).accounts || [];
}

function loadDrafts(accountKey = "lifemagazine") {
  const account = loadAccounts().find((item) => item.accountKey === accountKey);
  if (!account) return [];
  const dir = path.join(root, account.automationRoot);
  return findJsonFiles(dir)
    .map((file) => {
      const data = readJson(file);
      return data ? { file, data, mtime: fs.statSync(file).mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 60);
}

function loadDraftsByAccount(accounts) {
  return Object.fromEntries(accounts.map((account) => [account.accountKey, loadDrafts(account.accountKey)]));
}

function draftDate(data) {
  return data.draft_date || data.publish_date || String(data.recommended_publish_date || data.created_at || "").slice(0, 10);
}

function draftTime(data) {
  return data.recommended_publish_time || data.publish_time || "";
}

function humanStatus(status) {
  return STATUS_LABELS[status] || status || "상태 없음";
}

export function describeDraftProblem(data) {
  if (data.status === "publish_failed") {
    return data.publish_error || data.error || "발행 실패 원인이 기록되지 않았어.";
  }
  if (data.account === "lifemagazine_" && Array.isArray(data.local_media_paths) && data.local_media_paths.length > 0) {
    const mediaUrls = Array.isArray(data.media_urls) ? data.media_urls.filter(Boolean) : [];
    if (mediaUrls.length === 0) return "사진은 미리보기용으로 저장됐고, Threads 사진 발행용 공개 URL은 아직 없어.";
  }
  if (data.status === "pending_approval" && data.account === "offnote.kr") {
    return "오프노트는 텔레그램 미리보기 후 보류하지 않으면 예정 시간에 자동 발행돼. 메시지가 안 왔다면 텔레그램 전송 설정/실행 로그 확인이 필요해.";
  }
  if (data.status === "pending_approval") return "텔레그램에서 승인 버튼을 눌러야 발행 대기로 넘어가.";
  return "";
}

function normalizeDraft(item, account) {
  const data = item.data || item;
  const file = item.file || "";
  return {
    accountKey: account.accountKey,
    accountName: account.displayName,
    username: account.threadsUsername,
    file,
    data,
    id: data.id || path.basename(file, ".json"),
    title: data.topic || data.title || data.id || "제목 없는 초안",
    status: data.status || "draft",
    statusLabel: humanStatus(data.status),
    date: draftDate(data),
    time: draftTime(data),
    problem: describeDraftProblem(data),
    mtime: item.mtime || 0,
  };
}

export function buildOperationsDashboard(accounts, draftsByAccount, options = {}) {
  const today = options.today || todayKst();
  const tomorrow = options.tomorrow || kstDate(1);
  const allDrafts = accounts.flatMap((account) => (draftsByAccount[account.accountKey] || []).map((item) => normalizeDraft(item, account)));

  const accountSummaries = accounts.map((account) => {
    const drafts = allDrafts.filter((item) => item.accountKey === account.accountKey);
    return {
      account,
      todayPublished: drafts.filter((item) => item.date === today && item.status === "published").length,
      todayScheduled: drafts.filter((item) => item.date === today && item.status === "approved").length,
      approvalWaiting: drafts.filter((item) => item.status === "pending_approval").length,
      tomorrowScheduled: drafts.filter((item) => item.date === tomorrow && item.status === "approved").length,
      failed: drafts.filter((item) => item.status === "publish_failed").length,
      recent: drafts.sort((a, b) => b.mtime - a.mtime).slice(0, 5),
    };
  });

  const tasks = allDrafts
    .filter((item) => item.status === "pending_approval" || item.status === "approved")
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""))
    .slice(0, 8);
  const issues = allDrafts
    .filter((item) => item.status === "publish_failed" || item.problem)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 8);
  const tomorrowDrafts = allDrafts
    .filter((item) => item.date === tomorrow && ["approved", "pending_approval", "ready_to_review", "draft"].includes(item.status))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
    .slice(0, 8);

  return { today, tomorrow, accountSummaries, tasks, issues, tomorrowDrafts };
}

function draftText(data) {
  return data.threads_text || data.text || data.body || data.caption || "";
}

function isEditableDraft(data) {
  return data.account === "lifemagazine_" && !["published", "publishing"].includes(data.status);
}

function renderEmpty(text) {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function renderTaskItem(item) {
  const action =
    item.status === "pending_approval" ? "텔레그램 승인 필요" :
    item.status === "approved" ? "발행 시간 대기" :
    item.statusLabel;
  return `
    <article class="task-item">
      <div>
        <strong>${escapeHtml(item.accountName)}</strong>
        <span>${escapeHtml(item.title)}</span>
      </div>
      <p>${escapeHtml(item.date || "날짜 없음")} ${escapeHtml(item.time || "")} · ${escapeHtml(action)}</p>
    </article>
  `;
}

function renderIssueItem(item) {
  return `
    <article class="issue-item">
      <div>
        <strong>${escapeHtml(item.accountName)} · ${escapeHtml(item.statusLabel)}</strong>
        <span>${escapeHtml(item.title)}</span>
      </div>
      <p>${escapeHtml(item.problem || "확인이 필요해.")}</p>
    </article>
  `;
}

function accountReviewTitle(account) {
  if (account.accountKey === "offnote") return "오프노트 오늘 글";
  if (account.accountKey === "jayssam") return "제이쌤 오늘 글";
  return `${account.displayName} 오늘 글`;
}

function renderMiniDraftList(items, emptyText) {
  if (!items.length) return renderEmpty(emptyText);
  return items.slice(0, 4).map((item) => `
    <article class="mini-draft">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.date || "날짜 없음")} ${escapeHtml(item.time || "")} · ${escapeHtml(item.statusLabel)}</span>
      ${item.problem ? `<p>${escapeHtml(item.problem)}</p>` : ""}
    </article>
  `).join("");
}

function renderAccountReviewPanel(account, draftItems) {
  const todayItems = draftItems.filter((item) => item.date === todayKst());
  const approvalItems = draftItems.filter((item) => item.status === "pending_approval");
  const issueItems = draftItems.filter((item) => item.status === "publish_failed" || item.problem);
  const tomorrowItems = draftItems.filter((item) => item.date === kstDate(1));
  return `
    <section id="${escapeHtml(account.accountKey)}-review" class="review-panel">
      <div class="section-title">
        <p class="eyebrow">${escapeHtml(account.threadsUsername)}</p>
        <h2>${escapeHtml(accountReviewTitle(account))}</h2>
        <p class="muted">자동화가 만든 글은 여기서 상태만 확인해. 라이프매거진처럼 자동 소재 생성하지 않고, 계정별 규칙대로 분리해서 보여줘.</p>
      </div>
      <div class="review-columns">
        <div>
          <h3>오늘 발행/예정</h3>
          ${renderMiniDraftList(todayItems, "오늘 글 기록은 아직 없어.")}
        </div>
        <div>
          <h3>승인 대기</h3>
          ${renderMiniDraftList(approvalItems, "승인 대기 글은 없어.")}
        </div>
        <div>
          <h3>발행 실패 이유</h3>
          ${renderMiniDraftList(issueItems, "실패 기록은 없어.")}
        </div>
        <div>
          <h3>내일 예정</h3>
          ${renderMiniDraftList(tomorrowItems, "내일 예정 글은 아직 없어.")}
        </div>
      </div>
    </section>
  `;
}

function normalizedDraftsForAccount(account, groupedDrafts) {
  return (groupedDrafts[account.accountKey] || []).map((item) => normalizeDraft(item, account));
}

function renderAccountSummary(summary) {
  const { account } = summary;
  return `
    <section class="account-card">
      <div class="account-title">
        <div>
          <p class="eyebrow">${escapeHtml(account.project)}</p>
          <h3>${escapeHtml(account.displayName)}</h3>
          <p class="muted">@${escapeHtml(account.threadsUsername)}</p>
        </div>
        <span class="${summary.failed ? "badge danger" : "badge ok"}">${summary.failed ? "문제 있음" : "정상"}</span>
      </div>
      <div class="metric-grid">
        <div><b>${summary.todayPublished}</b><span>오늘 발행 완료</span></div>
        <div><b>${summary.todayScheduled}</b><span>오늘 발행 대기</span></div>
        <div><b>${summary.approvalWaiting}</b><span>승인 기다림</span></div>
        <div><b>${summary.tomorrowScheduled}</b><span>내일 예정</span></div>
      </div>
    </section>
  `;
}

function renderDraftCard(item) {
  const data = item.data || item;
  const relativePath = item.file ? path.relative(root, item.file) : "";
  const comments = Array.isArray(data.thread_comments) ? data.thread_comments : [];
  const links = Array.isArray(data.product_links) ? data.product_links : [];
  const media = Array.isArray(data.local_media_paths) ? data.local_media_paths : [];
  const editable = relativePath && isEditableDraft(data);
  const linkText = links.map((link) => `${link.label || ""}|${link.url || link}`).join("\n");
  return `
    <article class="draft-card">
      <div class="draft-head">
        <div>
          <h3>${escapeHtml(data.topic || data.id || "제목 없는 초안")}</h3>
          <p class="muted">${escapeHtml(humanStatus(data.status))} · ${escapeHtml(data.recommended_publish_time || "")}</p>
        </div>
        ${data.account === "lifemagazine_" && relativePath ? `
          <form class="inline-action" method="post" action="/api/lifemagazine/telegram-preview">
            <input type="hidden" name="draft_path" value="${escapeHtml(relativePath)}">
            <button type="submit">텔레그램으로 보내기</button>
          </form>
        ` : ""}
      </div>
      ${media.length ? `<p class="media-note">사진 ${media.length}장 첨부됨. 텔레그램 미리보기로 같이 보내져.</p>` : ""}
      <pre>${escapeHtml(draftText(data))}</pre>
      ${editable ? `
        <details class="edit-draft">
          <summary>수정하기</summary>
          <form method="post" action="/api/lifemagazine/drafts/edit">
            <input type="hidden" name="draft_path" value="${escapeHtml(relativePath)}">
            <label>눈에 들어온 포인트</label>
            <input name="topic" value="${escapeHtml(data.topic || "")}" required>
            <label>상품명</label>
            <input name="product_name" value="${escapeHtml(data.product_name || "")}" placeholder="예: 더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지">
            <label>어디서 봤는지</label>
            <input name="celebrity_or_content" value="${escapeHtml(data.celebrity_or_content || "")}">
            <label>메모</label>
            <textarea name="notes">${escapeHtml(data.notes || "")}</textarea>
            <label>상품 링크</label>
            <textarea name="product_links">${escapeHtml(linkText)}</textarea>
            <input type="hidden" name="product_relationship" value="${escapeHtml(data.product_relationship || "similar_mood")}">
            <input type="hidden" name="tone_style" value="${escapeHtml(data.tone_style || TONE_STYLES[0].key)}">
            <input type="hidden" name="date" value="${escapeHtml(data.draft_date || todayKst())}">
            <input type="hidden" name="custom_publish_time" value="${escapeHtml(String(data.recommended_publish_time || "").replace(" KST", ""))}">
            <button type="submit">수정 저장</button>
          </form>
        </details>
      ` : ""}
      ${comments.length ? `<h4>댓글</h4>${comments.slice(0, 2).map((comment, index) => `<pre><b>${index + 1}</b>\n${escapeHtml(comment)}</pre>`).join("")}` : ""}
      ${links.length ? `<h4>상품 링크</h4><ul>${links.map((link) => `<li>${escapeHtml(link.label)}: <a href="${escapeHtml(link.url)}">${escapeHtml(link.url)}</a></li>`).join("")}</ul>` : ""}
    </article>
  `;
}

function renderTonePicker() {
  return `
    <fieldset class="tone-picker">
      <legend>말투 선택</legend>
      <input type="hidden" id="tone_style" name="tone_style" value="${escapeHtml(TONE_STYLES[0].key)}">
      <div class="tone-grid">
        ${TONE_STYLES.map((style, index) => `
          <button class="tone-card ${index === 0 ? "selected" : ""}" type="button" data-tone="${escapeHtml(style.key)}" data-example="${escapeHtml(style.example)}" data-description="${escapeHtml(style.description)}">
            <strong>${escapeHtml(style.label)}</strong>
            <span>${escapeHtml(style.description)}</span>
          </button>
        `).join("")}
      </div>
      <div class="tone-example" aria-live="polite">
        <p id="toneDescription">${escapeHtml(TONE_STYLES[0].description)}</p>
        <pre id="toneExample">${escapeHtml(TONE_STYLES[0].example)}</pre>
      </div>
    </fieldset>
  `;
}

function renderLifemagazineComposer() {
  return `
    <section class="composer" id="lifemagazine-compose">
      <div class="section-title">
        <p class="eyebrow">lifemagazine_</p>
        <h2>라이프매거진 수동 작성</h2>
        <p class="muted">자동으로 글감을 만들지 않아. 네가 사진/영상, 출처 메모, 상품링크를 줄 때만 Threads 본문, 댓글, 인스타 문구를 만든다.</p>
      </div>
      <form method="post" action="/api/lifemagazine/drafts" enctype="multipart/form-data">
        <label for="photos">1. 사진/영상</label>
        <input id="photos" name="photos" type="file" accept="image/*,video/*" multiple>

        <label for="topic">2. 뭐가 눈에 들어왔는지</label>
        <input id="topic" name="topic" required placeholder="예: 환연4 민경님 컨실러, 다크서클 커버템">

        <label for="product_name">3. 상품명</label>
        <input id="product_name" name="product_name" placeholder="예: 더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지">

        <label for="celebrity_or_content">4. 어디서 봤는지</label>
        <input id="celebrity_or_content" name="celebrity_or_content" placeholder="예: ㅇㅇ 유튜브, 드라마 3화, 공식 인스타 릴스">

        <label for="notes">5. 출처 메모 / 왜 줬는지</label>
        <textarea id="notes" name="notes" placeholder="몇 분쯤 나왔는지, 직접 언급인지, 왜 눈에 띄었는지, 피해야 할 표현 등"></textarea>

        <label for="product_links">6. 상품 링크</label>
        <textarea id="product_links" name="product_links" placeholder="영상 속 헤어템|https://상품링크&#10;비슷한 무드 참고템|https://상품링크"></textarea>

        <div class="form-row">
          <div>
            <label for="product_relationship">제품 관계</label>
            <select id="product_relationship" name="product_relationship">
              <option value="official_confirmed">공식 언급템</option>
              <option value="strong_guess">거의 맞아 보임</option>
              <option value="similar_mood" selected>비슷한 무드</option>
              <option value="trend_only">트렌드만</option>
            </select>
          </div>
          <div>
            <label for="slot">추천 시간</label>
            <select id="slot" name="slot">
              <option value="afternoon">15:00 KST · 알고리즘 친화</option>
              <option value="evening" selected>18:00 KST · 참여 가장 좋음</option>
              <option value="night">21:00 KST · 댓글 가장 좋음</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div>
            <label for="date">발행 날짜</label>
            <input id="date" name="date" type="date" value="${todayKst()}">
          </div>
          <div>
            <label for="custom_publish_time">내가 정하는 발행 시간</label>
            <input id="custom_publish_time" name="custom_publish_time" type="time">
            <p class="muted">비워두면 위 추천 시간을 써. 이미 21시가 지났으면 여기서 원하는 시간으로 바꾸면 돼.</p>
          </div>
        </div>

        <label for="source_urls">출처 URL</label>
        <textarea id="source_urls" name="source_urls" placeholder="한 줄에 하나씩. 유튜브/인스타/공식몰/브랜드 공지 등"></textarea>

        ${renderTonePicker()}
        <button type="submit">초안 만들기</button>
      </form>
    </section>
  `;
}

function renderOperationsDashboard(dashboard) {
  return `
    <section class="hero-panel">
      <div>
        <p class="eyebrow">today</p>
        <h1>오늘 운영 현황</h1>
        <p class="muted">${escapeHtml(dashboard.today)} 기준. 승인할 것, 발행 대기, 실패 원인을 먼저 보여줘.</p>
      </div>
      <a class="primary-link" href="#lifemagazine-compose">라이프매거진 수동 작성</a>
    </section>

    <div class="account-grid">
      ${dashboard.accountSummaries.map(renderAccountSummary).join("")}
    </div>

    <section class="quick-actions">
      <div class="section-title">
        <h2>무엇을 할까요?</h2>
        <p class="muted">계정마다 작업 방식이 달라. 라이프매거진은 네가 준 사진/메모/링크로만 만들고, 오프노트와 제이쌤은 자동화 결과를 확인해.</p>
      </div>
      <div class="action-grid">
        <a class="action-card" href="#lifemagazine-compose"><strong>라이프매거진 수동 작성</strong><span>사진/영상, 출처 메모, 상품링크를 넣고 초안을 만든다.</span></a>
        <a class="action-card" href="#offnote-review"><strong>오프노트 자동화 확인</strong><span>블로그/체험단 글의 오늘 발행, 내일 예정, 실패 이유를 본다.</span></a>
        <a class="action-card" href="#jayssam-review"><strong>제이쌤 교육 자동화</strong><span>교육 콘텐츠 발행 상태와 승인 대기 글을 확인한다.</span></a>
      </div>
    </section>

    <div class="ops-grid">
      <section>
        <div class="section-title">
          <h2>오늘 할 일</h2>
          <p class="muted">승인하거나 발행 시간을 기다리는 항목이야.</p>
        </div>
        ${dashboard.tasks.length ? dashboard.tasks.map(renderTaskItem).join("") : renderEmpty("지금 당장 처리할 항목은 없어.")}
      </section>
      <section>
        <div class="section-title">
          <h2>문제 있는 항목</h2>
          <p class="muted">발행 실패 이유나 발행 전 확인이 필요한 것만 모아둬.</p>
        </div>
        ${dashboard.issues.length ? dashboard.issues.map(renderIssueItem).join("") : renderEmpty("현재 기록된 실패나 경고가 없어.")}
      </section>
      <section>
        <div class="section-title">
          <h2>내일 예정</h2>
          <p class="muted">${escapeHtml(dashboard.tomorrow)}에 올라갈 후보야.</p>
        </div>
        ${dashboard.tomorrowDrafts.length ? dashboard.tomorrowDrafts.map(renderTaskItem).join("") : renderEmpty("내일 예정된 초안은 아직 없어.")}
      </section>
    </div>
  `;
}

export function renderStudioHome({ accounts = [], drafts = [], draftsByAccount = null, today = null, tomorrow = null } = {}) {
  const groupedDrafts = draftsByAccount || { lifemagazine: drafts, jayssam: [], offnote: [] };
  const dashboard = buildOperationsDashboard(accounts, groupedDrafts, {
    today: today || todayKst(),
    tomorrow: tomorrow || kstDate(1),
  });
  const recentLifeDrafts = (groupedDrafts.lifemagazine || drafts || []).slice(0, 5);
  const offnoteAccount = accounts.find((account) => account.accountKey === "offnote");
  const jayssamAccount = accounts.find((account) => account.accountKey === "jayssam");
  const offnotePanel = offnoteAccount ? renderAccountReviewPanel(offnoteAccount, normalizedDraftsForAccount(offnoteAccount, groupedDrafts)) : "";
  const jayssamPanel = jayssamAccount ? renderAccountReviewPanel(jayssamAccount, normalizedDraftsForAccount(jayssamAccount, groupedDrafts)) : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>스레드 자동화 화면</title>
  <style>
    :root { color-scheme: light; --bg:#f4f5f7; --ink:#15171a; --muted:#68707a; --line:#dfe3e8; --panel:#fff; --brand:#214f46; --accent:#b83b5e; --danger:#b42318; --warn:#a15c07; --soft:#f8fafb; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    header { position:sticky; top:0; z-index:2; background:rgba(255,255,255,.95); border-bottom:1px solid var(--line); padding:14px 18px; backdrop-filter:blur(10px); }
    h1,h2,h3,p { margin-top:0; }
    h1 { margin-bottom:6px; font-size:28px; }
    h2 { margin-bottom:8px; font-size:19px; }
    h3 { margin-bottom:4px; font-size:16px; }
    main { max-width:1360px; margin:0 auto; padding:18px; }
    section,.account-card,.draft-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .muted,.empty,.task-item p,.issue-item p,.media-note { color:var(--muted); font-size:13px; }
    .eyebrow { color:var(--accent); font-size:11px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; margin-bottom:4px; }
    .hero-panel { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:14px; }
    .primary-link, form > button { display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--brand); border-radius:6px; padding:10px 12px; background:var(--brand); color:#fff; font-weight:900; text-decoration:none; cursor:pointer; }
    .account-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:14px; }
    .account-title { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
    .badge { border-radius:999px; padding:5px 8px; font-size:12px; font-weight:900; white-space:nowrap; }
    .badge.ok { background:#edf7f2; color:#176345; }
    .badge.danger { background:#fff1f0; color:var(--danger); }
    .metric-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
    .metric-grid div { background:var(--soft); border:1px solid var(--line); border-radius:6px; padding:10px; }
    .metric-grid b { display:block; font-size:24px; }
    .metric-grid span { color:var(--muted); font-size:12px; }
    .ops-grid { display:grid; grid-template-columns:1.1fr 1.1fr .9fr; gap:12px; margin-bottom:16px; align-items:start; }
    .quick-actions { margin-bottom:14px; }
    .action-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .action-card { display:block; border:1px solid var(--line); border-radius:8px; padding:12px; color:var(--ink); text-decoration:none; background:var(--soft); }
    .action-card strong { display:block; margin-bottom:5px; }
    .action-card span { color:var(--muted); font-size:13px; line-height:1.5; }
    .review-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; align-items:start; }
    .review-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .mini-draft { border:1px solid var(--line); border-radius:6px; padding:10px; background:var(--soft); margin-bottom:8px; }
    .mini-draft strong { display:block; margin-bottom:4px; }
    .mini-draft span,.mini-draft p { display:block; color:var(--muted); font-size:12px; line-height:1.45; }
    .task-item,.issue-item { border-top:1px solid var(--line); padding:11px 0; }
    .task-item:first-of-type,.issue-item:first-of-type { border-top:0; }
    .task-item div,.issue-item div { display:flex; justify-content:space-between; gap:12px; }
    .task-item span,.issue-item span { text-align:right; color:#3d454d; }
    .workspace { display:grid; grid-template-columns:minmax(360px,480px) 1fr; gap:14px; align-items:start; }
    label,legend { display:block; margin:12px 0 6px; font-weight:900; font-size:13px; }
    input,select,textarea,button { width:100%; font:inherit; border:1px solid var(--line); border-radius:6px; padding:10px; background:#fff; color:var(--ink); }
    textarea { min-height:82px; resize:vertical; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    fieldset { border:0; margin:0; padding:0; }
    .tone-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .tone-card { min-height:78px; text-align:left; cursor:pointer; }
    .tone-card strong { display:block; margin-bottom:5px; font-size:13px; }
    .tone-card span { color:var(--muted); font-size:12px; }
    .tone-card.selected { border-color:var(--accent); box-shadow:0 0 0 2px rgba(184,59,94,.12); }
    pre { white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; background:var(--soft); border:1px solid var(--line); border-radius:6px; padding:12px; line-height:1.6; }
    .draft-card { margin-bottom:12px; }
    .draft-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .inline-action { min-width:150px; }
    .inline-action input { display:none; }
    .inline-action button { width:auto; background:#fff; color:var(--brand); border-color:#a8c7bd; font-size:12px; font-weight:900; cursor:pointer; }
    .media-note { background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:8px; }
    @media (max-width:1100px) { .account-grid,.ops-grid,.workspace,.action-grid,.review-grid,.review-columns { grid-template-columns:1fr; } .hero-panel { align-items:flex-start; flex-direction:column; } }
    @media (max-width:640px) { main { padding:12px; } .form-row,.tone-grid { grid-template-columns:1fr; } .task-item div,.issue-item div,.draft-head { flex-direction:column; } .task-item span,.issue-item span { text-align:left; } }
  </style>
</head>
<body>
  <header>
    <strong>스레드 자동화 화면</strong>
    <p class="muted">오늘 뭐가 끝났고, 뭐가 승인 대기인지, 어디가 실패했는지 먼저 보여줘.</p>
  </header>
  <main>
    ${renderOperationsDashboard(dashboard)}
    <div class="review-grid">
      ${offnotePanel}
      ${jayssamPanel}
    </div>
    <div class="workspace">
      ${renderLifemagazineComposer()}
      <section>
        <div class="section-title">
          <p class="eyebrow">recent</p>
          <h2>라이프매거진 최근 초안</h2>
          <p class="muted">최근 5개만 보여줘. 발행된 글이 아니라 작업 기록이야.</p>
        </div>
        ${recentLifeDrafts.length ? recentLifeDrafts.map(renderDraftCard).join("") : renderEmpty("아직 만든 초안이 없어.")}
      </section>
    </div>
  </main>
  <script>
    const toneInput = document.getElementById("tone_style");
    const toneExample = document.getElementById("toneExample");
    const toneDescription = document.getElementById("toneDescription");
    for (const button of document.querySelectorAll(".tone-card")) {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tone-card").forEach((item) => item.classList.remove("selected"));
        button.classList.add("selected");
        toneInput.value = button.dataset.tone;
        toneExample.textContent = button.dataset.example;
        toneDescription.textContent = button.dataset.description;
      });
    }
  </script>
</body>
</html>`;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handleCreateDraft(req, res) {
  const body = await readRequestBody(req);
  const contentType = req.headers["content-type"] || "";
  const multipart = contentType.includes("multipart/form-data") ? parseMultipartFormData(body, contentType) : null;
  const params = multipart ? new URLSearchParams(multipart.fields) : new URLSearchParams(body.toString("utf8"));
  const localMediaPaths = multipart ? saveUploadedMediaFiles(multipart.files, { root, date: params.get("date") || todayKst() }) : [];
  const draft = generateLifemagazineDraft({
    date: params.get("date"),
    slot: params.get("slot"),
    custom_publish_time: params.get("custom_publish_time"),
    topic: params.get("topic"),
    product_name: params.get("product_name"),
    celebrity_or_content: params.get("celebrity_or_content"),
    product_relationship: params.get("product_relationship"),
    tone_style: params.get("tone_style"),
    source_urls: parseLines(params.get("source_urls")),
    product_links: parseProductLinks(params.get("product_links")),
    local_media_paths: localMediaPaths,
    notes: params.get("notes"),
  });
  const validation = validateLifemagazineDraft(draft);
  if (!validation.ok) {
    res.writeHead(422, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(validation, null, 2));
    return;
  }
  const savedPath = saveLifemagazineDraft(draft, { root });
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (token && chatId && !token.includes("replace_") && !chatId.includes("replace_")) {
    await sendLifemagazinePreview(savedPath, { root });
  }
  res.writeHead(303, { Location: "/" });
  res.end();
}

function resolveDraftPath(relativePath) {
  const fullPath = path.resolve(root, relativePath || "");
  const automationRoot = path.resolve(root, "outputs", "lifemagazine", "automation");
  if (!fullPath.startsWith(`${automationRoot}${path.sep}`)) {
    throw new Error("Invalid draft path.");
  }
  return fullPath;
}

async function handleEditDraft(req, res) {
  const body = await readRequestBody(req);
  const params = new URLSearchParams(body.toString("utf8"));
  try {
    const draftPath = resolveDraftPath(params.get("draft_path"));
    const current = readJson(draftPath);
    if (!current || current.account !== "lifemagazine_") throw new Error("Draft not found.");
    if (!isEditableDraft(current)) throw new Error("Published drafts cannot be edited.");

    const draft = generateLifemagazineDraft({
      id: current.id,
      date: params.get("date") || current.draft_date,
      slot: current.slot || "manual",
      custom_publish_time: params.get("custom_publish_time"),
      topic: params.get("topic"),
      product_name: params.get("product_name"),
      celebrity_or_content: params.get("celebrity_or_content"),
      product_relationship: params.get("product_relationship") || current.product_relationship,
      tone_style: params.get("tone_style") || current.tone_style,
      source_urls: current.source_urls || [],
      product_links: parseProductLinks(params.get("product_links")),
      local_media_paths: current.local_media_paths || [],
      media_urls: current.media_urls || [],
      notes: params.get("notes"),
      status: current.status,
      recommended_publish_time: params.get("custom_publish_time") ? "" : current.recommended_publish_time,
    }, { now: current.created_at || new Date().toISOString() });
    draft.created_at = current.created_at || draft.created_at;
    draft.updated_at = new Date().toISOString();

    const validation = validateLifemagazineDraft(draft);
    if (!validation.ok) {
      res.writeHead(422, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(validation, null, 2));
      return;
    }
    writeJson(draftPath, draft);
    res.writeHead(303, { Location: "/" });
    res.end();
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  }
}

async function handleSendTelegramPreview(req, res) {
  const body = await readRequestBody(req);
  const params = new URLSearchParams(body.toString("utf8"));
  const draftPath = params.get("draft_path");
  if (!draftPath) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: "draft_path is required" }, null, 2));
    return;
  }
  const token = process.env.LIFEMAGAZINE_TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.LIFEMAGAZINE_TELEGRAM_CHAT_ID || "";
  if (!token || !chatId || token.includes("replace_") || chatId.includes("replace_")) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: false,
      error: "Telegram is not configured. Set LIFEMAGAZINE_TELEGRAM_BOT_TOKEN and LIFEMAGAZINE_TELEGRAM_CHAT_ID.",
    }, null, 2));
    return;
  }
  try {
    const result = await sendLifemagazinePreview(draftPath, { root });
    res.writeHead(303, { Location: "/" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  }
}

export function createStudioServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "POST" && requestUrl.pathname === "/api/lifemagazine/drafts") {
      await handleCreateDraft(req, res);
      return;
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/lifemagazine/drafts/edit") {
      await handleEditDraft(req, res);
      return;
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/lifemagazine/telegram-preview") {
      await handleSendTelegramPreview(req, res);
      return;
    }
    if (requestUrl.pathname === "/drafts") {
      const accountKey = requestUrl.searchParams.get("account");
      const accounts = loadAccounts();
      const payload = accountKey ? loadDrafts(accountKey).map((item) => item.data) : loadDraftsByAccount(accounts);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }
    const accounts = loadAccounts();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(renderStudioHome({ accounts, draftsByAccount: loadDraftsByAccount(accounts) }));
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  loadEnv();
  createStudioServer().listen(port, "0.0.0.0", () => {
    console.log(`Threads automation dashboard: http://localhost:${port}`);
  });
}
