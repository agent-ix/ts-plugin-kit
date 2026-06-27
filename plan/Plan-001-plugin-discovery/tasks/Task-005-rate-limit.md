---
id: Task-005
title: "FR-011 GitHub rate-limit surfacing + short-circuit"
type: Task
status: todo
track: B
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-011
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-001
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-004
    type: depends_on
---

# Task-005: FR-011 GitHub rate-limit surfacing + short-circuit

## Scope

Read GitHub rate-limit headers into `rate.github`, surface an exhausted window as a
`SearchBackendError` (never throw, never sleep), and short-circuit further GitHub
requests through `createPluginSearch` while the window is exhausted.

## Subtasks

- [ ] Write Vitest specs FIRST (injected `Clock` + fake fetcher): TC-037 (200 headers populate `rate.github`),
      TC-038 (`403`/`429` + `remaining:0` → `SearchBackendError{rateLimited:true}` + reset, no throw),
      TC-039 (exhausted window → next `search` skips GitHub while clock < `resetAt`), TC-040 (clock past
      `resetAt` → GitHub re-issued), TC-053 (first call, no prior snapshot → GitHub issued; `lastRate()` empty).
- [ ] Parse `x-ratelimit-limit|remaining|reset` (present on 200 and 403); store `resetAt` as epoch-seconds.
- [ ] Compare `clock.now()/1000 < resetAt` for the short-circuit; emit the rate-limited error in `errors`.
- [ ] Guard the first-call (undefined `lastRate().github`) path so it does not short-circuit.
- [ ] No sleep/delay primitive — behavior is a pure function of inputs + the injected clock.

## Deliverables

- Rate-limit parsing + short-circuit in `src/search.ts`.
- Tests TC-037..TC-040, TC-053.

## Notes

Cooperates with Task-004's retained rate state. `resetAt` is epoch-seconds while
`clock.now()` is ms — the `/1000` conversion is the unit bridge.
