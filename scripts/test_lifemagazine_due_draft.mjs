import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { dueSlotForNow, ensureDueDraft } from "./ensure_lifemagazine_due_draft.mjs";

const kst = (clock) => new Date(`2026-08-17T${clock}:00+09:00`);

test("identifies the 11:30 KST slot during its recovery window", () => {
  assert.equal(dueSlotForNow(kst("11:20")).slot.slot, "morning");
  assert.equal(dueSlotForNow(kst("11:55")).slot.slot, "morning");
});

test("identifies the 18:00 KST slot during its recovery window", () => {
  assert.equal(dueSlotForNow(kst("17:40")).slot.slot, "evening");
  assert.equal(dueSlotForNow(kst("18:40")).slot.slot, "evening");
});

test("does not generate a draft outside a due recovery window", async () => {
  let calls = 0;
  const result = await ensureDueDraft({
    root: fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-not-due-")),
    now: kst("14:00"),
    generate: async () => { calls += 1; return { drafts: [] }; },
  });
  assert.equal(result.status, "not_due");
  assert.equal(calls, 0);
});

test("generates exactly one approved draft when the due slot is missing", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-generate-due-"));
  let options;
  const result = await ensureDueDraft({
    root,
    now: kst("11:30"),
    generate: async (input) => {
      options = input;
      return { drafts: [{ id: "LIFE-test-morning" }] };
    },
  });
  assert.equal(result.status, "generated");
  assert.equal(result.slot, "morning");
  assert.deepEqual(options.slots.map((slot) => slot.slot), ["morning"]);
  assert.equal(options.count, 1);
  assert.equal(options.autoApprove, true);
});

test("does not regenerate an existing current-day slot draft", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lifemagazine-existing-due-"));
  const directory = path.join(root, "outputs", "lifemagazine", "automation", "2026-08-17");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "existing.json"), JSON.stringify({
    account: "lifemagazine_",
    date: "2026-08-17",
    slot: "morning",
    status: "approved",
  }));
  let calls = 0;
  const result = await ensureDueDraft({
    root,
    now: kst("11:35"),
    generate: async () => { calls += 1; return { drafts: [] }; },
  });
  assert.equal(result.status, "existing");
  assert.equal(calls, 0);
});
