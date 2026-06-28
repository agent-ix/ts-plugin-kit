---
id: SR-001
title: "base checklist review of plugin-discovery (US-003, FR-008..012, NFR-005) — 2026-06-27"
type: SpecReview
analysis: base
scope: "spec/usecase/US-003; spec/functional/FR-008..FR-012; spec/non-functional/NFR-005; spec/spec.md; spec/tests.md"
review_set: subset
---

## Summary

Base checklist review of the plugin-discovery requirements: ID formats, US/FR/AC
quality and testability, traceability, and the six coverage rules. IDs, links, and
AC→TC mapping are sound; the substantive items are a few non-testable phrasings and
a US-versus-AC consistency nit. Deeper findings are recorded in the failure-domain,
ears-conformance, and scope-boundary companion reviews.

## Findings

| ID      | Severity | Summary                                                                                                                                                                                                            | Refs                         |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| FND-001 | low      | ID formats (US/FR/NFR/AC/CON/TC) all conform; relationship links resolve; quire validate exits 0.                                                                                                                  | US-003, FR-008..012, NFR-005 |
| FND-002 | medium   | "SHALL bound manifest-fetch concurrency" names no concrete limit, so it is not testable as written.                                                                                                                | FR-009                       |
| FND-003 | medium   | `SearchOptions.signal` (cancellation) is an input with no behavioral AC; an unexercised field risks the 100% gate.                                                                                                 | FR-008                       |
| FND-004 | low      | US-003 records illustrative `US-003-EX-*` examples while US-002 uses `US-002-AC-*`; matrix maps EX→TC, which is consistent but mixes the two conventions across user stories.                                      | US-003, spec/tests.md        |
| FND-005 | low      | Discovery TCs (TC-022..042) are correctly marked 🚧 Planned (forward-spec); AC→TC mapping is 100% so the matrix is complete as a plan, with execution coverage gated by NFR-002 once `tests/search.test.ts` lands. | spec/tests.md                |
| FND-006 | low      | All six coverage rules are represented for discovery (option permutations, constraint boundary FR-008-CON-1, error paths, the rate-limit state transition, and edge cases EC-006..009).                            | spec/tests.md                |
