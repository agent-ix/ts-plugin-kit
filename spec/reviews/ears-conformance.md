---
id: SR-003
title: "ears-conformance review of plugin-discovery (FR-008..012, NFR-005) — 2026-06-27"
type: SpecReview
analysis: ears-conformance
scope: "spec/functional/FR-008..FR-012; spec/non-functional/NFR-005"
review_set: subset
---

## Summary

EARS requirement-grammar review of the discovery FRs. The two warnings `quire
validate` emits (FR-011 lines 24 and 46) are tokenizer noise from an em-dash
parenthetical and inline-code operator spans (`403`/`remaining === 0`) over
statements that are actually atomic — no rewrite required. The material items are
several **validator-missed** multi-`shall` bullets that should be split for
atomicity so each maps cleanly to one AC. No vague-verb violations were found.

## Findings

| ID      | Severity | Summary                                                                                                                                                                      | Refs            |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| FND-001 | low      | FR-011 line 24 (`SHALL surface … —` em-dash roll-up) is flagged unclassifiable but is an acceptable Description summary deferring atomic rules to Behavior; tokenizer noise. | FR-011          |
| FND-002 | low      | FR-011 line 46 (`When … 403/429 … remaining === 0, the library SHALL emit …`) is a well-formed event statement; the flag is backtick/operator noise.                         | FR-011          |
| FND-003 | medium   | FR-008 npm-backend bullet packs two `shall` (issue request + map results); split into a request statement and a mapping statement.                                           | FR-008          |
| FND-004 | medium   | FR-008 github-backend bullet packs two `shall` (issue request + map results); split likewise.                                                                                | FR-008          |
| FND-005 | medium   | FR-009 verify-result bullet packs two conditional rules and two `shall` joined by `;`; split into the `null`→drop and object→mark statements.                                | FR-009          |
| FND-006 | medium   | FR-010 `createTtlCache` storage bullet packs three `shall` over three subjects (store / get-evict / max-evict); split into three bullets.                                    | FR-010          |
| FND-007 | low      | FR-010 cache-key bullet packs two `shall` (key + return-on-hit); split for atomicity.                                                                                        | FR-010          |
| FND-008 | low      | FR-008 merge/dedupe/rank bullet is one `shall` with three responses (complex); optional split into merge/dedupe and ranking statements.                                      | FR-008          |
| FND-009 | low      | No vague-verb (support/handle/manage/process/provide/enable) violations found; FR-012 and NFR-005 statements are atomic and concrete.                                        | FR-012, NFR-005 |
