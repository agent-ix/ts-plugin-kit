---
type: master-requirements
name: ts-plugin-kit
org: agent-ix
component_type: node-library
tags:
  - typescript
  - plugin-system
  - marketplace
  - git
  - zero-dependency
implementation_language: typescript
depends_on: []
# Zero-dependency leaf: consumes nothing. It is consumed BY ix-cli-core and
# quoin (see their specs), so no outgoing relationship is declared here.
relationships: []
standards_alignment:
  - iso-iec-ieee-29148
  - ieee-828
title: "Master Requirements Specification"
---

# Master Requirements Specification

## ts-plugin-kit — Framework-Agnostic Plugin / Marketplace Toolkit

---

## 1. Purpose

This document defines the **scope, intent, and governing requirements framework**
for `@agent-ix/ts-plugin-kit`.

It establishes:

- The problem space addressed by the shared plugin/marketplace install toolkit
- The boundary between this leaf library and any host that embeds it
- The authoritative structure for requirements, verification, and change control
- The contract that keeps the library framework-agnostic and dependency-free

`@agent-ix/ts-plugin-kit` is the **install mechanism** shared by Agent IX CLIs
and any other host (the `ix` CLI, `quoin`, a future desktop app). It knows
nothing about oclif, Filament, or any particular plugin payload: a host supplies
a `readName` callback and a target directory and decides what to do with the
resolved files. The IX-specific adapter that wires this library into oclif and
the ix-cli-core runtime is specified in
[`ix://agent-ix/ix-cli-core`](https://github.com/agent-ix/ix-cli-core) (its
`FR-019`); this document governs only the leaf toolkit.

This document is the **top-level requirements artifact** for the repository.

---

## 2. Scope

### 2.1 In Scope

Scope: **A zero-dependency, synchronous, framework-agnostic toolkit for resolving
typed plugin sources, pinning them by ref/sha, recording installs in a registry,
and reconciling a manifest's default set into a host-owned target directory.**

This specification governs:

- **Typed `Source` union and validation** — the `github` / `git-subdir` / `git` /
  `path` source descriptors (implemented) and the reserved `npm` / `url`
  descriptors, `normalizeSource` structural validation, and the `toGitUrl`
  `owner/repo` shorthand expansion ([FR-001](./functional/FR-001-typed-source-union.md), [FR-002](./functional/FR-002-git-url-shorthand.md)).
- **Marketplace manifest validation** — `MarketplaceManifest` / `MarketplaceEntry`
  shapes and `validateMarketplaceManifest`, which validates a host-parsed plain
  object (the host owns YAML/JSON parsing, keeping this library dep-free) ([FR-003](./functional/FR-003-manifest-validation.md)).
- **Source resolution** — `resolveSource`, a synchronous, `git`-only fetcher that
  blobless-clones, sparse-checks-out subdirs, checks out a sha/ref/HEAD, returns a
  durable `{dir, sha, ref}` pin, and throws `UnsupportedSourceError` for reserved
  types; the `GitRunner` is injectable for testing ([FR-004](./functional/FR-004-source-resolution.md)).
- **Install registry** — `InstalledPlugin` / `PluginRegistry`, `readRegistry` /
  `writeRegistry` (atomic temp+rename), and `upsertPlugin` (last-write-wins by
  name) ([FR-005](./functional/FR-005-install-registry.md)).
- **Single-entry install** — `installEntry`: resolve → materialize (`copy` default
  or `symlink`) into `<targetRoot>/<name>` → upsert the registry; the name comes
  from `entry.name` or the host `readName` callback ([FR-006](./functional/FR-006-single-entry-install.md)).
- **Default-set reconciliation** — `reconcile`, with a `lazy` hot path (install
  only what is missing or repinned, **zero git when settled**) and a `sync` path
  (re-resolve all, detect drift), returning `{installed, unchanged, updated,
skipped}`; `defaultEnabled:false` entries are skipped ([FR-007](./functional/FR-007-reconcile.md)).

### 2.2 Out of Scope

This specification does not govern:

- **YAML / JSON parsing.** The host parses manifest text and passes a plain
  object to `validateMarketplaceManifest`; this library adds no parser dependency.
- **`npm` and `url` source resolution.** The `npm` and `url` descriptors exist in
  the type so hosts can build install specs (e.g. an oclif `plugins:install`
  bridge), but their resolution is deliberately deferred — `resolveSource` throws
  `UnsupportedSourceError` ([FR-004](./functional/FR-004-source-resolution.md)).
- **What a "name" means.** The library never inspects payload contents to derive a
  module name; the host supplies a `readName(dir)` callback ([FR-006](./functional/FR-006-single-entry-install.md)).
- **What the materialized files are for.** The library copies/symlinks bytes into
  the target dir and records the install; interpreting those bytes (oclif plugin,
  Filament module, schema bundle) is the host's concern.
- **The oclif / ix-cli-core adapter.** Cache-root derivation, the oclif
  `plugins:install` bridge, and runtime wiring live in
  `ix://agent-ix/ix-cli-core` (its FR-019), not here.
- **Asynchronous or networked transport** beyond the synchronous `git` subprocess.

---

## 3. System Overview

### 3.1 System Description

`@agent-ix/ts-plugin-kit` is a single publishable TypeScript library (npm package
`@agent-ix/ts-plugin-kit`) with **zero runtime dependencies**. It exposes the
building blocks below as pure ES-module functions; every operation is synchronous
and `git` (via `execFileSync`) is the only side effect.

| Module         | Responsibility                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `sources.ts`   | `Source` union, `SourceType`, `SourceError`, `UnsupportedSourceError`, `normalizeSource`, `toGitUrl` |
| `manifest.ts`  | `MarketplaceEntry`, `MarketplaceManifest`, `ManifestError`, `validateMarketplaceManifest`            |
| `resolve.ts`   | `GitRunner`, `defaultGitRunner`, `ResolveOptions`, `ResolvedSource`, `resolveSource`                 |
| `registry.ts`  | `InstalledPlugin`, `PluginRegistry`, `readRegistry`, `writeRegistry`, `upsertPlugin`                 |
| `install.ts`   | `InstallOptions`, `installEntry`                                                                     |
| `reconcile.ts` | `ReconcileOptions`, `ReconcileResult`, `reconcile`                                                   |
| `index.ts`     | The public barrel re-exporting the above                                                             |

### 3.2 Intended Users

- **Host CLI authors** embedding the toolkit to acquire data/command plugins (the
  `ix` CLI via `ix-cli-core`, `quoin`, future apps).
- **Marketplace authors** who publish a `MarketplaceManifest` describing a default
  set of plugin sources.
- **Developers** whose plugin installs the toolkit pins, materializes, and records.

---

## 4. Requirements Architecture

Artifacts are organized by class in flat per-class directories:

```
spec/
├── spec.md                     # This document
├── stakeholder/                # StR-XXX  (cross-cutting needs)
├── usecase/                    # US-XXX   (usage scenarios)
├── functional/                 # FR-XXX   (testable behavioral contracts)
├── non-functional/             # NFR-XXX  (quality constraints)
└── tests.md                    # Requirements ↔ tests mapping (AC → TC)
```

---

## 5. Requirement Classes

### 5.1 Stakeholder Requirements (`StR-XXX`)

Authoritative needs from host CLI authors and marketplace authors: a shared,
framework-agnostic, dependency-free install mechanism; deterministic ref/sha
pinning; and a fast per-invocation reconcile.

### 5.2 User Stories (`US-XXX`)

Usage scenarios describing host intent when reconciling a default set and when
installing an ad-hoc, unnamed source.

### 5.3 Functional Requirements (`FR-XXX`)

Testable behavioral contracts for source typing/validation, URL shorthand
expansion, manifest validation, source resolution, the install registry,
single-entry install, and default-set reconciliation.

### 5.4 Non-Functional Requirements (`NFR-XXX`)

Quality constraints: zero runtime dependencies, 100% enforced test coverage,
synchronous git-as-sole-side-effect with a zero-git settled hot path, and
cache/target directory isolation.

---

## 6. Requirement Identification

| Artifact                   | Format      | Example                                                               |
| -------------------------- | ----------- | --------------------------------------------------------------------- |
| Stakeholder Requirement    | `StR-XXX`   | [StR-001](./stakeholder/StR-001-shared-zero-dep-install-mechanism.md) |
| User Story                 | `US-XXX`    | [US-001](./usecase/US-001-reconcile-default-set.md)                   |
| Functional Requirement     | `FR-XXX`    | [FR-004](./functional/FR-004-source-resolution.md)                    |
| Non-Functional Requirement | `NFR-XXX`   | [NFR-001](./non-functional/NFR-001-zero-runtime-dependencies.md)      |
| Acceptance Criteria        | `{FR}-AC-N` | [FR-004-AC-1](./functional/FR-004-source-resolution.md)               |
| Test Case                  | `TC-XXX`    | `TC-021`                                                              |

Identifiers are immutable once assigned. IDs in this repo are a flat per-repo
sequence (no classifier prefix).

### 6.1 Requirement Index

| ID                                                                    | Title                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| [StR-001](./stakeholder/StR-001-shared-zero-dep-install-mechanism.md) | Shared Framework-Agnostic, Zero-Dependency Install Mechanism |
| [StR-002](./stakeholder/StR-002-deterministic-pinning.md)             | Deterministic Plugin Pinning and Reproducible Installs       |
| [StR-003](./stakeholder/StR-003-fast-reconciliation.md)               | Fast Per-Invocation Reconciliation                           |
| [US-001](./usecase/US-001-reconcile-default-set.md)                   | Reconcile a Default Plugin Set                               |
| [US-002](./usecase/US-002-install-ad-hoc-source.md)                   | Install an Ad-Hoc Source and Derive Its Name                 |
| [FR-001](./functional/FR-001-typed-source-union.md)                   | Typed Source Union and Structural Validation                 |
| [FR-002](./functional/FR-002-git-url-shorthand.md)                    | Git URL Shorthand Expansion                                  |
| [FR-003](./functional/FR-003-manifest-validation.md)                  | Marketplace Manifest Validation                              |
| [FR-004](./functional/FR-004-source-resolution.md)                    | Synchronous Source Resolution and Pinning                    |
| [FR-005](./functional/FR-005-install-registry.md)                     | Install Registry: Read, Atomic Write, and Upsert             |
| [FR-006](./functional/FR-006-single-entry-install.md)                 | Single-Entry Install and Materialization                     |
| [FR-007](./functional/FR-007-reconcile.md)                            | Default-Set Reconciliation (Lazy and Sync)                   |
| [NFR-001](./non-functional/NFR-001-zero-runtime-dependencies.md)      | Zero Runtime Dependencies                                    |
| [NFR-002](./non-functional/NFR-002-full-test-coverage.md)             | One-Hundred-Percent Enforced Test Coverage                   |
| [NFR-003](./non-functional/NFR-003-synchronous-zero-git-hot-path.md)  | Synchronous Resolution with a Zero-Git Settled Hot Path      |
| [NFR-004](./non-functional/NFR-004-cache-target-isolation.md)         | Cache and Target Directory Isolation                         |

---

## 7. Requirement Quality Policy

All functional requirements SHALL:

- Define observable behavior
- Be unambiguous and atomic
- Be testable through explicit criteria
- Be free of references to any specific host binary or plugin payload (those
  concerns belong to the consuming host's spec)

---

## 8. Source and Pinning Model

### 8.1 Source Descriptors

A plugin/marketplace `source` is a discriminated union keyed by `type` ([FR-001](./functional/FR-001-typed-source-union.md)):

| `type`       | Fields                             | Resolution                                                                      |
| ------------ | ---------------------------------- | ------------------------------------------------------------------------------- |
| `github`     | `repo`, `ref?`, `sha?`             | `owner/repo` shorthand → git clone at pin                                       |
| `git-subdir` | `url`, `path`, `ref?`, `sha?`      | git clone with sparse-checkout of `path` at pin                                 |
| `git`        | `url`, `ref?`, `sha?`              | git clone of the whole repo at pin                                              |
| `path`       | `path`                             | local directory (dev); returned as-is                                           |
| `url`        | `url`, `ref?`, `sha?`              | **reserved** — `UnsupportedSourceError`                                         |
| `npm`        | `package`, `version?`, `registry?` | **reserved** — `UnsupportedSourceError` (hosts may build install specs from it) |

`normalizeSource` validates that the required string fields of each variant are
non-empty, throwing `SourceError` on malformed input ([FR-001](./functional/FR-001-typed-source-union.md)). `toGitUrl` passes
full URLs (`://` or `git@`) through unchanged and expands an `owner/repo`
shorthand to `https://github.com/owner/repo.git` ([FR-002](./functional/FR-002-git-url-shorthand.md)).

### 8.2 Pinning and Determinism

`resolveSource` records a **durable commit sha** as the pin for every git source,
in addition to echoing back the requested `ref` ([FR-004](./functional/FR-004-source-resolution.md)). Resolution checks out
`source.sha ?? source.ref ?? "HEAD"` in that precedence. Because the resolved sha
is persisted in the registry record, drift can be detected (sync mode) and a
settled lazy reconcile can short-circuit with no git at all ([FR-007](./functional/FR-007-reconcile.md), [NFR-003](./non-functional/NFR-003-synchronous-zero-git-hot-path.md)).

---

## 9. Install and Reconcile Model

### 9.1 Materialization

`installEntry` resolves a source, computes the content root
(`entry.path`-relative when given), derives the install `name`
(`entry.name ?? readName(contentRoot)`), and materializes that content root into
`<targetRoot>/<name>` ([FR-006](./functional/FR-006-single-entry-install.md)). Materialization mode is `copy` (default — owned
files) or `symlink` (points at the cache); an existing target is removed first so
re-installs are clean. The install is then recorded in the registry via
`upsertPlugin` + `writeRegistry`.

### 9.2 Reconciliation

`reconcile` walks a manifest's entries and, per entry ([FR-007](./functional/FR-007-reconcile.md)):

- `defaultEnabled === false` → **skipped** (recorded, never resolved).
- **lazy mode**, entry already present in the registry, its target dir still
  exists, and its pin matches → **unchanged**, with **no git invocation**.
- otherwise → `installEntry` runs; a previously-absent entry is **installed**, and
  an existing one is **updated** (or, in `sync` mode with an identical resolved
  sha, **unchanged**).

Pin matching prefers `sha` (exact) and otherwise compares the requested `ref`.

### 9.3 Directory Roles

The **cache root** (`<cacheRoot>/git/<key>`, where `<key>` is the sanitized URL)
holds clones, and the **target root** (`<targetRoot>/<name>`) holds materialized
modules; the **registry path** is a separate JSON file. These three are distinct
host-supplied paths and SHALL NOT collide with each other or with a host's own
plugin data dir ([NFR-004](./non-functional/NFR-004-cache-target-isolation.md)).

---

## 10. Error and Failure Model

- `SourceError` — a structurally invalid source descriptor, or a `path` source
  whose directory does not exist ([FR-001](./functional/FR-001-typed-source-union.md), [FR-004](./functional/FR-004-source-resolution.md)).
- `UnsupportedSourceError` — a valid-but-reserved `url` / `npm` source passed to
  `resolveSource` ([FR-004](./functional/FR-004-source-resolution.md)).
- `ManifestError` — a malformed manifest object or entry passed to
  `validateMarketplaceManifest` ([FR-003](./functional/FR-003-manifest-validation.md)).
- A missing or **shape-invalid** registry file (valid JSON whose `plugins` is not
  an array, e.g. `{}`) reads as an **empty** registry rather than throwing ([FR-005](./functional/FR-005-install-registry.md)).
  A registry file that is not valid JSON currently throws from the unguarded
  `JSON.parse`; the atomic write below exists to avoid producing such a file.
- The registry is written atomically (temp file named `<path>.<pid>.tmp`, then
  `rename`) so a crash mid-write never leaves a partial registry ([FR-005](./functional/FR-005-install-registry.md)).
- **Git subprocess failures propagate.** `resolveSource` runs git via
  `execFileSync` (the default `GitRunner`), which throws on any nonzero git exit —
  a clone of an unreachable/private repo, a fetch failure, or a checkout of a
  ref/sha that does not exist. These are surfaced as the underlying thrown error,
  not wrapped in a `SourceError` ([FR-004](./functional/FR-004-source-resolution.md)). The library defines no `ResolveError`
  type today; see §14 Known Limitations.
- **Materialization is not crash-atomic.** `installEntry` removes an existing
  target before re-creating it (copy or symlink); if the create then fails, the
  prior materialized module is gone ([FR-006](./functional/FR-006-single-entry-install.md)). Only the registry write is atomic.

---

## 11. Traceability

Bidirectional traceability SHALL be maintained between:

- Stakeholder Requirements → User Stories / Functional Requirements
- Functional Requirements → Acceptance Criteria → Test Cases (see `tests.md`)

---

## 12. Verification Strategy

- Unit tests (vitest) in `tests/index.test.ts` exercise source validation, URL
  expansion, manifest validation, resolution against a local bare git fixture
  (blobless clone, sparse-checkout, ref/sha/HEAD checkout, re-fetch), registry
  read/write/upsert, install/materialize (copy and symlink), and lazy/sync
  reconcile including the zero-git settled path.
- An injectable `GitRunner` lets resolution tests run without a real network and
  assert the exact git argv.
- Coverage is gated at 100% (branches, functions, lines, statements) in
  `vite.config.ts` ([NFR-002](./non-functional/NFR-002-full-test-coverage.md)).

---

## 13. Traceability Addressing Convention

Cross-references in artifact `relationships` frontmatter and in `tests.md` address
requirements by their **ID**, not by their slug filename. A target such as
[FR-004](./functional/FR-004-source-resolution.md) resolves to the file
[FR-004](./functional/FR-004-source-resolution.md) (the file whose frontmatter `id` is [FR-004](./functional/FR-004-source-resolution.md)).
This matches the addressing used across the IX spec ecosystem (e.g.
`ix://agent-ix/ix-cli-core/.../FR-019`). Tools resolve ID → file; the slug in the
filename is descriptive only.

---

## 14. Known Limitations (Backsync Notes)

These are **observations of current code behavior**, recorded so the spec does not
over-claim. They are candidate hardening items, not yet-specced requirements; the
present requirements describe the library as it actually behaves.

- **Git failures are unwrapped.** `resolveSource` does not catch `execFileSync`
  errors; a failed clone/fetch/checkout throws the raw Node subprocess error. A
  `git-subdir` whose subdir is absent at the resolved ref returns a `dir` that does
  not exist on disk, and the failure surfaces later in `installEntry`'s copy/symlink.
- **Malformed-JSON registry throws.** `readRegistry` tolerates a shape-invalid but
  valid-JSON file; a non-JSON file throws `SyntaxError` ([FR-005](./functional/FR-005-install-registry.md)).
- **Non-atomic materialization.** A failed re-install can leave no module
  (§10, [FR-006](./functional/FR-006-single-entry-install.md)).
- **Cache-key collisions.** `cacheKey` replaces every non-`[A-Za-z0-9._-]` char with
  `_`, so two distinct URLs can map to one cache dir; there is no collision check.
- **Symlink installs are not pin-stable.** In `symlink` mode the target points into
  the single mutable per-URL cache worktree; a later checkout of a different ref in
  that cache changes what the symlink sees (the `copy` default is pin-stable).
- **No concurrency control.** `readRegistry`→`upsertPlugin`→`writeRegistry` is a
  read-modify-write with no lock; concurrent installs can lose updates. The
  `<pid>` in the temp name disambiguates processes but not intra-process races.
- **Lazy reconcile does not chase `HEAD`.** An entry with neither `sha` nor `ref`
  matches as `unchanged` on every subsequent lazy reconcile (`undefined === undefined`)
  and is never re-resolved in `lazy` mode; use `sync` mode to re-resolve ([FR-007](./functional/FR-007-reconcile.md)).
- **Unbounded `defaultEnabled`.** Only the literal `false` skips an entry; any other
  value (including `undefined`, the documented default) enables it ([FR-007](./functional/FR-007-reconcile.md)).

---

## 15. References

- ISO/IEC/IEEE 29148 — Requirements Engineering
- IEEE 828 — Configuration Management
- Git documentation — partial clone (`--filter=blob:none`) and `sparse-checkout`
  (`git-clone(1)`, `git-sparse-checkout(1)`)
- `ix://agent-ix/ix-cli-core` — the IX adapter (FR-019) that consumes this library
- Vitest — unit test + coverage runner
