import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "offnote-telegram-controls-"));

function copyScript(name) {
  const target = path.join(tmp, "scripts", name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "scripts", name), target);
}
function copyFile(relPath) {
  const target = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, relPath), target);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function runNode(args, env = {}) {
  return spawnSync("node", args, { cwd: tmp, encoding: "utf8", env: { ...process.env, ...env } });
}
function requireSuccess(result, label) {
  if (result.status !== 0) throw new Error(`${label} failed:\n${result.stderr}\n${result.stdout}`);
}

try {
  for (const name of [
    "offnote_schedule.mjs",
    "telegram_check_offnote_approvals.mjs",
    "generate_offnote_daily_post.mjs",
    "validate_offnote_draft.mjs",
    "prepare_offnote_daily_facts.mjs",
  ]) copyScript(name);
  copyFile("scripts/offnote_evergreen_observations.json");
  copyFile("config/offnote-schedule.json");

  const routeCli = runNode(["scripts/offnote_schedule.mjs"]);
  requireSuccess(routeCli, "Offnote schedule CLI route");
  if (!/^mode=(?:skip|preview|auto_publish|health)\nslot=(?:evening|night)\n/m.test(routeCli.stdout)) {
    throw new Error(`Schedule CLI did not emit parseable route output:\n${routeCli.stdout}`);
  }

  const fixture = path.join(tmp, "telegram-updates.json");
  writeJson(fixture, [
    { update_id: 101, message: { chat: { id: 777 }, text: "/시간" } },
    { update_id: 102, message: { chat: { id: 777 }, text: "/시간 16:00 22:30" } },
    { update_id: 103, message: { chat: { id: 777 }, text: "긴급 기록: 정산 파일 하나 마무리했고, 남는 시간에 소개 페이지 문구를 다시 보고 있음 ㅎㅎ" } },
    { update_id: 104, message: { chat: { id: 777 }, text: "짧음" } },
    { update_id: 105, message: { chat: { id: 777 }, text: "a".repeat(501) } },
    { update_id: 106, message: { chat: { id: 777 }, text: "자료 확인 https://example.com 지금은 저장하지 않기" } },
    { update_id: 107, message: { chat: { id: 777 }, text: "/시간 25:00 22:30" } },
    { update_id: 108, message: { chat: { id: 777 }, text: "/시간 16:00 16:00" } },
  ]);
  const handler = runNode(["scripts/telegram_check_offnote_approvals.mjs"], {
    OFFNOTE_TELEGRAM_BOT_TOKEN: "test-token",
    OFFNOTE_TELEGRAM_CHAT_ID: "777",
    OFFNOTE_TELEGRAM_DRY_RUN: "true",
    OFFNOTE_TELEGRAM_UPDATES_FILE: fixture,
    OFFNOTE_TEST_DATE: "2026-05-24",
    OFFNOTE_TEST_NOW: "2026-05-24T04:00:00Z",
  });
  requireSuccess(handler, "Telegram manual-input dry run");
  if (!handler.stdout.includes("1차: 15:30 KST") || !handler.stdout.includes("2차: 21:30 KST")) {
    throw new Error(`Current schedule query did not return the default times:\n${handler.stdout}`);
  }
  if (!handler.stdout.includes("1차: 16:00 KST") || !handler.stdout.includes("2차: 22:30 KST")) {
    throw new Error(`Valid schedule change confirmation was not returned:\n${handler.stdout}`);
  }
  if (!handler.stdout.includes("8자 이상") || !handler.stdout.includes("500자 이내") || !handler.stdout.includes("상품 링크·제휴 문구")) {
    throw new Error(`Input length/link rejection messages were not returned:\n${handler.stdout}`);
  }
  if (!handler.stdout.includes("유효하지 않은 시간이야") || !handler.stdout.includes("두 발행 시간은 서로 달라야 해")) {
    throw new Error(`Invalid/equal schedule rejection messages were not returned:\n${handler.stdout}`);
  }

  const schedule = readJson(path.join(tmp, "config", "offnote-schedule.json"));
  if (schedule.slots.evening !== "16:00" || schedule.slots.night !== "22:30") {
    throw new Error(`Telegram schedule command was not persisted: ${JSON.stringify(schedule)}`);
  }

  const facts = readJson(path.join(tmp, "outputs", "afterwork-profit", "offnote-daily-facts", "2026-05-24.json"));
  if (facts.facts?.length !== 1) throw new Error(`Rejected Telegram inputs were stored unexpectedly: ${JSON.stringify(facts)}`);
  const manual = facts.facts?.find((fact) => fact.source_mode === "telegram_manual_input");
  if (!manual || manual.priority_slot !== "evening") throw new Error(`Telegram manual fact was not assigned to the next slot: ${JSON.stringify(facts)}`);

  const evening = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-24", "evening"]);
  requireSuccess(evening, "manual-priority Offnote generation");
  const eveningPath = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24", fs.readdirSync(path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-24")).find((file) => file.includes("-evening-") && file.endsWith(".json")));
  const eveningDraft = readJson(eveningPath);
  if (eveningDraft.source_mode !== "telegram_manual_input" || eveningDraft.manual_input_id !== manual.id) {
    throw new Error(`Manual Telegram fact was not prioritized: ${JSON.stringify(eveningDraft)}`);
  }
  if (eveningDraft.recommended_publish_time !== "16:00 KST") throw new Error(`Draft did not use the changed time: ${eveningDraft.recommended_publish_time}`);
  requireSuccess(runNode(["scripts/validate_offnote_draft.mjs", eveningPath]), "manual-priority Offnote validation");

  const fallback = runNode(["scripts/generate_offnote_daily_post.mjs", "2026-05-25", "night"]);
  requireSuccess(fallback, "no-input automatic fallback generation");
  const fallbackDir = path.join(tmp, "outputs", "afterwork-profit", "automation", "2026-05-25");
  const fallbackPath = path.join(fallbackDir, fs.readdirSync(fallbackDir).find((file) => file.includes("-night-") && file.endsWith(".json")));
  const fallbackDraft = readJson(fallbackPath);
  if (fallbackDraft.source_mode !== "curated_evergreen_observation") throw new Error(`No-input fallback was not used: ${fallbackDraft.source_mode}`);

  const unchanged = readJson(path.join(tmp, "config", "offnote-schedule.json"));
  if (unchanged.slots.evening !== "16:00" || unchanged.slots.night !== "22:30") throw new Error("Invalid schedule command changed the stored schedule.");

  const { resolveRoute } = await import(pathToFileURL(path.join(tmp, "scripts", "offnote_schedule.mjs")).href);
  const publishRoute = resolveRoute(new Date("2026-05-24T07:02:00Z"), tmp);
  const previewRoute = resolveRoute(new Date("2026-05-24T05:32:00Z"), tmp);
  if (publishRoute.mode !== "auto_publish" || publishRoute.slot !== "evening") throw new Error(`Changed publish time did not route correctly: ${JSON.stringify(publishRoute)}`);
  if (previewRoute.mode !== "preview" || previewRoute.slot !== "evening") throw new Error(`Changed preview time did not route correctly: ${JSON.stringify(previewRoute)}`);

  console.log(JSON.stringify({
    ok: true,
    manual_input: { fact_id: manual.id, date: manual.date || "2026-05-24", priority_slot: manual.priority_slot },
    schedule: unchanged.slots,
    fallback_source_mode: fallbackDraft.source_mode,
    public_publish_called: false,
  }, null, 2));
} catch (error) {
  console.error("Offnote Telegram controls failed:", error);
  process.exit(1);
}
