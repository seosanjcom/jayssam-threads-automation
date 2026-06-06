# Blog And CPA Marketing Operations Brief

## Hard Rules

- Every blog account must have at least 5 posts queued per day.
- A shopping/CPA post must not move to publishing unless it has a real affiliate link and the matching disclosure text in the body.
- SUA, AU, and GU are required quality gates on every blog post.
- Placeholder links stay blocked with `status=blocked_cpa_link_required`.
- Threads posts should not simply summarize blog posts. They should open a conversation and put the practical details in replies.

## Daily Mix

For each blog account:

1. Search-answer post
2. Shopping/CPA post
3. Shopping/CPA post
4. Comparison guide
5. Experience/review post

This gives the account enough search coverage while forcing at least two monetization candidates per day.

## CPA Guard

CPA posts require:

- `affiliate_links[]`
- supported `platform`: `coupang` or `naver_shopping_connect`
- real `https://` URL
- matching disclosure text in the body

If any of these is missing, the post remains blocked. This is intentional. A blocked CPA post is better than a cancelled or non-attributed CPA result.

## Quality Gates

- SUA: search intent, user situation, action step.
- AU: authority/proof and useful concrete criteria.
- GU: gain for the reader and next use/action.

## Immediate Marketing Diagnosis

- The previous system had Threads automation, but blog output was not a real 5-post-per-day factory.
- Some prompt and planning files had broken Korean text, so the model could not reliably produce the user's preferred voice.
- CPA links were treated like an afterthought. They must be part of the content type and validation rules.
- Threads engagement is weak because the posts often end as information delivery instead of creating reply depth.

## Next Operating Loop

1. Generate each blog account's 5-post daily queue.
2. Replace placeholder CPA links with approved Coupang or Naver Shopping Connect links.
3. Validate the queue.
4. Publish only posts that pass validation.
5. Convert the strongest blog post into a Threads post with 2-4 information-expansion replies.
