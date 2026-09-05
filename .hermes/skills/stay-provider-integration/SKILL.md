---
name: stay-provider-integration
description: Use when adding or changing accommodation providers.
version: 0.1.0
author: Kimuijoong, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [lodging, providers, api, normalization, caching]
    related_skills: [test-driven-development, systematic-debugging, stay-data-quality, stay-policy-compliance]
---

# Stay Provider Integration

Build and modify lodging-provider integrations without bypassing provider controls. This skill covers server-side credentials, normalized results, bounded API use, partial failure, and outbound-link-only fallbacks.

## When to Use

- Adding or modifying a lodging provider, provider endpoint, authentication flow, cache, or normalized field.
- Changing `src/providers.js`, `src/api.js`, provider routes in `server.mjs`, or their tests.
- Investigating provider failures, quota behavior, duplicates, or unsafe source URLs.
- Do not use for purely visual changes that do not alter provider behavior.

## Prerequisites

- Read `docs/REQUIREMENTS.md` and `docs/PROVIDER_INTEGRATION.md`.
- Read the provider implementation and all provider/API tests before editing.
- Load `stay-policy-compliance` before choosing a collection method.
- Load `test-driven-development` for behavior changes and `systematic-debugging` for failures.
- Never read or print `.env`; check only whether required variable names are set.

## Provider Contract

Each normalized candidate must preserve truthful provenance:

- Stable `id` and `source`.
- Provider display label and source URL.
- Name, category, address, coordinates, and description only when supplied or explicitly curated.
- Missing price, occupancy, bathroom, amenity, rating, review, or image fields remain `null` or empty.
- Non-HTTP(S) source links fall back to an approved provider search URL.
- Provider data and demo data remain distinguishable in state and UI.

## Procedure

1. Confirm the provider offers an official API, approved affiliate feed, or documented outbound search route. If not, stop automated collection and use an outbound link.
2. Record the allowed fields, authentication method, quotas, retention rules, attribution, and image rights in `docs/PROVIDER_INTEGRATION.md`.
3. Write one failing test for one behavior. Run the narrow test and verify the expected failure.
4. Implement the smallest provider adapter change. Credentials stay server-side and public errors never contain secret values.
5. Normalize only fields supported by the response. Do not invent defaults that could be interpreted as provider data.
6. Bound calls with target limits, cache TTL, timeout/error handling, and duplicate-request protection where appropriate.
7. Deduplicate using stable provider identifiers when available; otherwise use normalized name, address, and coordinates.
8. Return partial-result metadata explicitly: query count, raw count, unique count, returned count, errors, timestamp, and cache status.
9. Verify the narrow test, full `npm test`, and `npm run check`.
10. Use `stay-data-quality` on a small live sample. Do not repeat live calls merely to increase counts.

## Failure Handling

- Authentication failure: expose a stable public error code and safe Korean message; never include headers or credentials.
- Quota/rate limit: stop retries, preserve cached data, and tell the UI the result is stale or unavailable.
- One query fails: return successful candidates with `partial: true` and sanitized per-query errors.
- Provider unavailable: keep demo mode usable and do not relabel demo data as live data.
- Unsupported provider API: use an official outbound search link and set collected listing count to zero.

## Pitfalls

- A user login session is not API authorization.
- Public web pages are not permission to scrape, mirror, or hotlink.
- A successful HTTP response does not prove the results match the requested region.
- Search API coordinates can be approximate and must not be treated as driving distance.
- More search queries increase duplicates, quota use, latency, and false positives.

## Verification

Completion requires all of the following:

- Provider and API tests pass after an observed RED state for new behavior.
- No credentials appear in client JavaScript, API responses, logs, docs, or Git status.
- Missing fields remain visibly unknown.
- Source attribution and safe original links appear in the UI.
- Cache and partial-error metadata are verified using deterministic tests.
- `npm test` and `npm run check` exit successfully.
