import fs from "node:fs";
import path from "node:path";

export const KST = "Asia/Seoul";
export const SCHEDULE_PATH = path.join("config", "offnote-schedule.json");
export const DEFAULT_SCHEDULE = Object.freeze({
  timezone: KST,
  slots: Object.freeze({ evening: "15:30", night: "21:30" }),
  preview_lead_minutes: 90,
  health_time: "22:15",
});

export function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

export function normalizeTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`시간은 HH:MM 형식이어야 해: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`유효하지 않은 시간이야: ${value}`);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function timeToMinutes(value) {
  const normalized = normalizeTime(value);
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(value) {
  const minutes = ((Number(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function normalizeSchedule(raw = {}) {
  const slots = raw.slots || {};
  return {
    timezone: KST,
    slots: {
      evening: normalizeTime(slots.evening || DEFAULT_SCHEDULE.slots.evening),
      night: normalizeTime(slots.night || DEFAULT_SCHEDULE.slots.night),
    },
    preview_lead_minutes: Number.isFinite(Number(raw.preview_lead_minutes))
      ? Math.max(15, Math.min(240, Number(raw.preview_lead_minutes)))
      : DEFAULT_SCHEDULE.preview_lead_minutes,
    health_time: normalizeTime(raw.health_time || DEFAULT_SCHEDULE.health_time),
    updated_at: raw.updated_at || "",
    updated_by: raw.updated_by || "",
  };
}

export function loadSchedule(root = process.cwd()) {
  return normalizeSchedule(readJson(path.join(root, SCHEDULE_PATH), DEFAULT_SCHEDULE));
}

export function saveSchedule(root, nextSchedule, metadata = {}) {
  const schedule = normalizeSchedule(nextSchedule);
  const value = {
    ...schedule,
    updated_at: metadata.updated_at || new Date().toISOString(),
    updated_by: metadata.updated_by || "operator",
  };
  const target = path.join(root, SCHEDULE_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return value;
}

export function updateSlotTimes(root, evening, night, metadata = {}) {
  const current = loadSchedule(root);
  const next = {
    ...current,
    slots: {
      evening: normalizeTime(evening),
      night: normalizeTime(night),
    },
  };
  if (timeToMinutes(next.slots.evening) === timeToMinutes(next.slots.night)) {
    throw new Error("두 발행 시간은 서로 달라야 해.");
  }
  return saveSchedule(root, next, metadata);
}

export function formatSchedule(schedule = DEFAULT_SCHEDULE) {
  const normalized = normalizeSchedule(schedule);
  return `오프노트 발행 시간\n1차: ${normalized.slots.evening} KST\n2차: ${normalized.slots.night} KST\n(텔레그램 입력이 없으면 이 시간에 자동 발행)`;
}

export function kstDate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function kstTime(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(input);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function resolveRoute(input = new Date(), root = process.cwd()) {
  const schedule = loadSchedule(root);
  const current = timeToMinutes(kstTime(input));
  const previewWindow = Math.max(15, Math.min(240, schedule.preview_lead_minutes));
  const candidates = [
    { slot: "evening", mode: "auto_publish", time: timeToMinutes(schedule.slots.evening) },
    { slot: "night", mode: "auto_publish", time: timeToMinutes(schedule.slots.night) },
  ];

  for (const candidate of candidates) {
    if (withinFiveMinuteWindow(current, candidate.time)) {
      return { mode: candidate.mode, slot: candidate.slot, schedule };
    }
  }
  for (const candidate of candidates) {
    const previewTime = (candidate.time - previewWindow + 1440) % 1440;
    if (withinFiveMinuteWindow(current, previewTime)) {
      return { mode: "preview", slot: candidate.slot, schedule };
    }
  }
  if (withinFiveMinuteWindow(current, timeToMinutes(schedule.health_time))) {
    return { mode: "health", slot: "night", schedule };
  }
  return { mode: "skip", slot: "evening", schedule };
}

function withinFiveMinuteWindow(current, target) {
  const distance = (current - target + 1440) % 1440;
  return distance >= 0 && distance < 5;
}

export default {
  DEFAULT_SCHEDULE,
  formatSchedule,
  kstDate,
  kstTime,
  loadSchedule,
  minutesToTime,
  normalizeSchedule,
  normalizeTime,
  resolveRoute,
  saveSchedule,
  timeToMinutes,
  updateSlotTimes,
};
