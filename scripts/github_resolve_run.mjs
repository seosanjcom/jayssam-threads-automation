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
const graceMinutes = 45;

if (schedule === "5 1 * * *") {
  emit({ mode: "metrics", slot: "lunch", run: "true", kst_date: today });
  process.exit(0);
}

// GitHub의 특정 시각 cron이 지연되는 경우를 위한 보조 예약이다. 정해진 시각이 지난
// 같은 날짜의 슬롯만 재시도하며, 발행기는 이미 발행된 초안과 일일 한도를 다시 검사한다.
if (schedule === "*/10 * * * *") {
  if (current >= 13 * 60 && current < 17 * 60) {
    emit({ mode: "publish", slot: "afternoon", run: "true", kst_date: today, fallback: "true" });
  } else if (current >= 20 * 60) {
    emit({ mode: "publish", slot: "night", run: "true", kst_date: today, fallback: "true" });
  } else {
    emit({ mode: "noop", slot: "afternoon", run: "false", kst_date: today, fallback: "true" });
  }
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

function inWindow(start, width = graceMinutes) {
  return current >= start && current <= start + width;
}

let mode = "noop";
if (inWindow(draft, 50)) mode = "draft";
if (inWindow(preview1, 50) || inWindow(preview2, 50)) mode = "preview";
if (inWindow(publish, 70)) mode = "publish";

emit({
  mode,
  slot,
  run: mode === "noop" ? "false" : "true",
  kst_date: today,
  publish_minute: String(publish),
});
