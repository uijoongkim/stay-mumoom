---
name: stay-data-quality
description: Use when validating or enriching lodging search data.
version: 0.1.0
author: Kimuijoong, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [lodging, data-quality, deduplication, provenance]
    related_skills: [test-driven-development, stay-provider-integration, stay-policy-compliance]
---

# Stay Data Quality

Validate, normalize, and enrich accommodation candidates while preserving the boundary between sourced facts and curated content. This skill prevents plausible-looking fabricated details from entering live results.

## When to Use

- Importing, merging, deduplicating, filtering, ranking, or enriching lodging data.
- Changing the common listing model or assumptions about missing values.
- Reviewing a live provider sample for false positives and regional accuracy.
- Do not use for provider authentication or UI-only styling.

## Prerequisites

- Read `src/domain.js`, `src/providers.js`, and their tests.
- Load `test-driven-development` before behavior changes.
- Load `stay-policy-compliance` before using descriptions, images, reviews, ratings, or inferred attributes.
- Identify each field's provenance before changing it.

## Provenance Classes

Every displayed fact must belong to one class:

1. `provider`: returned by an authorized provider interface.
2. `operator`: submitted and verified by the accommodation operator.
3. `curated`: added by this service with a recorded source and review date.
4. `derived`: computed from sourced values, with the method documented.
5. `demo`: fictional data used only in sample mode.
6. `unknown`: unavailable and displayed as such.

Never transform `unknown` into a plausible value. Never show `demo`, `curated`, or `derived` values as provider-supplied.

## Quality Checks

- Normalize whitespace and provider markup without altering meaningful names.
- Preserve the original and road addresses when available.
- Reject candidates outside the requested administrative area unless the query explicitly allows nearby locations.
- Verify the category represents lodging; flag restaurants, attractions, real-estate offices, and unrelated businesses.
- Validate coordinates as finite latitude/longitude values in a plausible Korean bounding box.
- Deduplicate conservatively: stable provider ID first, then normalized name/address/coordinates.
- Keep similarly named but separately addressed accommodations distinct.
- Treat price, capacity, bathrooms, bedrooms, amenities, rating, reviews, and images as nullable.
- Record collection or review timestamps for freshness-sensitive facts.

## Procedure

1. Define a fixture containing valid results, duplicates, missing fields, unsafe markup, wrong-region candidates, and non-lodging categories.
2. Write one failing quality test for the next rule and verify that it fails for the intended reason.
3. Implement the smallest normalization or validation change.
4. Run the narrow test, then the full suite.
5. For live data, inspect a bounded sample without exposing credentials or raw secret-bearing requests.
6. Report counts as separate assertions: raw, unique, returned, excluded, and unknown-field coverage.
7. Keep exclusions explainable with machine-readable reason codes where implementation scope permits.
8. Document any manual enrichment source, reviewer, and timestamp before display.

## Enrichment Rules

- Provider images may be used only when the provider contract explicitly grants display rights.
- Otherwise use clearly labeled first-party illustrations, operator uploads, or licensed assets.
- Amenities such as bathtub, sauna, cypress bath, pool, barbecue, and pet access require a source; keywords in a business name alone are insufficient proof.
- “Emotional stay,” “clean,” or “popular” are subjective labels and require documented curation criteria.
- Distance derived from coordinates must be labeled as estimated unless routing data is used.

## Pitfalls

- More records do not mean better coverage; broad queries can increase false positives.
- Same coordinates can represent a complex with multiple legitimate businesses.
- Provider categories can be inconsistent, so category filtering needs fixtures and manual sampling.
- Stale details can be harmful for price, availability, amenities, and cancellation policy.
- A realistic placeholder can mislead more than an explicit “정보 없음”.

## Verification

- Tests cover null preservation, wrong-region rejection, category filtering, deduplication, and provenance.
- Live counts are derived from actual response metadata, not UI assumptions.
- At least a bounded sample of live source links and addresses is manually checked.
- The UI visibly distinguishes provider, curated, derived, demo, and unknown content.
- `npm test` and `npm run check` exit successfully.
