# 2026-08-17 Threads account failure findings

검사 시각: 2026-08-17 21:10 KST. 저장소: https://github.com/seosanjcom/jayssam-threads-automation

## Observed facts

- Offnote scheduled runs 32000108492, 32004765347, 32008344560, 32012531784, 32015778198, and 32018594391 all failed at `Resolve mode`. Their logs showed `node scripts/offnote_schedule.mjs` emitted no `mode=` or `slot=` lines. The direct CLI entry point had been missing. A later health run 32021471303 passed after the CLI output fix.
- Offnote had a committed 2026-08-17 evening draft `OFFNOTE-20260817-evening-sns-cardnews-schedule.json` with recommended time 15:30 KST, but `outputs/afterwork-profit/meta-publish-log.json` had no 2026-08-17 entry. The 21:30 KST slot was still upcoming at the inspection time. A temp-only generation predicted `OFFNOTE-20260817-night-online-lecture-chapter.json`; it was not yet a committed/public draft at inspection time.
- Jayssam had no scheduled workflow run on 2026-08-17. The latest scheduled run in the workflow history was 2026-08-14; today’s entries were push-triggered failures with no jobs. `gh workflow run jayssam-threads-automation.yml ...` returned HTTP 422: Workflow does not have `workflow_dispatch` trigger, despite the repository file visibly containing `workflow_dispatch` and `schedule`.
- Jayssam’s local/remote `outputs/meta-publish-log.json` had no 2026-08-17 entry and no `outputs/automation/2026-08-17` draft path. `config/threads-accounts.json` says default slots 15:00 and 21:00 KST, while the workflow comments/fixed routes still describe 13:00 and 20:00 KST.
- Lifemagazine scheduled runs on 2026-08-17 completed successfully, but the latest `Publish latest approved` log (run 32027698794) said `No due approved lifemagazine_ Threads post found.` Its publish log had no 2026-08-17 entry and no committed 2026-08-17 draft path. Therefore workflow success did not mean a public post occurred.
- The three workflow files have different first bytes: Jayssam begins with UTF-8 BOM `ef bb bf`; Offnote and Lifemagazine begin with ASCII `name` bytes `6e 61 6d`. This is a plausible cause of the GitHub trigger registration mismatch and should be removed from Jayssam before revalidating triggers.

## Likely root causes to verify/fix

1. Offnote: missing direct CLI output, already fixed; keep regression coverage.
2. Jayssam: trigger registration/runtime mismatch (BOM/encoding and possibly stale workflow registration), no scheduled runs after 2026-08-14, plus configured slot mismatch (15:00/21:00 vs workflow 13:00/20:00). Remove BOM, align routes with config, and add a schedule-tick/recovery path.
3. Lifemagazine: scheduled job success with no due approved draft; the workflow needs a pre-slot automatic draft preparation/recovery path or an explicit observable hold. Do not count a successful job as a successful post.

## Important safety note

Do not fabricate a public post or bypass approval/media/safety gates merely to make the dashboard green. A recovery path must generate/validate the correct account draft, then publish only when the account’s normal approval and due checks pass.
