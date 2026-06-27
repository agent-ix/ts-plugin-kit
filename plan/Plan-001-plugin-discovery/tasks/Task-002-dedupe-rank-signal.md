---
id: Task-002
title: "FR-008 dedupe, total-order rank, signal propagation, token redaction"
type: Task
status: todo
track: A
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-008
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-001
    type: depends_on
---

# Task-002: FR-008 dedupe, rank, signal, token redaction

## Scope

Complete `searchPlugins` with cross-backend dedupe, a deterministic total-order
ranking, `AbortSignal` propagation, and the token-redaction guarantee.

## Subtasks

- [ ] Write Vitest specs FIRST: TC-026 (npm vs github of same project collapse, npm preferred, carries
      repo stars/updatedAt), TC-046 (total-order rank — absent stars/updatedAt sort last, `fullName`
      tie-break), TC-047 (`signal` passed to every fetch; abort → backend error, resolved results kept),
      TC-054 (token never in cache key, error, or result).
- [ ] Implement URL normalization for dedupe (lowercase host/owner/repo; strip `git+`, scheme, trailing
      `/`, `.git`); prefer the npm entry and copy the matched repo's `stars`/`updatedAt` onto it.
- [ ] Implement ranking: `stars` desc → `updatedAt` desc → `fullName` asc (absent values lowest).
- [ ] Thread `opts.signal` into every `HttpFetcher` call; map an abort to a `SearchBackendError`.
- [ ] Ensure `githubToken` never appears in cache keys, `SearchBackendError` messages, or results (CON-2).

## Deliverables

- Dedupe + ranking + signal + redaction in `src/search.ts`.
- Tests TC-026, TC-046, TC-047, TC-054.

## Notes

Ranking must be a total order so the 100% gate has a deterministic result order to
assert. Depends on Task-001's normalized candidate results.
