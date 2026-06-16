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

All operations SHALL be **synchronous**, with the `git` subprocess (via
`GitRunner`) as the only external side effect; the library SHALL NOT introduce
async/Promise APIs or non-git network calls. A `lazy` reconcile of an
already-settled manifest SHALL perform **zero** git invocations so it is safe on a
per-CLI-invocation hot path.

## Measurement and Evaluation

| Metric                                                        | Target | Threshold | Method     |
| ------------------------------------------------------------- | ------ | --------- | ---------- |
| Git invocations on a 2nd lazy reconcile of a settled manifest | 0      | 0         | Test       |
| Promise-returning functions in the public API                 | 0      | 0         | Inspection |
| Non-git external side effects in `resolveSource`              | 0      | 0         | Analysis   |

## Verification

- The reconcile test counts `GitRunner` calls; the second lazy reconcile of a
  settled manifest asserts the count is exactly `0` (FR-007-AC-2).
- Inspect the public API in `src/index.ts`: every exported function is synchronous
  (no `async`, no `Promise<...>` return types).
- `resolveSource` performs only filesystem reads/dir creation and the injected
  `git` subprocess; with an injected fake `GitRunner` it resolves with no real git
  (FR-004-AC-7).
