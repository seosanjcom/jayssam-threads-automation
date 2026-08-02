# Lifemagazine Coupang Product Threads Automation Design

Date: 2026-08-02
Account: `lifemagazine_`
Status: Design approved for spec writing; implementation not started.

## Goal

Automate `lifemagazine_` Threads posts for Coupang affiliate products, three posts per day, with copy that feels like a real person found or used a practical item rather than a generic ad.

The system must:

- Select product candidates from Coupang Partners/Open API where possible.
- Generate three daily product-led Threads drafts.
- Use a natural Korean first-person tone calibrated from the operator's edits.
- Keep the main post readable and non-ad-like.
- Put the Coupang Partners disclosure in a comment/reply whenever a Coupang affiliate link is included.
- Prefer casual phone-camera-style lifestyle images generated from safe product references; avoid raw webpage image scraping as the default.

## Current project context

The repo already has a `lifemagazine_` route:

- `config/threads-accounts.json` defines `lifemagazine` with output roots and workflow metadata.
- `.github/workflows/lifemagazine-threads-automation.yml` currently runs Lifemagazine approval checks and publishing.
- `scripts/generate_lifemagazine_draft.mjs` creates Lifemagazine drafts with `product_links`, `media_urls`, and affiliate metadata.
- `scripts/validate_lifemagazine_draft.mjs` currently requires the affiliate disclosure at the beginning of `threads_text` when `product_links` exist.
- `scripts/threads_publish.mjs` can publish image URLs and has a Lifemagazine safety stop for local images without public `media_urls`.
- `scripts/publish_lifemagazine_latest_approved.mjs` verifies public media URLs before publishing.
- `scripts/threads_studio_server.mjs` already supports Lifemagazine manual drafts, uploaded local media, product links, validation, and Telegram preview.

This design extends the existing Lifemagazine path rather than creating a separate system.

## Recommended approach

Use a product-candidate pipeline plus a tone/scene drafting layer.

1. Coupang product candidate collection
   - Query Coupang product APIs using configured category/search terms.
   - Store normalized candidates with product name, price if available, product URL, affiliate URL, image URL, ranking fields, and source timestamp.
   - Use API-provided image URLs when available.
   - Do not use raw Coupang HTML image scraping by default.

2. Product selection
   - Pick products that are easy to explain through a real-life situation.
   - Favor practical, low-friction products: storage, household consumables, hair/accessory items, beauty basics, small convenience items, seasonal daily-use products.
   - Avoid products that require medical, safety, financial, or strong performance claims.
   - Avoid repeating the same product type too often.

3. Scene-first copy generation
   - Before writing, generate a concrete "생활 장면" and target reader.
   - The copy should answer:
     - Who is this for?
     - What tiny daily annoyance does it solve?
     - Why would the writer care enough to mention it?
     - What is the honest tradeoff or limit?
   - The product should appear because the scene needs it, not because the post is trying to sell it.

4. Approval-first publishing
   - Start with Telegram preview/approval for generated drafts.
   - Publish only approved drafts at first.
   - After enough user-edited samples are collected and validation is stable, the system can be switched to fuller automation.

## Tone design

The tone should be natural, specific, and lightly messy in the way a person actually writes.

User-provided style signals:

- "머리끈 맨날 잃어버리는 사람 나와봐.."
- "이거 이가격이면 대용량 집에 꼭 사둬야함."
- "나 이거 찾았다 대박 .."
- "예쁜데 손이 안 가면 결국 짐 되고, 매일 쓰면 그게 진짜 잘 산 템이지~~"
- Casual endings such as `ㅋㅋㅋ`, `ㄹㅇ`, `!!`, `~~` are allowed, but should not appear mechanically.

Rules:

- Do not use one fixed hook template.
- Do not use one fixed CTA template.
- Do not rotate from a small obvious list of hooks/endings.
- Generate the hook from the selected scene.
- The main post should feel like a small personal note, not a sales page.
- Product value should be concrete: "잃어버림 줄임", "쟁여두기 편함", "책상 위 굴러다니는 것 정리", "가방 안에서 바로 찾음".
- Avoid vague praise like "좋아요", "추천해요", "가성비 최고" unless the sentence explains the actual situation.
- Avoid over-ad wording such as "무조건", "역대급", "핫딜", "구매각", "품절대란", "인생템" unless manually approved.

Default stance:

- If the product was actually used by the operator, the draft may use a true "찐사용기" framing.
- If the product is sourced from Coupang API and has not been personally used, use a "찾았다 / 이런 상황이면 괜찮겠다 / 쟁여두기 좋아 보이는" framing.
- The system must not falsely state "직접 써봤다" unless an input flag marks the product as actually used.

## Post structure

Main Threads post:

- No affiliate link in the main body.
- No disclosure at the top of the main body.
- 250-500 Korean characters target.
- One specific hook, one real-life situation, one product reason, one light tradeoff or honest note, one natural ending.
- The ending should vary naturally and not always ask the reader to buy or click.

Comment/reply:

- Contains the Coupang affiliate link.
- Contains the required disclosure text exactly:

`이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`

- May include a short natural line before the disclosure, but the disclosure must always be present when a Coupang product link exists.

Example comment shape:

```text
제품 링크는 여기 둘게!
https://...

이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
```

## Image policy

Preferred visual strategy:

1. Casual phone-camera-style lifestyle image generated from a safe product reference.
2. Coupang API-provided product image URL used directly when visual fidelity matters.
3. Simple text-free fallback card only when a lifestyle image cannot be generated safely.
4. Text-only post if no safe image path is available.

The default visual should look like the operator placed the item on a real desk, vanity, shelf, or kitchen counter and quickly took a phone photo. It should not look like a designed cardnews asset, studio product shoot, influencer flat lay, or ad banner.

### Phone-camera lifestyle image direction

The image generation prompt should build a realistic everyday scene:

- Ordinary Korean home surface such as a desk, vanity, drawer, bathroom shelf, kitchen counter, or bedside table.
- Slightly imperfect phone-camera framing.
- Natural side light, mild grain, normal shadows, and small real-life clutter.
- Product placed casually, not perfectly centered.
- No text overlays and no promotional visual language.

The image should be used to make the post feel like a personal note, not to make a formal product advertisement.

### AI-looking artifact prevention

Generated lifestyle images must avoid elements that commonly reveal AI generation:

- No hands, fingers, arms, faces, or body parts.
- No paper, receipts, books, notebooks, sticky notes, labels, shipping boxes, or screens with readable text.
- No Korean text, English text, numbers, QR codes, price tags, discount badges, logos, or brand marks.
- No mirrors or reflective surfaces that may create distorted duplicates.
- No complex transparent glassware unless it is necessary and manually approved.
- No product packaging with readable writing.
- No messy piles where object boundaries become confusing.
- No fake app UI, phone screen content, or browser content.

Safe background clutter examples:

- Plain charging cable.
- Unbranded lip balm with no readable text.
- Simple hair clip.
- Plain pouch.
- Neutral tray.
- Small ceramic cup with no logo.
- Folded cloth with no pattern text.

Every generated image must be reviewed before publishing during the initial phase. If the image has distorted objects, fake text, brand-like marks, or an inaccurate product appearance, the draft must be held or regenerated.

### Product image fidelity rules

The lifestyle image may be AI-generated when the product is generic and shape/brand fidelity is not critical:

- Hair ties.
- Storage bins.
- Pouches.
- Cable organizers.
- Cleaning cloths.
- Basic household consumables.
- Simple beauty tools without brand-specific packaging.

Use the Coupang API product image directly, or hold for manual review, when exact appearance matters:

- Cosmetics with specific packaging.
- Electronics.
- Branded appliances.
- Character goods.
- Products where color, size, shape, or included components are the key reason to buy.

The system must not imply the AI lifestyle image is a photo of the exact purchased item when the generated image only approximates the product. Draft metadata should record `visual_mode`, such as `ai_lifestyle_reference`, `api_product_image`, `manual_photo`, or `text_only`.

### Generated card fallback

Cardnews-style images are no longer the preferred visual. They should only be used when a lifestyle image is unsafe or unavailable.

If a fallback card is generated:

- It must be text-free by default, or use code-rendered text only.
- It must not ask the image model to render Korean text.
- It must not include prices, discount badges, logos, URLs, or disclosure text.
- It should look like a quiet background asset, not a promotion banner.

Raw webpage image scraping:

- Not enabled by default.
- Only allowed behind an explicit manual mode if a separate approved spec explicitly enables it.
- Must not bypass robots, authentication, hotlinking restrictions, or copyright controls.
- Must be treated as riskier than API image URLs.

Threads media requirements:

- Drafts should populate `media_urls` with public image URLs.
- Local images must be uploaded/converted to public `media_urls` before publishing.
- Existing `verify_media_urls.mjs` and publish safety checks should continue blocking invalid image URLs.
- Generated lifestyle images and fallback cards must be uploaded to public `media_urls` before publishing.

## Scheduling

Target: three Lifemagazine product drafts/posts per day.

Initial recommended slots in Korea time:

- 11:30 KST: daily-use / household / morning-life item
- 16:30 KST: desk, bag, beauty, small convenience item
- 21:30 KST: home, storage, restocking, next-day prep item

Implementation should update existing Lifemagazine configuration and workflow behavior from the current lower daily limit to three product slots per day.

## Validation changes

Current validation requires affiliate disclosure at the beginning of `threads_text` when `product_links` exist. That conflicts with the desired non-ad-like main post.

New validation should require:

- If a Coupang affiliate product link exists, a reply/comment must include the exact Coupang Partners disclosure text.
- The main post may omit the disclosure if the comment/reply contains it.
- The main post must not contain raw affiliate links.
- The post must not exceed Threads text limits used by existing publish safety checks.
- Drafts with product links but no disclosure-bearing comment must fail validation.
- Drafts claiming personal use must include an explicit `relationship` or `usage_status` flag such as `actual_used`.

## Data model additions

Candidate product fields:

- `source`: `coupang_api`
- `product_id`
- `product_name`
- `category`
- `price`
- `rating`
- `review_count`
- `product_url`
- `affiliate_url`
- `image_url`
- `collected_at`
- `selection_reason`

Draft fields:

- `account`: `lifemagazine_`
- `project`: `lifemagazine`
- `content_mode`: `found_product`, `recommendation`, or `actual_used`
- `scene_brief`
- `target_reader`
- `product_links`
- `media_urls`
- `visual_mode`: `ai_lifestyle_reference`, `api_product_image`, `manual_photo`, `fallback_card`, or `text_only`
- `visual_prompt`
- `visual_avoid_list`
- `visual_review_status`: `pending`, `approved`, `rejected`, or `regenerate`
- `replies`
- `affiliate_disclosure_required`
- `affiliate_disclosure_location`: `reply`
- `usage_status`: `actual_used` or `not_confirmed`
- `tone_notes`

## Error handling and safety

- If Coupang API credentials are missing, skip automatic product collection and send a clear Telegram/GitHub Actions log message.
- If no suitable product candidates exist, do not publish filler affiliate posts.
- If an image URL fails verification, either fall back to generated lifestyle image/text-only or hold the draft for approval.
- If a generated image contains hands, text-like artifacts, logos, distorted product details, or other AI-looking errors, hold or regenerate the draft.
- If comment/reply publishing fails, mark the draft failed; do not publish a main post with an affiliate link but no disclosure path.
- If a product appears unsafe or claim-heavy, hold it for manual review.
- If generated copy repeats recent hooks or endings too closely, regenerate the draft.

## Testing plan

The implementation plan should include:

- Unit tests for product candidate normalization and ranking.
- Unit tests for scene-first copy generation constraints.
- Validation tests for:
  - disclosure in reply passes,
  - disclosure missing fails,
  - disclosure only required when affiliate link exists,
  - main body affiliate links fail,
  - false personal-use claims fail.
- Draft generation tests for three daily Lifemagazine slots.
- Media URL verification tests using safe mocked URLs.
- Image prompt safety tests that reject hands, visible text, logos, price tags, brand marks, and receipt/paper/screen elements.
- Draft metadata tests for `visual_mode` and product-image fidelity rules.
- Workflow dry-run or script-level checks before enabling scheduled publishing.

## Out of scope for first implementation

- Full raw Coupang webpage scraping.
- Fully automatic publishing without approval.
- Multi-account product automation outside `lifemagazine_`.
- Medical, diet, supplement, investment, or high-risk product claim automation.
- Browser-based manual account login changes.

## Open implementation prerequisites

Before implementation can fully run in production, the operator must provide or confirm:

- Coupang Partners/Open API access key.
- Coupang Partners/Open API secret key.
- Partner tracking/channel ID or equivalent affiliate identifier.
- Whether API credentials require IP allowlisting for GitHub Actions or another runtime.

The system can still be implemented with dry-run/mock mode before live credentials are available.
