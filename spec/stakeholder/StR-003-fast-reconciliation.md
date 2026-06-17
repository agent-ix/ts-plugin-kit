---
id: StR-003
title: "Fast Per-Invocation Reconciliation"
type: StR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-007"
    type: "satisfied_by"
    cardinality: "1:1"
---

## Stakeholder Need

A host CLI reconciles its default plugin set on **every invocation**. Reconciling
an already-settled set SHALL be cheap enough to run on the per-command hot path:
when nothing has changed, reconciliation SHALL perform **no git operation at all**
and SHALL report each settled entry as unchanged.

## Rationale

If reconciling a settled set re-cloned or re-fetched, every CLI command would pay
a network/subprocess cost, which is unacceptable for an interactive tool. The
default (`lazy`) reconcile must therefore be a near-free no-op when the registry
already records each enabled entry, the target directory still exists, and the
recorded pin matches the manifest. A separate, explicit `sync` mode is available
when the host actually wants to re-resolve and check for drift.

`reconcile` defaults to `lazy`. In lazy mode an entry that is present and
pin-matched short-circuits before any `GitRunner` call. The test fixture asserts
that the second reconcile of a settled manifest issues **zero** git calls.

## Validation Criteria

This need is considered satisfied when:

- The second lazy reconcile of an unchanged manifest performs zero git operations
  and reports every enabled entry as unchanged.
- A disabled (`defaultEnabled:false`) entry is skipped without resolution.
- A re-pinned or vanished entry is re-installed without forcing a full re-resolve
  of the rest.

## Dependencies

- Satisfied by FR-007 (lazy/sync reconcile with the zero-git settled path).
- The zero-git hot-path property is constrained by NFR-003.
