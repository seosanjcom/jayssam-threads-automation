
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
