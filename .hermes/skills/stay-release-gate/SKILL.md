---
name: stay-release-gate
description: Use before declaring a Stay Curator change complete.
version: 0.1.0
author: Kimuijoong, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [lodging, release, verification, security, browser-qa]
    related_skills: [requesting-code-review, dogfood, test-driven-development, stay-data-quality, stay-policy-compliance]
---

# Stay Release Gate

Run the project-specific completion gate for Stay Curator. Passing a unit test alone is insufficient: security, live-provider behavior, browser flows, attribution, documentation, and policy fallbacks must also be verified.

## When to Use

- Before saying a feature, bug fix, milestone, or release is complete.
- Before a requested commit, push, deployment, or handoff.
- After changes spanning two or more files or affecting provider data.
- Do not use to replace TDD during development; this is the final gate.

## Prerequisites

- Load `requesting-code-review` for independent review.
- Load `dogfood` for browser QA.
- Load `stay-data-quality` when provider data changed.
- Load `stay-policy-compliance` when external content, terms, images, or personal data changed.
- Confirm the intended scope and list every changed file.

## Gate 1: Repository and Secrets

1. Run Git status and review every untracked or modified path.
2. Confirm `.env`, credentials, tokens, authorization headers, and raw secret values are absent from the diff.
3. Confirm `.gitignore` excludes `.env` and platform-generated clutter.
4. Confirm no unrelated files or drive-by refactors are included.
5. Do not commit or push unless the user explicitly requests it.

## Gate 2: Automated Verification

Run from the project root:

```bash
npm test
npm run check
```

Both commands must exit successfully. Record the actual test count and command output; never reuse a historical count.

For changed behavior, confirm its test was observed failing before production code was added. Provider tests must cover safe errors, null preservation, URL validation, deduplication, quotas, and cache semantics as applicable.

## Gate 3: API Verification

- Check `/api/providers` without exposing credentials.
- Use a bounded live request only when credentials are configured and the user permits real API usage.
- Avoid `refresh=1` during repeated verification; validate cached behavior first.
- Verify metadata: provider, query count, raw count, unique count, returned count, target, partial status, errors, timestamp, and cache status.
- Verify public error responses are stable and secret-free.
- Verify outbound-only providers report zero collected listings.

## Gate 4: Browser QA

Using `dogfood`, verify:

- Initial sample mode and provider status.
- Live-data loading, loading-button lock, success, partial failure, total failure, and retry behavior.
- Search, price, bathroom, guest, amenity filters, sorting, favorites, reset, empty state, and details.
- Source attribution, unknown-field labels, collection timestamp, original-link behavior, and demo/live distinction.
- Keyboard navigation, focus visibility, modal dismissal, and responsive layout.
- Browser console after navigation and every significant interaction.

Capture evidence for each defect. Do not call a flow passed merely because the page loaded.

## Gate 5: Data and Policy

- Verify a bounded sample belongs to the requested region and represents lodging.
- Ensure missing fields are not filled with invented values.
- Ensure actual property photos are used only with documented display rights.
- Ensure first-party illustrations are labeled and not represented as property photos.
- Ensure provider attribution and original links are visible.
- Ensure final price, availability, booking, and cancellation terms defer to the original provider.

## Gate 6: Documentation and Review

- Update README, user manual, provider integration guide, requirements, and test report when behavior changes.
- Verify commands, limits, counts, and screenshots against the running artifact.
- Run `requesting-code-review` and resolve blocking security or logic findings.
- Maximum two independent fix-and-review cycles; escalate remaining issues rather than looping.

## Failure Policy

A release is blocked by:

- Any new test or syntax failure.
- Any hardcoded or exposed credential.
- Unsupported scraping, image use, or misleading attribution.
- Fabricated provider fields.
- Unhandled provider failure that breaks sample mode.
- Browser console errors in a core user flow.
- Documentation that contradicts actual behavior.

## Verification Report

Report:

- Changed scope and files.
- Exact commands and exit status.
- Actual test totals.
- API requests performed and whether cache was used.
- Browser flows tested.
- Policy/data checks.
- Known limitations and any blocked gate.

Only use “완료” when every applicable gate has passed with current evidence.
