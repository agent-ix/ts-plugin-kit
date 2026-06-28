---
id: NFR-001
title: "Zero Runtime Dependencies"
type: NFR
quality_attribute: maintainability
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "constrains"
    cardinality: "1:N"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-003"
    type: "constrains"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "constrains"
    cardinality: "1:1"
---

## Statement

The published package SHALL declare **zero runtime dependencies**. The library
SHALL import only Node.js built-in modules (`node:child_process`, `node:fs`,
`node:path`, `node:os` is test-only) and SHALL NOT add a YAML/JSON parser, a git
library, or any third-party package to the runtime closure. Manifest text parsing
is delegated to the host ([FR-003](../functional/FR-003-manifest-validation.md)), which passes a plain object.

## Measurement and Evaluation

| Metric                                             | Target | Threshold | Method      |
| -------------------------------------------------- | ------ | --------- | ----------- |
| `dependencies` entries in published `package.json` | 0      | 0         | Inspection  |
| Non-`node:` third-party imports in `src/**`        | 0      | 0         | Static grep |
| Transitive runtime dependency count of the package | 0      | 0         | Analysis    |

## Verification

- Inspect `package.json`: there is no `dependencies` key (only `devDependencies`).
- Grep `src/**` for `import` statements: every import resolves to a `node:*`
  built-in or a sibling `./*.js` module — no third-party package.
- The build (`vite.config.ts`) externalizes only `node:` built-ins and optional
  peer packages that the library does not actually import at runtime.
- The discovery surface ([FR-008](../functional/FR-008-candidate-search.md)) reaches
  the network through the Node global `fetch` referenced by `defaultHttpFetcher`, not
  an imported HTTP client, so it adds no runtime dependency; the built-ins list above
  is not exhaustive of the network surface.
