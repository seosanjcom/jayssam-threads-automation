
## Telegram manual input and schedule controls
- [ ] Run a dry-run urgent Offnote Telegram manual-input test without publishing publicly.
- [ ] Parse Telegram manual input into outputs/afterwork-profit/offnote-daily-facts/ with priority for the next available slot.
- [ ] Add Telegram commands to view and change the two Offnote publish times.
- [ ] Persist schedule settings safely and make the scheduled workflow read them at runtime.
- [ ] Keep automatic two-post fallback active when no Telegram input exists.
- [ ] Add regression coverage and run the full test suite before commit/push.
- [ ] Document the Telegram commands and current schedule in the final response.

## Schedule implementation notes
- [ ] Reconcile workflow cron, runtime schedule configuration, and Telegram notice labels so displayed and actual times stay consistent.
- [ ] Confirm KST handling and reject invalid/unsafe time inputs.
- [ ] Verify live GitHub Actions/Telegram secrets and environment before any real publish test.

## Decisions to confirm during implementation
- [ ] Telegram manual input is an optional priority source, not a prerequisite for automatic publishing.
- [ ] Test mode must not call the Threads publish API or create a public post.
- [ ] Schedule changes affect future runs only and must not retroactively publish a missed slot.

## Related implementation files
- [ ] scripts/telegram_check_offnote_approvals.mjs
- [ ] scripts/prepare_offnote_daily_facts.mjs
- [ ] scripts/generate_offnote_daily_post.mjs
- [ ] scripts/publish_offnote_due.mjs
- [ ] scripts/send_offnote_auto_publish_notice.mjs
- [ ] .github/workflows/offnote-threads-automation.yml
- [ ] config/threads-accounts.json

## Change log
- [ ] Record implementation commit SHA and test results here.
- [ ] Record the final Telegram command syntax here.

## Do not do
- [ ] Do not paste API keys, bot tokens, client secrets, or private chat identifiers into drafts, logs, commits, or this todo file.
- [ ] Do not force-push or rewrite remote history.
- [ ] Do not run a real public-post test without explicit confirmation.

## End state
- [ ] Telegram message -> next-slot priority fact.
- [ ] No message -> two automatic Offnote posts every day.
- [ ] Telegram schedule command -> safe future schedule update.
- [ ] Telegram status command -> current schedule and source shown.
- [ ] Invalid command -> no schedule change and a clear Telegram reply.

## Status
- [ ] Work in progress.
- [ ] Awaiting validation.
- [ ] Completed.

## Immediate Telegram validation run
- [ ] Run an urgent manual-input dry-run without calling the Threads publish API.
- [ ] Verify a valid manual message is stored as the next-slot priority input.
- [ ] Verify inputs shorter than 8 characters are rejected.
- [ ] Verify inputs longer than 500 characters are rejected.
- [ ] Verify product, affiliate, and link-like inputs are rejected.
- [ ] Verify `/시간` returns the current two-slot schedule.
- [ ] Verify `/시간 HH:MM HH:MM` persists a valid schedule change.
- [ ] Verify invalid or equal times do not change the stored schedule.
- [ ] Report the exact results and easy Telegram examples.

## Live status follow-up: Resolve mode failure
- [ ] Fix the CLI entry-point detection in scripts/offnote_schedule.mjs so direct execution always prints mode and slot.
- [ ] Add a deterministic regression test for `node scripts/offnote_schedule.mjs` CLI output.
- [ ] Re-run Offnote guard, Telegram controls, and full 52-test suite.
- [ ] Push the routing fix to master without including unrelated temporary files.
- [ ] Confirm a post-fix GitHub Actions run passes Resolve mode and report today's actual status honestly.

## Latest automatic-publish error investigation
- [x] Inspect the newest GitHub Actions runs and identify any failed jobs or steps.
- [x] Inspect failure logs and correlate each failure with the exact workflow commit and stage.
- [x] Fix every confirmed error without masking real publish failures.
- [x] Run Offnote-specific guards, Telegram controls, CLI route checks, and the full 52-test suite.
- [x] Trigger a safe remote validation run and verify the result on the latest master SHA.
- [x] Report whether there were errors, why they happened, what was changed, and any remaining uncertainty.

### Latest confirmed result
- [x] Six scheduled runs on 2026-08-17 failed at Resolve mode because the schedule CLI emitted no mode/slot lines.
- [x] Restored direct CLI output and added a regression test.
- [x] Safe health-mode run 32021471303 passed on master SHA 9519480.

## Today's Offnote publishing status check
- [x] Read the current KST schedule and determine which slots remain today.
- [x] List today's generated drafts and their planned publish times.
- [x] Compare GitHub Actions runs with the publish log and draft status.
- [x] Distinguish scheduled, skipped, failed, successfully published, and remaining items.
- [x] Report the results in a concise table with exact timestamps and uncertainty notes.

### Status result: 2026-08-17 20:50 KST
- [x] 15:30 KST evening draft existed but no 2026-08-17 publish record was found; the slot was blocked while Resolve mode failures were active.
- [x] 21:30 KST night slot remains upcoming; no night draft exists yet in the local checkout because the 20:00 preview window did not receive a matching scheduled run.
- [x] Latest Offnote scheduled run 32025937011 at 20:38 KST passed and skipped normally outside the 5-minute route window.

## All Threads accounts daily status check
- [x] Check @offnote.kr today’s schedule, drafts, publish log, and remaining slot.
- [x] Check @jayssam_edu today’s schedule, drafts, publish log, and remaining slot.
- [x] Check @lifemagazine_ today’s schedule, drafts, publish log, and remaining slot.
- [x] Compare scheduled workflows and account-specific automation runs.
- [x] Report whether each account has published zero, one, or two posts today.
- [x] Clearly distinguish missed, failed, skipped, upcoming, and successful posts.

### Account-wide status result: 2026-08-17 21:10 KST
- [x] @offnote.kr: 15:30 slot missed during Resolve mode failures; 21:30 slot still upcoming; no today publish-log entry.
- [x] @jayssam_edu: no scheduled run and no today draft/publish-log entry; today’s 15:00 and 21:00 default slots were not completed.
- [x] @lifemagazine_: scheduled runs succeeded but latest publish step reported no due approved post; no today draft/publish-log entry; today’s slots were not completed.

## Reinvestigate all-account publishing failures
- [ ] Reconstruct @offnote.kr: route, draft creation, due-publish, publish log, and slot timing.
- [ ] Reconstruct @jayssam_edu: scheduled trigger, route mode, draft generation, publish step, and publish log.
- [ ] Reconstruct @lifemagazine_: scheduled trigger, approval/due-draft lookup, publish step, and publish log.
- [ ] Separate workflow failure, intentional skip, missing draft, missing approval, and actual Threads API failure.
- [ ] Verify whether schedule timing and GitHub schedule delays can create missed preview windows.
- [ ] Implement a no-slot-left-behind recovery path without bypassing safety or approval rules.
- [ ] Add observability so every account/slot records route, draft ID, publish attempt, skip reason, or error.
- [ ] Add regression tests for all three account failure paths and recovery behavior.
- [ ] Run remote dry-run/health validation and confirm no new failures.
- [ ] Report the verified root causes without claiming success where no public post occurred.

## Workflow registration mismatch discovered after push
- [x] Confirm GitHub API still reports the old Jayssam workflow without workflow_dispatch after BOM removal.
- [x] Force a clean workflow registration by renaming the Jayssam workflow file and updating account metadata references.
- [x] Preserve the same workflow name, 15:00/21:00 routing, and preview-only validation path.
- [x] Push the registration fix and verify GitHub exposes workflow_dispatch for the new workflow ID.
- [x] Run the new Jayssam workflow in preview mode and confirm jobs/steps complete.
- [ ] Check new scheduled runs and ensure old invalid registration no longer creates failures.

### Additional parser findings
- [x] Removed two U+0080 control characters from a mojibake comment at line 172; local YAML parsing then exposed the next error.
- [x] Replaced the empty `Watch publish status` step at line 181 with a valid disabled `run` step.
- [x] GitHub preview run `32030704604` completed successfully with Resolve mode, validation, and Telegram preview steps passing.

## Dispatch registration still unresolved
- [x] Investigate why GitHub API returned HTTP 422 for workflow_dispatch even though the raw YAML and new workflow ID showed the trigger block.
- [x] Compare the new workflow trigger shape with the working Offnote workflow and run local YAML parsing.
- [x] Use GitHub workflow metadata/check APIs and the UI to distinguish parser failure from repository policy failure.
- [x] A remote preview run now creates a real job and passes; scheduled execution is still pending separate confirmation.

## Schedule trigger isolation probe
- [x] Add a temporary minimal schedule-only workflow to distinguish repository scheduler issues from the Jayssam job definition.
- [x] Observe a real scheduled tick through Jayssam run `32035181306`; the repository scheduler is functioning, while the newly-added probe had zero runs before removal.
- [ ] Remove the probe after diagnosis so it cannot create duplicate automation.

## GitHub sudo reauthentication blocker
- [x] Wait for the user to complete the GitHub sudo confirmation using their account's normal authentication method.
- [x] Resume the waiting CLI session only after the user confirms authentication completion.
- [x] Re-check remote probe and Jayssam schedule runs after GitHub CLI authentication is restored.
