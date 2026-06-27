---
id: Task-003
title: "FR-009 host-driven compatibility verification"
type: Task
status: todo
track: A
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-009
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-001
    type: depends_on
---

# Task-003: FR-009 compatibility verification

## Scope

Add the optional verification pass to `searchPlugins`: fetch each candidate's
manifest from a rate-limit-friendly CDN, hand the raw text to the host
`CandidateVerifier`, and keep/drop accordingly — distinguishing an absent manifest
(`404` → incompatible) from a transient failure (→ unverified + error). The kit
parses nothing.

## Subtasks

- [ ] Write Vitest specs FIRST: TC-027 (verify returns object → kept, `verified:true` + capabilities),
      TC-028 (verify null → dropped), TC-029 (`404` → dropped as incompatible, no error, verify not called),
      TC-030 (npm via `unpkg.com/{pkg}/{manifestPath}`, github via `raw.githubusercontent.com/{owner}/{repo}/HEAD/{manifestPath}`),
      TC-031 (no verifier → unfiltered, no fetch), TC-048 (non-404 fail/reject → dropped + transient
      `SearchBackendError`), TC-049 (verify throws → only that candidate dropped, no escape),
      TC-050 (≤ 6 concurrent manifest fetches for > 6 candidates).
- [ ] Implement manifest-fetch URL construction (unpkg / raw.githubusercontent HEAD) through the same `HttpFetcher`.
- [ ] Branch on status: `404`→incompatible-drop (no error); other non-OK/reject→unverified-drop + transient error.
- [ ] Branch on `verify` result: `null`→drop; object→`verified:true` + `capabilities`; throw→drop that candidate only.
- [ ] Cap manifest-fetch concurrency at ≤ 6 simultaneous calls.

## Deliverables

- Verification pass in `src/search.ts`.
- Tests TC-027..TC-031, TC-048, TC-049, TC-050.

## Notes

The kit performs NO YAML/JSON parsing — interpretation is entirely the host
callback (keeps the toolkit framework-agnostic). Depends on Task-001's candidates.
