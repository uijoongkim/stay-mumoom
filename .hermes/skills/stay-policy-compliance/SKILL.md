---
name: stay-policy-compliance
description: Use when lodging data raises policy or copyright risk.
version: 0.1.0
author: Kimuijoong, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [lodging, policy, copyright, privacy, attribution]
    related_skills: [grounded-citations, stay-provider-integration, stay-data-quality]
---

# Stay Policy Compliance

Assess provider terms, copyright, privacy, attribution, and consumer-transparency risks before implementing lodging data collection or display. When permission is unclear, this skill chooses a safer product alternative instead of bypassing controls.

## When to Use

- Adding a provider, scraper, login/OAuth flow, image, review, description, rating, price, or availability feed.
- Changing retention, caching, attribution, outbound links, user location, or operator-submitted content.
- Answering whether a platform feature is legally or contractually safe to build.
- Do not use as legal advice; identify uncertainty and recommend professional review for launch-critical decisions.

## Prerequisites

- Load `grounded-citations` and use current first-party documentation.
- Read `docs/REQUIREMENTS.md` and `docs/PROVIDER_INTEGRATION.md`.
- Identify the actor, data source, collection method, fields, storage period, display purpose, and target jurisdiction.

## Decision Order

Use the first viable option:

1. Official public API under documented terms.
2. Approved affiliate or partner API/feed.
3. Direct data agreement with the provider.
4. Verified accommodation-operator submission.
5. Licensed public/open tourism data.
6. Official outbound search/deep link without collecting listing content.

Do not implement undocumented APIs, session-cookie reuse, access-control bypass, CAPTCHA avoidance, or DOM scraping when permission is absent or ambiguous.

## Procedure

1. Retrieve current official API documentation, terms, branding rules, privacy notices, robots policy where relevant, and pricing/quota documentation.
2. Record exact support for authentication, allowed use, prohibited use, attribution, retention, caching, images, reviews, and rate limits.
3. Cite each externally sourced policy claim with `grounded-citations`; mark unresolved items explicitly.
4. Classify risk as `allowed`, `allowed-with-conditions`, `unclear`, or `prohibited`.
5. For `unclear` or `prohibited`, stop the risky implementation and propose an outbound link, first-party illustration, operator upload, or licensed dataset.
6. Define user-facing attribution and limitations before coding.
7. Ensure secrets stay server-side and user location is requested only after an explicit action.
8. Update `docs/PROVIDER_INTEGRATION.md` with the decision date, source URLs, constraints, and reconsideration trigger.

## Content Rules

- Provider facts show the provider name adjacent to the result or in a clearly associated source label.
- Platform trademarks are descriptive attribution, not an implication of partnership.
- Do not download, mirror, cache, or hotlink listing photos without documented permission.
- Do not copy long descriptions or reviews without permission; prefer short factual fields and original links.
- First-party illustrations must not be presented as actual property photos.
- Curated or inferred information must be labeled separately from provider information.
- Prices and availability require timestamps and a notice that the original platform controls the final terms.
- Booking and payment remain on the authorized original platform until separate transactional approval exists.

## Privacy Rules

- Collect only the minimum location precision needed for distance estimates.
- Request browser location only after an explicit user action and explain its purpose.
- Do not persist precise location by default.
- Never expose API credentials or raw authorization headers to browser code, logs, screenshots, or documentation.
- If accounts are later introduced, define deletion, retention, access control, and consent before collecting personal data.

## Pitfalls

- Technical accessibility is not usage permission.
- Attribution alone does not cure copyright or contract violations.
- OAuth login does not automatically grant listing-search or redistribution rights.
- “Publicly visible” images can still be copyrighted and protected against hotlinking.
- Provider policy and pricing can change; cite retrieval dates and re-check before launch.

## Verification

- Every provider has a documented collection mode and policy status.
- Current first-party sources support material policy claims.
- Attribution, limitations, and timestamps are visible where users act on data.
- No unlicensed photos, copied reviews, or undocumented collection paths exist.
- The implementation has a safe fallback for revoked credentials, quota exhaustion, and provider policy changes.
