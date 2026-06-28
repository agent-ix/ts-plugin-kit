---
id: NFR-003
title: "Synchronous Resolution with a Zero-Git Settled Hot Path"
type: NFR
quality_attribute: performance_efficiency
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "constrains"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-007"
    type: "constrains"
    cardinality: "1:1"
---

## Statement

All operations SHALL be **synchronous**, with a per-source package-manager
subprocess — `git` (via `GitRunner`) and, for npm sources, `npm pack` + `tar` (via
`NpmFetcher`) — as the only external side effect; the library SHALL NOT introduce
async/Promise APIs or any other network calls. A `lazy` reconcile of an
already-settled manifest SHALL perform **zero** git invocations so it is safe on a
per-CLI-invocation hot path.

## Measurement and Evaluation

| Metric                                                                 | Target | Threshold | Method     |
| ---------------------------------------------------------------------- | ------ | --------- | ---------- |
| Git invocations on a 2nd lazy reconcile of a settled manifest          | 0      | 0         | Test       |
| Promise-returning functions in the public API                          | 0      | 0         | Inspection |
| External side effects in `resolveSource` beyond `git`/`npm pack`+`tar` | 0      | 0         | Analysis   |

## Verification

- The reconcile test counts `GitRunner` calls; the second lazy reconcile of a
  settled manifest asserts the count is exactly `0` ([FR-007-AC-2](../functional/FR-007-reconcile.md)).
- Inspect the public API in `src/index.ts`: every exported function is synchronous
  (no `async`, no `Promise<...>` return types).
- `resolveSource` performs only filesystem reads/dir creation and the per-source
  package-manager subprocess (`git`; or `npm pack` + `tar` for npm sources); with
  an injected fake `GitRunner` it resolves git sources with no real git
  ([FR-004-AC-7](../functional/FR-004-source-resolution.md)), and with an injected
  fake `NpmFetcher` it resolves npm sources with no real `npm`/network
  ([FR-004-AC-8](../functional/FR-004-source-resolution.md)).
