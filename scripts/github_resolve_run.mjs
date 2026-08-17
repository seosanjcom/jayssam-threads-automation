import path from "node:path";
import { pathToFileURL } from "node:url";

const KST_OFFSET_HOURS = 9;
const SLOT_CONFIG = {
  afternoon: { publishMinute: 15 * 60, label: "15:00 KST" },
  night: { publishMinute: 21 * 60, label: "21:00 KST" },
};
const RECOVERY_AFTER_MINUTES = 60;

function kstNow(input = new Date()) {
  return new Date(new Date(input).getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function minutesOfDay(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function inWindow(current, start, width = 10) {
  return current >= start && current < start + width;
}

function emit(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
}

function routeForSlot(current, slot) {
  const config = SLOT_CONFIG[slot];
  const publishMinute = config.publishMinute;

  // The ten-minute GitHub schedule can arrive late. Publish only at the due
  // time or in a short recovery window after it, never before the slot.
  if (inWindow(current, publishMinute, RECOVERY_AFTER_MINUTES)) {
    return { mode: "publish", slot, fallback: current >= publishMinute + 10 ? "true" : "false" };
  }

  // Create a draft roughly two and a half hours before publishing, then send
  // a preview in the final two hours. A later tick can still recover either.
  if (inWindow(current, publishMinute - 150, 20)) {
    return { mode: "draft", slot, fallback: "true" };
  }
  if (inWindow(current, publishMinute - 120, 30)) {
    return { mode: "preview", slot, fallback: "true" };
  }

  return null;
}

export function resolveJayssamRoute({ schedule = "", now = new Date() } = {}) {
  const currentDate = kstNow(now);
  const today = dateText(currentDate);
  const current = minutesOfDay(currentDate);

  if (schedule === "5 1 * * *") {
    return { mode: "metrics", slot: "lunch", run: "true", kst_date: today };
  }

  // Fixed historical cron strings are accepted for one transition window so
  // an already queued GitHub event cannot be lost during deployment.
  const legacyRoutes = {
    "30 1 * * *": { mode: "preview", slot: "afternoon" },
    "0 4 * * *": { mode: "publish", slot: "afternoon" },
    "0 8 * * *": { mode: "preview", slot: "night" },
    "0 11 * * *": { mode: "publish", slot: "night" },
  };
  if (legacyRoutes[schedule]) {
    return { ...legacyRoutes[schedule], run: "true", kst_date: today, fallback: "legacy" };
  }

  if (schedule === "*/10 * * * *") {
    for (const slot of ["afternoon", "night"]) {
      const route = routeForSlot(current, slot);
      if (route) return { ...route, run: "true", kst_date: today };
    }
  }

  return { mode: "noop", slot: "afternoon", run: "false", kst_date: today };
}

const isDirectExecution = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  emit(resolveJayssamRoute({
    schedule: process.argv[2] || "",
    now: process.env.JAYSSAM_ROUTER_NOW || new Date(),
  }));
}
