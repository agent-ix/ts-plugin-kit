---
id: Task-007
title: "Re-export discovery surface + quality gates"
type: Task
status: done
track: S
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-001
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-002
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-003
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-005
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-002
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-003
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-004
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-005
    type: depends_on
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-006
    type: depends_on
---

# Task-007: Re-export discovery surface + quality gates

## Scope

Wire the discovery surface into the public barrel and pass every quality gate.

## Subtasks

- [ ] Re-export from `src/index.ts`: `HttpFetcher`, `HttpResponse`, `defaultHttpFetcher`, `searchPlugins`,
      all discovery result/option/error types, `SearchError`, `Clock`, `systemClock`, `TtlCache`,
      `TtlCacheOptions`, `createTtlCache`, `PluginSearch`, `PluginSearchDeps`, `createPluginSearch`,
      `sourceToInstallInput`.
- [ ] Verify `vite.config.ts` `external` needs no change (global `fetch`, no new import) and `package.json`
      `dependencies` stays empty (NFR-001).
- [ ] Confirm the resolution surface stays synchronous (NFR-003) and only the discovery exports are async.
- [ ] `make test` at the 100% coverage gate over `src/**` incl. `src/search.ts` (NFR-002).
- [ ] `make lint` clean; `quire validate --scope . "spec/**/*.md" "plan/**/*.md"` clean.

## Deliverables

- Updated `src/index.ts`; green `make test` (100%), `make lint`, and quire validation.

## Notes

The spec-side NFR-001/NFR-003/`spec.md` reconciliation already landed during review;
this task verifies the code matches those claims. Gates Task-008.
