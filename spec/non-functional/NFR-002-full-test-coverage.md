---
id: NFR-002
title: "One-Hundred-Percent Enforced Test Coverage"
type: NFR
quality_attribute: maintainability
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "constrains"
    cardinality: "1:N"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-007"
    type: "constrains"
    cardinality: "1:1"
---

## Statement

The test suite SHALL maintain 100% coverage of `src/**` across all four coverage
dimensions (branches, functions, lines, statements), and the build SHALL **fail**
when coverage drops below 100% on any dimension. This gate is the standing
guarantee that every behavioral branch specified in [FR-001](../functional/FR-001-typed-source-union.md) through [FR-007](../functional/FR-007-reconcile.md) is
exercised.

## Measurement and Evaluation

| Metric                         | Target | Threshold | Method |
| ------------------------------ | ------ | --------- | ------ |
| Branch coverage of `src/**`    | 100%   | 100%      | Test   |
| Function coverage of `src/**`  | 100%   | 100%      | Test   |
| Line coverage of `src/**`      | 100%   | 100%      | Test   |
| Statement coverage of `src/**` | 100%   | 100%      | Test   |

## Verification

- `vite.config.ts` sets `test.coverage.thresholds` to `{ branches: 100, functions:
100, lines: 100, statements: 100 }` over `include: ["src/**/*.{ts,js}"]`.
- `make test` (vitest) fails the run if any dimension is below the threshold, so CI
  blocks a coverage regression.
