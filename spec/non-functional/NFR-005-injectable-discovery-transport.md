---
id: NFR-005
title: "Injectable, Dependency-Free Discovery Transport"
type: NFR
quality_attribute: maintainability
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "constrains"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-009"
    type: "constrains"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-011"
    type: "constrains"
    cardinality: "1:1"
---

# [NFR-005] Injectable, Dependency-Free Discovery Transport

## Statement

The discovery surface SHALL perform all network access through a single injectable
`HttpFetcher` seam whose default delegates to the Node global `fetch`, so that the
toolkit adds no HTTP-client runtime dependency and every discovery test runs fully
offline against a supplied fake fetcher. Discovery is the only asynchronous,
networked surface in the library; it SHALL NOT introduce any other ambient side
effect.

## Scope

- Applies to: `searchPlugins`, `createPluginSearch`, and the manifest-fetching
  verification path ([FR-008](../functional/FR-008-candidate-search.md),
  [FR-009](../functional/FR-009-compatibility-verification.md),
  [FR-011](../functional/FR-011-github-rate-limit.md)).
- Distinct from the synchronous, git-only resolution surface governed by
  [NFR-003](./NFR-003-synchronous-zero-git-hot-path.md).

## Rationale

The pre-existing toolkit was synchronous with git as its sole side effect. Adding
discovery introduces async network I/O; bounding that I/O behind one injectable
seam keeps the zero-dependency guarantee
([NFR-001](./NFR-001-zero-runtime-dependencies.md)) intact, keeps the 100% coverage
gate ([NFR-002](./NFR-002-full-test-coverage.md)) achievable without live network,
and keeps results deterministic for tests.

## Measurement and Evaluation

| Metric                                                              | Target | Threshold | Method     |
| ------------------------------------------------------------------- | ------ | --------- | ---------- |
| Direct transport calls bypassing the `HttpFetcher` seam in `src/**` | 0      | 0         | Inspection |
| Discovery tests requiring live network access                       | 0      | 0         | Test       |
| New HTTP-client runtime dependencies in `package.json`              | 0      | 0         | Inspection |

## Verification

- `tests/search.test.ts` injects a fake `HttpFetcher` (and `Clock`) for every
  discovery case, so the suite hits no real npm, GitHub, unpkg, or
  raw.githubusercontent endpoint.
- `package.json` `dependencies` stays empty; the default fetcher references the
  global `fetch` rather than importing a client.

## Dependencies

- Upstream: [NFR-001](./NFR-001-zero-runtime-dependencies.md) and
  [NFR-002](./NFR-002-full-test-coverage.md) (the guarantees this preserves).
- Constrains the discovery FRs [FR-008](../functional/FR-008-candidate-search.md),
  [FR-009](../functional/FR-009-compatibility-verification.md), and
  [FR-011](../functional/FR-011-github-rate-limit.md).
