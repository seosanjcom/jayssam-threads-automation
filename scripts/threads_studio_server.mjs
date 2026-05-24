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

function loadEnv() {
  if (!fs.existsSync(".env")) return;
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

function todayKst() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
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
    .slice(0, 20);
}

function loadDraftsByAccount(accounts) {
  return Object.fromEntries(accounts.map((account) => [account.accountKey, loadDrafts(account.accountKey)]));
}

function draftText(data) {
  return data.threads_text || data.text || data.body || data.caption || "";
}

function renderAccountPanel(account, drafts = []) {
  const latest = drafts.slice(0, 3);
  return `
    <section class="account-panel" id="account-${escapeHtml(account.accountKey)}">
      <div class="account-head">
        <div>
          <p class="eyebrow">${escapeHtml(account.project)}</p>
          <h2>${escapeHtml(account.displayName)}</h2>
          <p class="handle">@${escapeHtml(account.threadsUsername)}</p>
        </div>
        <span class="count">${drafts.length}</span>
      </div>
      <dl class="rules">
        <div><dt>기본 슬롯</dt><dd>${escapeHtml((account.defaultSlots || []).join(", "))}</dd></div>
        <div><dt>출력 폴더</dt><dd>${escapeHtml(account.automationRoot)}</dd></div>
        <div><dt>게시 제한</dt><dd>일 ${escapeHtml(account.dailyPostLimit)}회 / ${escapeHtml(account.minIntervalHours)}시간 간격</dd></div>
      </dl>
      <div class="draft-list">
        ${latest.length ? latest.map(renderDraftCard).join("") : '<p class="hint">아직 표시할 초안이 없어.</p>'}
      </div>
    </section>
  `;
}

function renderDraftCard(item) {
  const data = item.data || item;
  const comments = Array.isArray(data.thread_comments) ? data.thread_comments : [];
  const links = Array.isArray(data.product_links) ? data.product_links : [];
  const relativePath = item.file ? path.relative(root, item.file) : "";
  return `
    <article class="draft">
      <div class="meta">
        <span>${escapeHtml(data.account || data.account_name || data.project || "draft")}</span>
        <span>${escapeHtml(data.status || "unknown")}</span>
        ${data.recommended_publish_time ? `<span>${escapeHtml(data.recommended_publish_time)}</span>` : ""}
        ${data.tone_label ? `<span>${escapeHtml(data.tone_label)}</span>` : ""}
      </div>
      <h3>${escapeHtml(data.topic || data.id || "제목 없음")}</h3>
      ${relativePath ? `<p class="path">${escapeHtml(relativePath)}</p>` : ""}
      ${data.account === "lifemagazine_" && relativePath ? `
        <form class="inline-action" method="post" action="/api/lifemagazine/telegram-preview">
          <input type="hidden" name="draft_path" value="${escapeHtml(relativePath)}">
          <button type="submit">텔레그램 미리보기</button>
        </form>
      ` : ""}
      <pre>${escapeHtml(draftText(data))}</pre>
      ${comments.length ? `<h4>댓글 초안</h4>${comments.slice(0, 2).map((comment, index) => `<pre><b>${index + 1}</b>\n${escapeHtml(comment)}</pre>`).join("")}` : ""}
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

function renderLifemagazineForm(accounts) {
  return `
    <section class="composer">
      <div class="section-title">
        <p class="eyebrow">lifemagazine_ composer</p>
        <h2>사진/메모/링크 넣고 초안 만들기</h2>
      </div>
      <form method="post" action="/api/lifemagazine/drafts" enctype="multipart/form-data">
        <label for="account">계정</label>
        <select id="account" name="account" disabled>
          ${accounts.map((account) => `<option ${account.accountKey === "lifemagazine" ? "selected" : ""}>${escapeHtml(account.displayName)} @${escapeHtml(account.threadsUsername)}</option>`).join("")}
        </select>

        <div class="form-row">
          <div>
            <label for="date">날짜</label>
            <input id="date" name="date" type="date" value="${todayKst()}">
          </div>
          <div>
            <label for="slot">게시 슬롯</label>
            <select id="slot" name="slot">
              <option value="afternoon">15:00 KST</option>
              <option value="evening" selected>18:00 KST</option>
              <option value="night">21:00 KST</option>
            </select>
          </div>
        </div>

        <label for="topic">뭐가 눈에 들어왔는지</label>
        <input id="topic" name="topic" required placeholder="예: 유튜브 속 광나는 헤어템">

        <label for="celebrity_or_content">어디서 봤는지</label>
        <input id="celebrity_or_content" name="celebrity_or_content" placeholder="예: ㅇㅇ 유튜브, 드라마 3화, 공식 인스타 릴스">

        <label for="photos">사진</label>
        <input id="photos" name="photos" type="file" accept="image/*" multiple>
        <p class="hint">스크린샷이나 상품 사진을 넣으면 초안에 저장되고 텔레그램 미리보기에도 같이 보내.</p>

        ${renderTonePicker()}

        <label for="product_relationship">제품 관계</label>
        <select id="product_relationship" name="product_relationship">
          <option value="official_confirmed">직접 언급/공식 확인된 제품</option>
          <option value="strong_guess">거의 맞아 보이지만 공식 확인은 아님</option>
          <option value="similar_mood" selected>비슷한 무드 참고템</option>
          <option value="trend_only">제품 링크 없이 트렌드만</option>
        </select>

        <label for="source_urls">출처 URL</label>
        <textarea id="source_urls" name="source_urls" placeholder="한 줄에 하나씩. 유튜브/인스타/공식몰/브랜드 공지 등"></textarea>

        <label for="product_links">상품 링크</label>
        <textarea id="product_links" name="product_links" placeholder="라벨|URL 형식, 한 줄에 하나씩"></textarea>

        <label for="notes">내 메모</label>
        <textarea id="notes" name="notes" placeholder="왜 줬는지, 어디가 예뻤는지, 직접 언급인지, 피해야 할 표현 등"></textarea>

        <button type="submit">초안 생성</button>
      </form>
    </section>
  `;
}

export function renderStudioHome({ accounts = [], drafts = [], draftsByAccount = null } = {}) {
  const groupedDrafts = draftsByAccount || {
    lifemagazine: drafts,
    jayssam: [],
    offnote: [],
  };
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Threads Studio</title>
  <style>
    :root { color-scheme: light; --bg:#f4f5f7; --ink:#15171a; --muted:#68707a; --line:#dfe3e8; --panel:#fff; --brand:#214f46; --accent:#b83b5e; --soft:#f8fafb; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { position:sticky; top:0; z-index:2; background:rgba(255,255,255,.94); border-bottom:1px solid var(--line); padding:14px 18px; backdrop-filter: blur(10px); }
    h1, h2, h3, p { margin-top:0; }
    h1 { margin-bottom:3px; font-size:22px; }
    h2 { font-size:18px; margin-bottom:8px; }
    h3 { font-size:15px; margin-bottom:6px; }
    main { max-width:1320px; margin:0 auto; padding:18px; }
    .dashboard { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; margin-bottom:18px; }
    .workspace { display:grid; grid-template-columns:minmax(340px, 460px) 1fr; gap:18px; align-items:start; }
    section, .draft { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; }
    .account-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .eyebrow { color:var(--accent); font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:4px; }
    .handle, .hint, .path, .meta, .tone-card span, .rules { color:var(--muted); font-size:12px; }
    .count { display:grid; place-items:center; width:34px; height:34px; border-radius:50%; background:#eef5f2; color:var(--brand); font-weight:900; }
    .rules { display:grid; gap:5px; margin:12px 0; }
    .rules div { display:grid; grid-template-columns:72px 1fr; gap:8px; }
    .rules dt { font-weight:800; color:#3d454d; }
    .rules dd { margin:0; overflow-wrap:anywhere; }
    label, legend { display:block; margin:12px 0 6px; font-weight:800; font-size:13px; }
    input, select, textarea, button { width:100%; font:inherit; border:1px solid var(--line); border-radius:6px; padding:10px; background:#fff; color:var(--ink); }
    textarea { min-height:76px; resize:vertical; }
    form > button { margin-top:14px; background:var(--brand); color:#fff; border-color:var(--brand); font-weight:900; cursor:pointer; }
    .inline-action { margin:8px 0 10px; }
    .inline-action button { width:auto; margin:0; padding:8px 10px; background:#fff; color:var(--brand); border-color:#a8c7bd; font-size:12px; font-weight:900; }
    .inline-action input { display:none; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    fieldset { border:0; margin:0; padding:0; }
    .tone-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; }
    .tone-card { text-align:left; min-height:78px; border-color:var(--line); background:#fff; cursor:pointer; }
    .tone-card strong { display:block; margin-bottom:5px; font-size:13px; }
    .tone-card.selected { border-color:var(--accent); box-shadow:0 0 0 2px rgba(184,59,94,.12); }
    .tone-example pre, pre { white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; background:var(--soft); border:1px solid var(--line); border-radius:6px; padding:12px; line-height:1.6; }
    .tone-example { margin-top:10px; }
    .tone-example p { color:var(--muted); font-size:12px; margin-bottom:6px; }
    .meta { display:flex; gap:6px; flex-wrap:wrap; }
    .meta span { border:1px solid var(--line); border-radius:999px; padding:3px 7px; background:#fafafa; }
    .draft { margin-bottom:12px; }
    .draft h4 { margin:10px 0 6px; font-size:13px; }
    .draft ul { padding-left:18px; }
    @media (max-width: 1100px) { .dashboard, .workspace { grid-template-columns:1fr; } }
    @media (max-width: 640px) { main { padding:12px; } .form-row, .tone-grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Threads Multi-Account Studio</h1>
    <p class="hint">제이쌤, 오프노트, 라이프매거진을 한 화면에서 보고 계정별 초안과 규칙은 분리해서 관리해.</p>
  </header>
  <main>
    <div class="dashboard">
      ${accounts.map((account) => renderAccountPanel(account, groupedDrafts[account.accountKey] || [])).join("")}
    </div>
    <div class="workspace">
      ${renderLifemagazineForm(accounts)}
      <section>
        <div class="section-title">
          <p class="eyebrow">latest lifemagazine drafts</p>
          <h2>방금 만든 초안 확인</h2>
        </div>
        ${(groupedDrafts.lifemagazine || drafts || []).length ? (groupedDrafts.lifemagazine || drafts).map(renderDraftCard).join("") : '<p class="hint">아직 생성된 초안이 없어.</p>'}
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
  const multipart = contentType.includes("multipart/form-data")
    ? parseMultipartFormData(body, contentType)
    : null;
  const params = multipart ? new URLSearchParams(multipart.fields) : new URLSearchParams(body.toString("utf8"));
  const localMediaPaths = multipart
    ? saveUploadedMediaFiles(multipart.files, { root, date: params.get("date") || todayKst() })
    : [];
  const draft = generateLifemagazineDraft({
    date: params.get("date"),
    slot: params.get("slot"),
    topic: params.get("topic"),
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
  saveLifemagazineDraft(draft, { root });
  res.writeHead(303, { Location: "/" });
  res.end();
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
    console.log(`Threads Studio: http://localhost:${port}`);
  });
}
