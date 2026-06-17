---
id: US-001
title: "Reconcile a Default Plugin Set"
type: US
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-003"
    type: "traces_to"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-007"
    type: "satisfied_by"
    cardinality: "1:1"
---

## Story

**As a** host CLI author
**I want** to reconcile a marketplace manifest's default set into a target
directory on each run
**So that** the enabled plugins are present and correctly pinned without paying a
git cost when nothing has changed.

## Body

**Approach.** The host parses its manifest YAML/JSON, calls
`validateMarketplaceManifest(parsed)` to get a typed `MarketplaceManifest`, then
calls `reconcile(manifest, opts)` with `cacheRoot`, `targetRoot`, `registryPath`,
and a `readName` callback. The default `lazy` mode installs only what is missing
or repinned and reports the rest as unchanged; passing `mode: "sync"` re-resolves
everything to detect drift. The host inspects the returned
`{installed, unchanged, updated, skipped}`.

**Acceptance Criteria (informative).**

- **US-001-AC-1**: Given a manifest with one enabled and one disabled entry, when
  the host runs a first lazy reconcile, then the enabled entry is installed and the
  disabled one is skipped.
- **US-001-AC-2**: Given an already-reconciled manifest, when the host runs a
  second lazy reconcile, then every enabled entry is reported as unchanged and no
  git operation is performed.
- **US-001-AC-3**: Given a manifest whose entry has been repinned to a newer tag,
  when the host runs a sync reconcile, then that entry is reported as updated.

**Constraints (informative).** The host owns YAML parsing and the meaning of a
module name (via `readName`); the library owns fetch, pin, materialize, and the
registry.

## Dependencies

- Traces to StR-003 (fast per-invocation reconciliation).
- Satisfied by FR-007 (reconcile).
