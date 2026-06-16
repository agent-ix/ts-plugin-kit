---
id: StR-002
title: "Deterministic Plugin Pinning and Reproducible Installs"
type: StR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "satisfied_by"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-005"
    type: "satisfied_by"
    cardinality: "1:1"
---

## Description

A host that installs a plugin from git SHALL be able to reproduce exactly the
same content later and SHALL be able to detect when a moving reference (tag or
branch) has changed underneath it. Every resolved install SHALL therefore be
pinned to a **durable commit sha**, and that pin SHALL be persisted so a later
run can compare against it.

## Body

**Rationale.** Tags and branches move; "install the latest" is not reproducible. A
host pinning to a tag still needs to know the concrete commit it got, both to
reproduce a build and to decide whether anything changed since last time. A
recorded sha turns "did this plugin change?" into a string comparison rather than
a refetch, which is also what enables the fast settled reconcile (StR-003).

**Context.** Resolution checks out `sha ?? ref ?? HEAD` and returns
`{dir, sha, ref}`; the install registry persists `sha` (and the requested `ref`)
per installed plugin. Drift detection in `sync` mode and pin-matching in `lazy`
mode both rely on this recorded sha.

**Success Indicators.**

- Resolving a source pinned to a tag returns the concrete commit sha for that tag.
- Re-resolving the same sha yields the same content.
- A host can tell, from the registry alone, the exact commit each plugin is at.

## Dependencies

- Satisfied by FR-004 (resolution returns and records the durable sha) and FR-005
  (the registry persists the sha and requested ref per install).
