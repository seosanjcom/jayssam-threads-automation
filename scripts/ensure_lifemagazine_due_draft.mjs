import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DAILY_PRODUCT_SLOTS,
  generateDailyProductDraftsAndPreview,
} from "./generate_lifemagazine_product_daily.mjs";

const KST = "Asia/Seoul";
const RECOVERY_BEFORE_MINUTES = 40;
const RECOVERY_AFTER_MINUTES = 60;

function kstDateAndMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function slotMinutes(slot) {
  const [hour, minute] = String(slot.time).split(":").map(Number);
  return hour * 60 + minute;
}

export function dueSlotForNow(now = new Date(), slots = DAILY_PRODUCT_SLOTS) {
  const current = kstDateAndMinutes(now);
  const due = slots.find((slot) => {
    const delta = current.minutes - slotMinutes(slot);
    return delta >= -RECOVERY_BEFORE_MINUTES && delta < RECOVERY_AFTER_MINUTES;
  });
  return due ? { date: current.date, slot: due, minutes: current.minutes } : null;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function hasCurrentSlotDraft(root, date, slotName) {
  const directory = path.join(root, "outputs", "lifemagazine", "automation", date);
  if (!fs.existsSync(directory)) return false;
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .some((name) => {
      const data = readJson(path.join(directory, name));
      return data
        && data.account === "lifemagazine_"
        && String(data.date || data.draft_date) === date
        && data.slot === slotName
        && !String(data.status || "").startsWith("deleted_");
    });
}

export async function ensureDueDraft({
  root = process.cwd(),
  now = new Date(),
  generate = generateDailyProductDraftsAndPreview,
} = {}) {
  const due = dueSlotForNow(now);
  if (!due) return { status: "not_due", date: kstDateAndMinutes(now).date };

  if (hasCurrentSlotDraft(root, due.date, due.slot.slot)) {
    return { status: "existing", date: due.date, slot: due.slot.slot };
  }

  const result = await generate({
    root,
    date: due.date,
    slots: [due.slot],
    count: 1,
    autoApprove: true,
    sendAutoNotice: true,
  });
  return {
    status: "generated",
    date: due.date,
    slot: due.slot.slot,
    ids: result.drafts.map((draft) => draft.id),
  };
}

const isDirectRun = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const result = await ensureDueDraft();
  console.log(JSON.stringify(result, null, 2));
}
