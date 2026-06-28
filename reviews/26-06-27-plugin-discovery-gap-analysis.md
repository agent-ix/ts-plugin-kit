---
id: SR-005
title: "gap-analysis of Plan-001 plugin discovery (US-003, FR-008..012, NFR-005) — 2026-06-27"
type: SpecReview
analysis: gap-analysis
scope: "plan/Plan-001-plugin-discovery/; spec/usecase/US-003; spec/functional/FR-008..FR-012; spec/non-functional/NFR-005; src/search.ts; tests/search.test.ts; spec/tests.md (TC-022..054)"
review_set: subset
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/plan"
    type: "reviews"
  - target: "ix://agent-ix/ts-plugin-kit/spec/tests"
    type: "references"
---

## Summary

Post-implementation gap analysis of the plugin-discovery plan bundle (Plan-001)
against its spec (US-003, FR-008…FR-012, NFR-005), the implementation
(`src/search.ts`), the tests (`tests/search.test.ts`), and the Test Matrix
(`spec/tests.md`, TC-022…TC-054). The build is functionally complete, fully
covered (100% on `src/search.ts`), and was smoke-tested against live npm + GitHub.
The matrix is real: every discovery Test Case (TC-022…TC-054) is backed by a test
carrying a matching `(TC-xxx)` tracking tag. The gaps are (a) plan-status hygiene —
the seven build tasks were never flipped from `todo` to `done`; (b) one genuine
code↔spec divergence in the cache key; and (c) a cache-bound default that does not
match the bounded-cache intent. Semantic intent↔test↔code agreement was assessed in
the parallel `/code-review` pass (folded into the findings below).

## Verdict

**CONDITIONAL** — implementation complete and matrix-backed; no `high` findings.
Clears to **PASS** once the seven build tasks are marked `done`, the cache-key
token-identity divergence (FND-002) is fixed, and the cache-bound default (FND-003)
is set. Task-008 (publish) is a legitimate downstream gate, not a defect.

## Findings

| ID      | Severity | Summary                                                                                                                                                                                                                                                                                                                                                                                  | Refs                                               |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| FND-001 | medium   | Plan-001 Tasks 001–007 are implemented, tested, and smoke-verified but still carry `status: todo`; only Task-008 (publish) is genuinely pending. Flip the seven build tasks to `done`.                                                                                                                                                                                                   | plan/Plan-001-plugin-discovery/tasks/Task-001..007 |
| FND-002 | medium   | **Code↔spec divergence.** FR-010 specifies the cache key uses "a stable non-secret discriminator of the resolved token" (token _identity_), but `cacheKey` uses token _presence_ (`token ? "auth" : "anon"`). Two distinct tokens collide on `"auth"`; with the late-bound-token feature a shared searcher could serve one user's authenticated (incl. private-repo) results to another. | FR-010, src/search.ts:568                          |
| FND-003 | medium   | Cache is unbounded by default: `createPluginSearch` leaves `cacheMax` undefined, so entries evict only lazily on expired-key read — memory grows with distinct queries over the TTL. FR-010/NFR-011 intend a bounded cache; set a default `cacheMax`.                                                                                                                                    | FR-010, NFR-011, src/search.ts:546                 |
| FND-004 | low      | `manifestUrl` interpolates the registry-supplied `name`/`fullName` unencoded; cross-host SSRF is not reachable (fixed authority), but a name containing `..` can traverse within the trusted CDN to a different file. Reject/encode `..`/control chars.                                                                                                                                  | FR-009, src/search.ts:421                          |
| FND-005 | low      | `Number(x-ratelimit-*)` has no non-finite guard (surfaces `NaN` rate fields, benign); a cache hit returns the shared `SearchResponse` reference (host mutation poisons later hits).                                                                                                                                                                                                      | FR-010, FR-011, src/search.ts:331,576              |
| FND-006 | low      | Untracked tests: several `search.test.ts` cases (dedup-order, npm-link fallback, github-first dedupe, equal-rank) carry no `(TC-xxx)` tag — extra coverage beyond the matrix, not a gap; optionally tag or note.                                                                                                                                                                         | tests/search.test.ts                               |

## Coverage

- **Plan completion (Step 1):** 0/8 tasks `status: done`; 7 are built-but-unflagged
  (FND-001), Task-008 (publish) genuinely pending.
- **Matrix verification (Step 2):** PASS for the Plan-001 scope — all 33 discovery
  Test Cases (TC-022…TC-054) are backed by a test carrying the matching `(TC-xxx)`
  tag in `tests/search.test.ts`. (Matrix rows TC-001…021 are the pre-existing backsync
  suite, outside this plan's scope, backed by `describe › test` case-strings.)
- **Underspecified code (Step 3):** No code lacking an owning requirement; all
  `search.ts` exports trace to FR-008…012 / NFR-005. One divergence (FND-002) and one
  unbounded default (FND-003) recorded.
- **Semantic review (Step 4):** Performed via the parallel `/code-review` pass
  (intent↔test↔code); its medium findings are reflected in FND-002…005.
