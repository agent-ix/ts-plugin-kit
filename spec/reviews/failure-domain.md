---
id: SR-002
title: "failure-domain review of plugin-discovery (US-003, FR-008..012, NFR-005) — 2026-06-27"
type: SpecReview
analysis: failure-domain
scope: "spec/usecase/US-003; spec/functional/FR-008..FR-012; spec/non-functional/NFR-005; spec/tests.md"
review_set: subset
---

## Summary

Failure-domain analysis of the discovery surface surfaced several unstated or
under-specified failure modes around manifest verification, error propagation, cache
poisoning, dedup determinism, and rate-limit state. The high-severity items
(absent-vs-unreachable manifest, a throwing host `verify`, and caching of error
responses) should be resolved before the feature is converted to a plan because each
would otherwise become a latent defect with no owning AC.

## Findings

| ID      | Severity | Summary                                                                                                                                                                                                                                  | Refs                     |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| FND-001 | high     | Manifest 404 (absent → incompatible) is conflated with a transient/unreachable fetch (unknown); both silently drop the candidate, discarding real plugins during a CDN blip with no error surfaced.                                      | FR-009-AC-3              |
| FND-002 | high     | Behavior when the host `verify(rawText)` callback **throws** (rather than returning `null`) is unspecified — it could sink the whole backend arm or escape `searchPlugins`.                                                              | FR-009-AC-1, FR-009-AC-2 |
| FND-003 | high     | Whether a `SearchResponse` carrying `errors` or a rate-limited backend is cached is unspecified; caching it poisons the TTL and defeats the FR-011 "resume after `resetAt`" guarantee.                                                   | FR-010-AC-3, FR-011-AC-4 |
| FND-004 | medium   | Malformed/partial search JSON (missing `objects[]`/`items[]`, absent `links.repository`/`author`/`stargazers_count`) has no defensive contract — undefined whether it throws or degrades.                                                | FR-008-AC-1              |
| FND-005 | medium   | Dedup match omits URL normalization (`.git`, trailing slash, `git+https`, case) and ranking is not a total order when `stars`/`updatedAt` are absent (the npm-preferred entry has no intrinsic stars), so ordering is non-deterministic. | FR-008-AC-5              |
| FND-006 | medium   | "Bounded" verification concurrency names no value or mechanism and has no AC/TC, so it is neither verifiable nor enforced by the coverage gate.                                                                                          | FR-009                   |
| FND-007 | medium   | `SearchOptions.signal` cancellation has no behavioral FR/AC (propagation, partial-vs-throw, AbortError).                                                                                                                                 | FR-008                   |
| FND-008 | medium   | The "all backends fail/rate-limited" outcome shape is undefined; a host cannot distinguish it from a legitimate empty-but-successful search.                                                                                             | FR-008, US-003-EX-3      |
| FND-009 | medium   | Cache key `tag                                                                                                                                                                                                                           | query                    | sources | limit` omits verifier-presence and token identity, so a late-bound token (FR-010-AC-5) or a verifier toggle can return a stale/cross-shape cached set. | FR-010-AC-3, FR-010-AC-5 |
| FND-010 | low      | Rate-limit first-call (no prior `lastRate()`), `resetAt` units (epoch seconds vs `clock.now()` ms), and stale `resetAt` in a long-lived process are under-pinned.                                                                        | FR-011-AC-3              |
| FND-011 | low      | No constraint forbids `githubToken` from appearing in `SearchBackendError` messages, cached values, or results.                                                                                                                          | FR-008, FR-011           |
| FND-012 | low      | `limit` (default 20) maps to npm `size` (max 250) and GitHub `per_page` (max 100); large values risk a backend 422 with no clamping specified.                                                                                           | FR-008-AC-2              |
