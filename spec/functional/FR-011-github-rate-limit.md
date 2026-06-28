---
id: FR-011
title: "GitHub Rate-Limit Surfacing and Short-Circuit"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/usecase/US-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "requires"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-010"
    type: "requires"
    cardinality: "1:1"
---

# [FR-011] GitHub Rate-Limit Surfacing and Short-Circuit

## Description

The library SHALL surface GitHub rate-limit state — reading the rate-limit response
headers into a structured `RateLimit`, reporting an exhausted window as a
`SearchBackendError` rather than a thrown error, and short-circuiting further GitHub
requests through `createPluginSearch` while the window stays exhausted. The library
SHALL leave all retry timing to the host, never sleeping or auto-retrying on its
own. The individual rules are specified under Behavior below.

## Inputs

- The GitHub response headers `x-ratelimit-limit`, `x-ratelimit-remaining`, and
  `x-ratelimit-reset`.
- The rate state retained by `createPluginSearch` (see
  [FR-010](./FR-010-discovery-cache.md)).

## Outputs

- `SearchResponse.rate.github`: `{ limit, remaining, resetAt }`, where `resetAt` is
  the epoch-**seconds** value from `x-ratelimit-reset` (compared against
  `clock.now()/1000`, which is milliseconds).
- A `SearchBackendError` with `rateLimited: true` and the `resetAt` seconds value
  when the window is exhausted.
- `PluginSearch.lastRate()`: the most recent per-backend `RateLimit` snapshot, or an
  empty object before any GitHub response has been seen.

## Behavior

- The library SHALL parse the three rate-limit headers from a GitHub response
  (present on both 200 and 403) into `rate.github`, storing `resetAt` as the raw
  epoch-seconds integer.
- Where any of the three rate-limit headers is absent or parses to a non-finite
  number, the library SHALL treat the response as carrying no rate info and leave
  `rate.github` undefined rather than surfacing a `NaN` field.
- On the first search, when no prior `lastRate().github` snapshot exists, the
  library SHALL issue the GitHub request normally (no short-circuit).
- When a GitHub response is `403` or `429` with `remaining === 0`, the library
  SHALL emit a `SearchBackendError` carrying `rateLimited: true` and the reset
  time rather than throwing.
- While `lastRate().github.remaining === 0` and `clock.now()/1000 < resetAt`, the
  library SHALL skip the GitHub request from `createPluginSearch().search` and
  return the rate-limited error for that backend.
- When the recorded reset time has passed, the library SHALL issue the GitHub
  request again on the next search.
- The library SHALL NOT call any sleep or delay primitive, remaining a pure
  function of its inputs and the injected clock.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                        | Verification  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-011-AC-1 | A GitHub `200` carrying rate-limit headers populates `rate.github` with `limit`, `remaining`, and `resetAt`.                                                    | Test (TC-047) |
| FR-011-AC-2 | A GitHub `403` with `remaining:0` yields a `SearchBackendError{rateLimited:true}` carrying the reset time, and no exception propagates.                         | Test (TC-048) |
| FR-011-AC-3 | After a window is recorded exhausted, the next `search` skips the GitHub request while the injected clock is before `resetAt`.                                  | Test (TC-049) |
| FR-011-AC-4 | Once the injected clock advances past `resetAt` (seconds), the next `search` issues the GitHub request again.                                                   | Test (TC-050) |
| FR-011-AC-5 | On the first search with no prior rate snapshot, the GitHub request is issued (no short-circuit), and `lastRate()` is an empty object until a response is seen. | Test (TC-063) |
| FR-011-AC-6 | A rate-limit header that is absent or parses to a non-finite number yields no rate info (`rate.github` undefined), not a `NaN`-valued `RateLimit`.              | Test (TC-068) |

## Dependencies

- Implements [US-003](../usecase/US-003-discover-plugins-by-tag.md).
- Requires [FR-008](./FR-008-candidate-search.md) (the GitHub backend it guards) and
  [FR-010](./FR-010-discovery-cache.md) (the retained rate state).
