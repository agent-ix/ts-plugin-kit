---
id: SR-004
title: "scope-boundary review of plugin-discovery (US-003, FR-008..012, NFR-003/005) — 2026-06-27"
type: SpecReview
analysis: scope-boundary
scope: "spec/spec.md; spec/usecase/US-003; spec/functional/FR-008..FR-012; spec/non-functional/NFR-001, NFR-003, NFR-005"
review_set: subset
---

## Summary

Scope-boundary analysis. The discovery FRs draw the _plugin-type_ boundary well —
all manifest parsing stays in the host `CandidateVerifier`, `capabilities` is opaque
`unknown`, and the `tag` discriminator carries host semantics with no YAML/JSON
parser added. The defects are concentrated in the **top-level `spec.md` and NFR-003
not being reconciled to the now-async discovery surface** (a genuine internal
contradiction), plus the npm/GitHub/unpkg endpoint knowledge narrowing the kit's
genericity without being acknowledged in Scope. The high-severity items are factual
contradictions and must be fixed before planning.

## Findings

| ID      | Severity | Summary                                                                                                                                                                                                                                                                                                             | Refs            |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| FND-001 | high     | NFR-003 globally forbids what discovery does ("All operations SHALL be synchronous … SHALL NOT introduce async/Promise APIs or non-git network calls"; "Promise-returning functions: 0"); re-scope its subject to the resolution surface.                                                                           | NFR-003, FR-008 |
| FND-002 | high     | spec.md §3.1 still asserts "every operation is synchronous and `git` … is the only side effect" — now factually false.                                                                                                                                                                                              | spec.md §3.1    |
| FND-003 | high     | spec.md §2.2 excludes "Asynchronous or networked transport beyond the synchronous `git` subprocess" — directly excludes the in-scope discovery feature.                                                                                                                                                             | spec.md §2.2    |
| FND-004 | medium   | spec.md §2.1 headline still describes a purely "synchronous" toolkit and omits discovery.                                                                                                                                                                                                                           | spec.md §2.1    |
| FND-005 | medium   | The two CDN manifest hosts (`unpkg.com`, `raw.githubusercontent.com`) are hardcoded and non-injectable while the search endpoints (`npmRegistry`, `githubApi`) are injectable — an inconsistent seam; and the kit now bakes in npm/GitHub/unpkg wire knowledge without Scope acknowledging the narrowed genericity. | FR-008, FR-009  |
| FND-006 | medium   | §2.2 lacks the new host-concern exclusions the feature creates: token persistence, retry/backoff/sleep/debounce timing, and plugin publishing/topic-tagging.                                                                                                                                                        | spec.md §2.2    |
| FND-007 | medium   | spec.md §5.3/§5.4 class narratives and §12 verification strategy omit the discovery FRs, NFR-005, and the `tests/search.test.ts` / fake `HttpFetcher`+`Clock` approach, leaving the prose inconsistent with the (updated) index/module tables.                                                                      | spec.md §5, §12 |
| FND-008 | medium   | FR-012 couples the public symbol/title to a host UI concept ("install field"/"install-input"); the agnostic framing is "render `Source` → canonical source string", and the `git-subdir` lossiness should be a documented limitation.                                                                               | FR-012          |
| FND-009 | low      | NFR-001 verification narrative enumerates allowed `node:*` built-ins but is silent on the discovery `fetch` global; add a line clarifying the default fetcher uses global `fetch` and adds no import.                                                                                                               | NFR-001         |
