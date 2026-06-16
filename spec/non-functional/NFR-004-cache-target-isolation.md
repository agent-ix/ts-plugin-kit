---
id: NFR-004
title: "Cache and Target Directory Isolation"
type: NFR
quality_attribute: reliability
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "constrains"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-006"
    type: "constrains"
    cardinality: "1:1"
---

## Statement

The cache directory (where sources are cloned), the target directory (where
modules are materialized), and the registry file SHALL be **three distinct
host-supplied paths**. The library SHALL place clones under `<cacheRoot>/git/`
and materialized modules under `<targetRoot>/<name>`, and SHALL NOT write a
materialized module into the cache root or write the registry into the target
tree. This keeps the toolkit's storage from colliding with a host's own plugin
data dir (for example, an oclif plugin data dir).

## Measurement and Evaluation

| Metric                                                          | Target | Threshold | Method     |
| --------------------------------------------------------------- | ------ | --------- | ---------- |
| Distinct option fields for cache / target / registry            | 3      | 3         | Inspection |
| Cross-writes from cache root into target root (or vice versa)   | 0      | 0         | Analysis   |
| Tests using independent `cacheRoot`/`targetRoot`/`registryPath` | all    | all       | Test       |

## Verification

- Inspect `InstallOptions`/`ResolveOptions`: `cacheRoot`, `targetRoot`, and
  `registryPath` are three separate fields the host supplies.
- `resolveSource` writes clones only under `<cacheRoot>/git/<key>`; `installEntry`
  materializes only under `<targetRoot>/<name>` and writes the registry only at
  `registryPath` — confirmed by code analysis.
- The test harness constructs `cacheRoot`, `targetRoot`, and `registryPath` as
  separate subpaths of a fresh temp root for every case, and installs/reconciles
  succeed without overlap (FR-006, FR-007 test cases).
