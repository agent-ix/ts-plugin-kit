---
id: Task-004
title: "FR-010 TTL cache + createPluginSearch factory"
type: Task
status: todo
track: B
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-010
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-001
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-003
    type: depends_on
---

# Task-004: FR-010 TTL cache + createPluginSearch factory

## Scope

Add the generic injectable-clock TTL cache and the `createPluginSearch` factory
that wraps the full search+verify pipeline, holding cache + rate state across calls.

## Subtasks

- [ ] Write Vitest specs FIRST (injected `Clock`): TC-032 (return before expiry, evict after clock advances),
      TC-033 (`max` evicts oldest), TC-034 (cache hit → no `HttpFetcher` call), TC-035 (`invalidate(opts)`
      re-fetches; `invalidate()` clears all), TC-036 (late-bound `githubToken` resolved per call, no stale
      hit under previous token-id), TC-051 (errored/rate-limited response NOT cached), TC-052
      (verifier-presence + token-id discriminate entries).
- [ ] Implement `Clock`, `systemClock`, `createTtlCache({ttlMs, clock?, max?})` with `get/set/delete/clear/size`.
- [ ] Implement `createPluginSearch(deps)` → `{ search, invalidate, lastRate }`; cache key
      `tag|query|sources|limit|verifier-present|token-id` (token-id is a non-secret discriminator, never the raw token).
- [ ] Cache only responses whose `errors` is empty; resolve a function-valued `githubToken` per call.

## Deliverables

- `createTtlCache`, `Clock`/`systemClock`, `createPluginSearch` in `src/search.ts`.
- Tests TC-032..TC-036, TC-051, TC-052.

## Notes

Not caching errored responses is what preserves the FR-011 resume-after-`resetAt`
behavior (Task-005). Depends on the search (Task-001) + verify (Task-003) pipeline
it wraps.
