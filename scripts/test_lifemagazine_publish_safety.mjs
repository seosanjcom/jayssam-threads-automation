import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getLifemagazineSafetySkipReason } from "./publish_lifemagazine_latest_approved.mjs";

const now = new Date("2026-08-19T00:00:00.000Z");

function makeLog(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-publish-safety-"));
  const logPath = path.join(root, "meta-publish-log.json");
  fs.writeFileSync(logPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return logPath;
}

test("daily limit reached is reported as a normal publish skip", () => {
  const logPath = makeLog([
    { account: "lifemagazine_", published_at: "2026-08-18T08:00:00.000Z", draft_id: "a" },
    { account: "lifemagazine_", published_at: "2026-08-18T12:00:00.000Z", draft_id: "b" },
  ]);
  const reason = getLifemagazineSafetySkipReason({ publishLogPath: logPath, now, dailyLimit: 2, minIntervalHours: 5 });
  assert.match(reason, /already has 2 post\(s\) in the last 24h/);
});

test("minimum interval is reported as a normal publish skip", () => {
  const logPath = makeLog([
    { account: "lifemagazine_", published_at: "2026-08-18T22:00:00.000Z", draft_id: "a" },
  ]);
  const reason = getLifemagazineSafetySkipReason({ publishLogPath: logPath, now, dailyLimit: 2, minIntervalHours: 5 });
  assert.match(reason, /Minimum interval=5h/);
});

test("publishing remains allowed when the safety window is clear", () => {
  const logPath = makeLog([
    { account: "lifemagazine_", published_at: "2026-08-17T00:00:00.000Z", draft_id: "old" },
  ]);
  assert.equal(getLifemagazineSafetySkipReason({ publishLogPath: logPath, now, dailyLimit: 2, minIntervalHours: 5 }), "");
});

test("other account posts do not block Lifemagazine", () => {
  const logPath = makeLog([
    { account: "jayssam_edu", published_at: "2026-08-18T22:00:00.000Z", draft_id: "jay" },
    { account: "offnote.kr", published_at: "2026-08-18T23:00:00.000Z", draft_id: "offnote" },
  ]);
  assert.equal(getLifemagazineSafetySkipReason({ publishLogPath: logPath, now, dailyLimit: 2, minIntervalHours: 5 }), "");
});
