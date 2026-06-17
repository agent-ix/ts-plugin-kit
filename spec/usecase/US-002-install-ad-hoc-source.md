---
id: US-002
title: "Install an Ad-Hoc Source and Derive Its Name"
type: US
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "traces_to"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-006"
    type: "satisfied_by"
    cardinality: "1:1"
---

## Story

**As a** host CLI author
**I want** to install a single ad-hoc source whose name I do not know up front
**So that** the toolkit can fetch and pin it and derive its install name from the
resolved content using my own callback.

## Body

**Approach.** The host calls `installEntry(entry, opts)` with an entry that may
omit `name`. The library resolves the source, computes the content root
(applying `entry.path` when present), and — because `entry.name` is absent —
derives the name by calling the host's `readName(contentRoot)` (for example,
reading a `manifest.yaml`'s `name:` field). It materializes the content into
`<targetRoot>/<name>` (copy by default, or symlink) and records the install,
including the resolved sha and target path.

**Acceptance Criteria (informative).**

- **US-002-AC-1**: Given an entry with no `name`, when the host installs it, then
  the install name is the value `readName` returns for the resolved content root.
- **US-002-AC-2**: Given an entry with an explicit `name`, when the host installs
  it, then that name wins and `readName` is not consulted for naming.
- **US-002-AC-3**: Given `materialize: "symlink"`, when the host installs the
  entry, then the target is a symlink rather than a copy.

**Constraints (informative).** The library never inspects payload semantics to
name a module; naming is entirely the host's callback.

## Dependencies

- Traces to StR-001 (framework-agnostic mechanism: host supplies `readName`).
- Satisfied by FR-006 (single-entry install and materialization).
