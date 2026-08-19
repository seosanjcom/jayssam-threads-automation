
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

## Today's all-account schedule table
- [x] Confirm today's KST date and the configured slots for @offnote.kr, @jayssam_edu, and @lifemagazine_.
- [x] Identify the planned topic/draft for every slot.
- [x] Compare each slot with actual workflow and publish logs.
- [x] Mark each row as successful, failed, skipped, upcoming, or not generated.
- [x] Deliver one account-wide table with no unsupported claims.

### Status result: 2026-08-18 07:29 KST
- [x] No 2026-08-18 Threads publish-log entry exists for any of the three accounts at the time of checking.
- [x] Offnote and Jayssam have not generated today's due drafts yet; their early-morning runs completed successfully but skipped the publish steps.
- [x] Lifemagazine's latest run completed successfully with `not_due` and no due approved post.
- [x] Effective Lifemagazine publish crons are 11:30 and 18:00 KST; config metadata still lists 11:30, 16:30, and 21:30 KST, which is documented as a configuration mismatch rather than silently presented as fact.

## Yesterday's repeated automation failures
- [x] Determine the exact KST date meant by “어제” from the current system time: 2026-08-18 KST.
- [x] List all failed and successful workflow runs for @offnote.kr, @jayssam_edu, and @lifemagazine_.
- [x] Group failures by step and compare identical error messages.
- [x] Distinguish workflow failure, skipped publish, missing draft/approval, and Threads API failure.
- [x] Inspect the actual publish logs and media IDs for the affected date.
- [x] Fix any still-active root cause and add regression coverage.
- [x] Re-run safe remote validation and report the verified result: workflow run 32215694567 on `520a812` completed successfully; publish step logged a normal safety skip.

### Confirmed finding: 2026-08-18 KST
- [x] Offnote failures: 0; Jayssam failures: 0.
- [x] Lifemagazine failures: 13; all were local safety-gate exits, not Threads Graph API errors.
- [x] Twelve failures hit `already has 2 post(s) in the last 24h. Limit=2`; one hit `last post was 0.75h ago. Minimum interval=5h`.
- [x] Root cause: the wrapper selected a due approved draft and invoked the shared publisher even when the account was already inside its local safety window, causing expected protection to appear as workflow failure every 10 minutes.
- [x] Fix: preflight the same safety window in the Lifemagazine wrapper, log a normal skip, exit 0, and align metadata with the effective 11:30/18:00 KST and 2-post/5-hour policy.
- [x] Local related regression suite: 61 passed, 0 failed.

## Today's all-account workflow and schedule recheck: 2026-08-19 KST
- [x] Collect today's GitHub Actions runs for Offnote, Jayssam, and Lifemagazine.
- [x] Inspect each latest run's conclusion and publish-stage log.
- [x] Reconcile configured KST slots with today's draft and publish logs.
- [x] Distinguish published, normal safety skip, not due, failed, and upcoming slots.
- [x] Report today's account-wide schedule table with exact timestamps and uncertainty notes.

### Confirmed result: 2026-08-19 13:37 KST
- [x] Offnote latest scheduled run 32214631469 at 13:08 KST: success; route `mode=skip`, evening slot 15:30 KST not due yet; no today publish-log entry.
- [x] Jayssam latest scheduled run 32215782582 at 13:26 KST: success; afternoon draft was generated and Telegram preview sent; publish step was skipped before the 15:00 KST slot; no today publish-log entry.
- [x] Lifemagazine morning slot: published at 12:24:48 KST with media ID `18239611249313902`; latest safety-preflight validation run 32215694567 at 13:25 KST succeeded with a normal safety skip; evening slot 18:00 KST remains upcoming.
- [x] One Lifemagazine scheduled failure at 13:05 KST was on pre-fix SHA `39719e6`, not the current safety-skip fix; latest master validation is successful on `520a812`.

## Lifemagazine product ranking verification: 2026-08-19 KST
- [x] Trace the selected Double A copy-paper product back to its candidate source and selection score.
- [x] Verify whether the automatic candidate source contains real best-seller or sales-ranking evidence.
- [x] Compare the published product with the configured category, duplicate, quality, and ranking rules.
- [x] Report whether the product was genuinely ranked or merely selected as a safe candidate.
- [x] If ranking evidence is missing, define and implement a safer evidence threshold before future auto-selection.

## Lifemagazine evidence-led product storytelling: 2026-08-19 KST
- [x] Identify which real product signals are available from the Coupang Partners API and existing draft history.
- [x] Define evidence-backed hooks such as category rank, current price, price-change history, review volume, package quantity, or timing; never infer unavailable signals.
- [x] Store the evidence and chosen hook with each candidate so the draft can explain why this product is worth noticing now.
- [x] Block auto-publish when the product has no concrete evidence-backed hook or when body, metadata, and affiliate link describe different products.
- [x] Add regression tests and produce one truthful sample for an ordinary product.

## Lifemagazine implementation of evidence-led storytelling and consistency guard: 2026-08-19 KST
- [x] Implement evidence-led product storytelling in `generate_lifemagazine_draft.mjs` using verified rank, price, brand, and category signals.
- [x] Implement strict name/category consistency check in `validate_lifemagazine_draft.mjs` to block mismatch between draft topic and product metadata.
- [x] Create regression test suite for evidence-led storytelling and mismatch blocking (63 tests passing).
- [x] Run test suite, verify clean exit, and push changes to remote master.

## Coupang price-trend and cross-account metrics review: 2026-08-19 KST
- [x] Inventory recent Coupang product records, draft metadata, and any stored historical prices: 46 records, 22 product groups.
- [x] Determine whether true price-change trends can be calculated or whether only point-in-time prices exist: no product had more than one distinct stored price; true trend cannot be calculated.
- [x] Assess suitable evidence signals for Offnote and Jayssam without turning them into shopping accounts.
- [x] Compare persona-safe storytelling examples and identify what would require new data collection.
- [x] Report findings, limitations, and recommended next implementation scope.

## Offnote/Jayssam collaboration fit review: 2026-08-19 KST
- [x] Map each account's actual audience promise and collaboration assets.
- [x] Identify realistic inbound collaboration categories and required proof points.
- [x] Separate strong-fit, conditional-fit, and poor-fit proposals for each account.
- [x] Define media-kit, profile, contact, and sample-content preparation needs.
- [x] Report the realistic collaboration outlook without guaranteeing inbound offers.

## Account pivot for inbound collaboration (Offnote & Jayssam): 2026-08-19 KST
- [x] Define Offnote's pivot to service/agency client work + SaaS/tech gear partnerships.
- [x] Define Jayssam's pivot from abstract teaching commentary to actionable instructor-brand/platform partnership style.
- [x] Update structural posting templates and guidelines for both accounts.
- [x] Report the revised strategy and how automation will produce these collaboration-ready posts.

## Revised collaboration positioning (Offnote & Jayssam): 2026-08-19 KST
- [x] Broaden Offnote from automation-only to versatile digital execution (content, design, web, AI, SNS operations) + client service/agency inbound.
- [x] Redesign Jayssam's review/partnership style to reflect an authentic instructor testing a tool or platform in class without salesy language ("수업자료에 넣어야겠다" 금지).
- [x] Draft exact sample threads matching the refined tones for both accounts.
- [x] Confirm alignment with user expectations.

## Client-case and Jayssam accuracy correction: 2026-08-19 KST
- [x] Search stored notes and content inputs for the interior-company client case, actual changes, and client feedback.
- [x] Separate verified facts from details that require the user's confirmation before writing the story.
- [x] Replace the technically incorrect Excel sentence with a real, natural classroom problem.
- [x] Draft corrected Offnote and Jayssam samples and request only missing facts if needed.

## Narrative storytelling and high-value instructor partnership (Offnote & Jayssam): 2026-08-19 KST
- [x] Rewrite Offnote samples into compelling client-agency narratives showing before/after relief and genuine gratitude.
- [x] Redesign Jayssam from basic teaching tips to high-impact curriculum, software testbed, and platform partnership storytelling.
- [x] Ensure both styles naturally attract high-ticket inbound offers without looking salesy.
- [x] Finalize account positioning rules for automated generation.

## Diversified Offnote narratives & Jayssam 3 specific collaboration topics: 2026-08-19 KST
- [x] Establish distinct narrative angles for Offnote (e.g., Craft workshop structural clarity vs. Interior visual storytelling vs. Local café operational routines).
- [x] Draft a non-repetitive workshop/café case story for Offnote.
- [x] Formulate 3 specific, platform/tool-partnership-friendly content topics for Jayssam without sales fluff.
- [x] Review tone, natural expression, and alignment.

## Offnote rotation pool & Jayssam tone correction: 2026-08-19 KST
- [x] Keep existing Offnote evergreen observations and actual work logs, adding client narrative pools to the random rotation.
- [x] Rewrite Jayssam's topics into punchy, realistic instructor scenes (no boring lecture notes).
- [x] Update generation scripts/fixtures and run regression suite.

## Real revenue streams & Jayssam tone reset: 2026-08-19 KST
- [x] Inventory Offnote's actual agency services, digital product sales, affiliate/partnership income, and content ops.
- [x] Build a flexible story-source generator that varies by business type instead of hardcoding 3 industries.
- [x] Discard Jayssam's current unsatisfactory voice and analyze user-provided samples or establish a clean instructor tone.
- [x] Request user confirmation on actual service lines and Jayssam's authentic tone preferences.

## 20 Offnote business models & Jayssam collaboration personas: 2026-08-19 KST
- [x] Compile 20 distinct digital nomad business/work models for Offnote spanning agency, digital products, content, curation, and micro-services.
- [x] Formulate 4 distinct collaboration personas for Jayssam (e.g., Practical Software Tester, Corporate Skill Consultant, Solo-preneur Instructor, Educational Content Creator).
- [x] Present both lists clearly for user selection.

## Finalized Offnote portfolio & Jayssam B-centric persona: 2026-08-19 KST
- [x] Structure Offnote's full service/content/ad/affiliate lines into an inbound funnel that naturally converts clients and leads to upcoming online courses.
- [x] Define Jayssam's core persona around practical skill consulting (B) supported by tool testing (A), solo-preneur mentoring (C), and master instruction (D).
- [x] Ensure generation prompts use concrete, granular situations without generic fluff.

## Portfolio draft & Jayssam B-axis sample & 3-step funnel: 2026-08-19 KST
- [x] Write Offnote portfolio sample draft (Website/Place setup or digital product).
- [x] Write Jayssam B-axis sample draft (Practical skill consulting in action).
- [x] Design 3 specific Offnote content pieces leading naturally into future online courses.
- [x] Report draft and funnel plan clearly to the user.

## Jayssam 30s-female warm conversational tone implementation: 2026-08-19 KST
- [x] Update Jayssam's generation templates and practical tips in `generate_jayssam_daily_post.py` to use a warm, conversational 30s female instructor tone (`ㅎㅎ`, `ㅠㅠ`, `있거든`, `그런 거지`, `~해`, `알려줘~!`).
- [x] Block authoritarian or textbook endings (`찾아라`, `외워라`, `백배`, `당연하다`, `~해야 한다`) in Jayssam generator and quality test.
- [x] Run full test suite including content quality guards and verify clean execution.
- [x] Commit and push changes to remote master so upcoming automatic runs use the new tone immediately.
