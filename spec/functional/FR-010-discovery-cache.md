---
id: FR-010
title: "TTL-Cached Discovery with an Injectable Clock"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/usecase/US-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "requires"
    cardinality: "1:1"
---

# [FR-010] TTL-Cached Discovery with an Injectable Clock

## Description

The library SHALL export a generic `createTtlCache(opts)` whose expiry is driven by
an injectable `Clock`, and a `createPluginSearch(deps)` factory that holds one such
cache plus rate state across calls so a host can reuse a single searcher. Repeated
searches with identical parameters within the TTL SHALL be served from cache
without re-issuing backend requests.

## Inputs

- `createTtlCache`: `{ ttlMs, clock?, max? }`; default `clock` is `systemClock`.
- `createPluginSearch`: `{ http?, clock?, ttlMs?, githubToken?, npmRegistry?,
githubApi?, verifier? }`; `githubToken` MAY be a value or a late-bound
  `() => string | undefined`.

## Outputs

- `TtlCache<V>` with `get`/`set`/`delete`/`clear`/`size`.
- `PluginSearch` with `search(opts)`, `invalidate(opts?)`, and `lastRate()`.

## Behavior

- `createTtlCache` SHALL store each value with an expiry of `clock.now() + ttlMs`.
- When `clock.now()` reaches an entry's expiry, `createTtlCache.get` SHALL return
  `undefined` and evict that entry.
- Where `max` is set, `createTtlCache` SHALL evict entries in insertion order beyond
  `max`.
- `createPluginSearch().search` SHALL key the cache on
  `tag|query|sources|limit|verifier-present|token-id`, where `token-id` is a stable
  non-secret discriminator of the resolved token (never the raw token), so a
  late-bound token or a verifier toggle does not return a stale or wrong-shape entry.
- When a search hits a live cache entry, `createPluginSearch().search` SHALL return
  the cached `SearchResponse` and issue no `HttpFetcher` call.
- `createPluginSearch().search` SHALL cache only a `SearchResponse` whose `errors`
  is empty; a response carrying any `SearchBackendError` (including a rate-limited
  backend) SHALL NOT be cached, so a transient failure never poisons the TTL nor
  defeats the [FR-011](./FR-011-github-rate-limit.md) resume-after-`resetAt` rule.
- `invalidate(opts?)` SHALL drop the matching cache entry, or the whole cache when
  no `opts` are given.
- The factory SHALL resolve a function-valued `githubToken` at call time, so a host
  can supply a token that becomes available after the searcher is constructed.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                                               | Verification  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------- | -------------------------------------------------------------- | ------------- |
| FR-010-AC-1 | `createTtlCache` returns a stored value before expiry and `undefined` after the injected clock advances past `ttlMs`.                                                                                  | Test (TC-032) |
| FR-010-AC-2 | A `max`-bounded cache evicts the oldest entry once `size` would exceed `max`.                                                                                                                          | Test (TC-033) |
| FR-010-AC-3 | A second `search` with identical parameters within the TTL returns the cached response and issues no further `HttpFetcher` call.                                                                       | Test (TC-034) |
| FR-010-AC-4 | `invalidate(opts)` forces the next identical `search` to re-issue backend requests; `invalidate()` clears all entries.                                                                                 | Test (TC-035) |
| FR-010-AC-5 | A function-valued `githubToken` is resolved per call, so a token supplied after construction is applied to the next search and does not return a stale cached entry keyed under the previous token-id. | Test (TC-036) |
| FR-010-AC-6 | A `SearchResponse` carrying any `SearchBackendError` is not cached; the next identical `search` re-issues backend requests.                                                                            | Test (TC-051) |
| FR-010-AC-7 | Toggling verifier presence (or token identity) for the same `tag                                                                                                                                       | query         | sources | limit` produces a distinct cache entry, not a cross-shape hit. | Test (TC-052) |

## Dependencies

- Implements [US-003](../usecase/US-003-discover-plugins-by-tag.md).
- Requires [FR-008](./FR-008-candidate-search.md) (the responses it caches).
- Cooperates with [FR-011](./FR-011-github-rate-limit.md) (rate state held alongside
  the cache).
