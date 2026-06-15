---
id: FR-007
title: "Default-Set Reconciliation (Lazy and Sync)"
artifact_type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-006"
    type: "requires"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-005"
    type: "requires"
    cardinality: "1:1"
---

## Description

The library SHALL export `reconcile(manifest, opts)` which reconciles a manifest's
default set into `targetRoot` and returns a `ReconcileResult`
(`installed`, `unchanged`, `updated`, `skipped`). `ReconcileOptions` extends
`InstallOptions` with an optional `mode` (`"lazy"` default, or `"sync"`).

## Behavior

`reconcile` SHALL read the registry once, then for each manifest entry in order:

- **Disabled**: if `entry.defaultEnabled === false` (strict equality — **only** the
  literal `false` disables; `undefined`, the documented default, and any other value
  enable), push the entry to `skipped` and continue (no resolution, no git).
- Look up an existing registry record by `entry.name`. The entry is considered
  **present** when a record exists and its `targetPath` still exists on disk.
- **Lazy short-circuit**: in `lazy` mode, if the entry is present and its pin
  matches (sha-exact when the source has a `sha`, else requested-`ref` equality),
  push the existing record to `unchanged` and continue — performing **no git
  invocation**. This is the settled hot path.
- **Otherwise**: call `installEntry(entry, opts)` (FR-006). If there was no
  existing record, push to `installed`. Else, in `sync` mode, if the freshly
  resolved sha equals the existing record's sha, push to `unchanged`; in all other
  cases push to `updated`.

In `sync` mode every non-disabled entry is re-resolved (so drift is detected),
whereas in `lazy` mode a present-and-pinned entry is never resolved.

**Pin-match precedence and the unpinned case.** `pinMatches` compares the recorded
`sha` exactly when the source carries a `sha`; otherwise it compares the requested
`ref` (`existing.ref === entry-ref`). When a source has **neither** `sha` nor `ref`
(it resolves to `HEAD`), both sides are `undefined`, so a previously-installed
unpinned entry matches as `unchanged` on every subsequent **lazy** reconcile and is
never re-resolved. Lazy mode therefore does **not** chase a moving `HEAD`; a host
that wants to re-resolve an unpinned source MUST use `sync` mode. (This is current
behavior, recorded as a Known Limitation in spec.md §14.)

**`sync`-`unchanged` is a classification, not a no-op.** A `sync` reconcile always
runs `installEntry` first (full re-resolve **and** re-materialization of the
target), and only then classifies the result as `unchanged` when the freshly
resolved sha equals the recorded one. "Unchanged" describes the outcome label, not
an absence of side effects.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                 | Verification  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| FR-007-AC-1 | A first lazy reconcile of a manifest with one enabled and one `defaultEnabled:false` entry yields one `installed` and one `skipped`, with at least one git call.         | Test (TC-018) |
| FR-007-AC-2 | A second lazy reconcile of the same settled manifest yields one `unchanged` and performs **zero** git calls.                                                             | Test (TC-018) |
| FR-007-AC-3 | A sync reconcile of an already-installed manifest at a stable ref yields one `unchanged`; re-running sync against the same name at a moved tag yields one `updated`.     | Test (TC-019) |
| FR-007-AC-4 | When the target dir of an installed entry is deleted, the next lazy reconcile re-materializes it and reports one `updated` (present := record exists AND target exists). | Test (TC-020) |
| FR-007-AC-5 | A lazy reconcile honors a `sha` pin: an unchanged sha yields `unchanged`; a different sha yields `updated`.                                                              | Test (TC-021) |

## Dependencies

- Implements StR-003 (fast per-invocation reconcile with a zero-git settled path).
- Requires FR-006 (`installEntry`) and FR-005 (registry read for the unchanged
  decision).
