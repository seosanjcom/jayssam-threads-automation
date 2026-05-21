const phase2Start = "2026-05-28";

function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function minutesOfDay(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function hash(value) {
  let out = 0;
  for (const ch of value) out = (out * 31 + ch.charCodeAt(0)) >>> 0;
  return out;
}

function slots(startHour, startMinute, endHour, endMinute) {
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const out = [];
  for (let minute = start; minute <= end; minute += 10) out.push(minute);
  return out;
}

function pickPublishMinute(today, slot) {
  const pool = slot === "evening"
    ? slots(19, 30, 21, 30)
    : slots(12, 10, 13, 40);
  return pool[hash(`${today}-${slot}`) % pool.length];
}

function emit(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
}

const schedule = process.argv[2] || "";
const now = kstNow();
const today = dateText(now);
const current = minutesOfDay(now);

if (schedule === "5 1 * * *") {
  emit({ mode: "metrics", slot: "lunch", run: "true", kst_date: today });
  process.exit(0);
}

const isEveningCandidate = current >= 17 * 60 && current <= 21 * 60 + 40;
const slot = isEveningCandidate ? "evening" : "lunch";

if (slot === "evening" && today < phase2Start) {
  emit({ mode: "noop", slot, run: "false", kst_date: today });
  process.exit(0);
}

const publish = pickPublishMinute(today, slot);
const draft = publish - 130;
const preview1 = publish - 120;
const preview2 = publish - 60;

let mode = "noop";
if (current === draft) mode = "draft";
if (current === preview1 || current === preview2) mode = "preview";
if (current === publish) mode = "publish";

emit({
  mode,
  slot,
  run: mode === "noop" ? "false" : "true",
  kst_date: today,
  publish_minute: String(publish),
});
