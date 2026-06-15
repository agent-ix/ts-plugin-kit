---
id: StR-001
title: "Shared Framework-Agnostic, Zero-Dependency Install Mechanism"
artifact_type: StR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "satisfied_by"
    cardinality: "1:N"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-003"
    type: "satisfied_by"
    cardinality: "1:N"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-006"
    type: "satisfied_by"
    cardinality: "1:N"
---

## Description

Multiple Agent IX hosts (the `ix` CLI via `ix-cli-core`, `ix-spec`, future apps)
each need to acquire plugin/marketplace content from git and other sources. Those
hosts SHALL share **one** install mechanism rather than each reimplementing
fetch, pin, materialize, and registry logic, and that mechanism SHALL remain
framework-agnostic (no knowledge of oclif, Filament, or any payload shape) and
free of runtime dependencies so it can be embedded anywhere without supply-chain
or framework cost.

## Body

**Rationale.** A bespoke installer per host duplicates subtle logic (blobless
clones, sparse checkout, sha pinning, atomic registry writes) and drifts between
hosts. Centralizing it in a leaf library keeps every host consistent and lets the
mechanism be tested once to a high bar. Keeping it dependency-free and
framework-agnostic is what makes it embeddable: the library never parses YAML
(the host passes a parsed object), never names a payload (the host supplies a
`readName` callback), and never assumes a CLI framework.

**Context.** The library is consumed as `@agent-ix/ts-plugin-kit`. The IX-specific
wiring (cache-root derivation, the oclif `plugins:install` bridge) lives in
`ix://agent-ix/ix-cli-core` FR-019, which adapts but does not reimplement this
library.

**Success Indicators.**

- A host can install a git/path source and reconcile a manifest without adding any
  transitive runtime dependency through this library.
- The library compiles and runs without referencing oclif, Filament, or YAML.
- The host, not the library, decides how a resolved directory becomes a "name".

## Dependencies

- Satisfied by FR-001 (typed sources), FR-003 (manifest validation against a
  host-parsed object), and FR-006 (host-supplied `readName`), which together keep
  the library framework-agnostic and dependency-free.
- The zero-runtime-dependency property is constrained by NFR-001.
