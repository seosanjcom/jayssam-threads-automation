import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { resolveJayssamRoute } from "./github_resolve_run.mjs";

const kst = (clock) => new Date(`2026-08-17T${clock}:00+09:00`);

test("metrics schedule remains available", () => {
  assert.deepEqual(resolveJayssamRoute({ schedule: "5 1 * * *", now: kst("10:05") }), {
    mode: "metrics",
    slot: "lunch",
    run: "true",
    kst_date: "2026-08-17",
  });
});

test("ten-minute route creates the afternoon draft before 15:00 KST", () => {
  const result = resolveJayssamRoute({ schedule: "*/10 * * * *", now: kst("12:30") });
  assert.equal(result.mode, "draft");
  assert.equal(result.slot, "afternoon");
  assert.equal(result.run, "true");
});

test("ten-minute route publishes the afternoon slot at 15:00 KST", () => {
  const result = resolveJayssamRoute({ schedule: "*/10 * * * *", now: kst("15:00") });
  assert.equal(result.mode, "publish");
  assert.equal(result.slot, "afternoon");
  assert.equal(result.run, "true");
});

test("ten-minute route publishes the night slot at 21:00 KST", () => {
  const result = resolveJayssamRoute({ schedule: "*/10 * * * *", now: kst("21:00") });
  assert.equal(result.mode, "publish");
  assert.equal(result.slot, "night");
  assert.equal(result.run, "true");
});

test("late cadence tick recovers a slot but never publishes before it is due", () => {
  const before = resolveJayssamRoute({ schedule: "*/10 * * * *", now: kst("14:50") });
  const after = resolveJayssamRoute({ schedule: "*/10 * * * *", now: kst("15:20") });
  assert.equal(before.run, "false");
  assert.equal(after.mode, "publish");
  assert.equal(after.slot, "afternoon");
  assert.equal(after.fallback, "true");
});

test("direct CLI emits workflow outputs for the cadence route", () => {
  const output = execFileSync("node", ["scripts/github_resolve_run.mjs", "*/10 * * * *"], {
    encoding: "utf8",
    env: { ...process.env, JAYSSAM_ROUTER_NOW: "2026-08-17T06:00:00.000Z" },
  });
  assert.match(output, /mode=publish/);
  assert.match(output, /slot=afternoon/);
  assert.match(output, /run=true/);
});

test("unknown schedules are explicit no-ops", () => {
  const result = resolveJayssamRoute({ schedule: "unknown", now: kst("15:00") });
  assert.equal(result.mode, "noop");
  assert.equal(result.run, "false");
});
