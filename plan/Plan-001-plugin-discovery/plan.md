---
id: Plan-001
title: "Plugin discovery (search.ts) — candidate search, verification, cache, rate-limit"
type: Plan
status: active
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/usecase/US-003
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-008
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-009
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-010
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-011
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-012
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-005
    type: references
---

# Implementation Plan: Plugin discovery (`search.ts`)

## Requirements Summary

- [ ] **US-003**: A host consumes a discovery API to find and verify publishable plugins by tag.
- [ ] **FR-008**: Candidate search across npm + GitHub via an injectable `HttpFetcher`; per-backend `Promise.allSettled`; normalize to `Source`; encode/headers/auth; malformed-body tolerance; all-fail shape; `limit` clamp; dedupe + total-order ranking; `signal`; token redaction (CON-2).
- [ ] **FR-009**: Host-driven compatibility verification — manifest fetch (unpkg / raw.githubusercontent), `404`→incompatible vs transient→error, `verify` null/object/throw, concurrency cap ≤ 6.
- [ ] **FR-010**: `createTtlCache` (injectable `Clock`) + `createPluginSearch` factory; cache key incl. verifier-presence + token-id; no caching of errored responses; `invalidate`; late-bound token.
- [ ] **FR-011**: GitHub rate-limit surfacing (`resetAt` epoch-seconds) + short-circuit while exhausted + first-call passthrough; never sleeps.
- [ ] **FR-012**: `sourceToInstallInput` renders a `Source` to its canonical source string.
- [ ] **NFR-005**: All discovery network access through one injectable `HttpFetcher`; suite runs offline; zero new deps; 100% coverage (NFR-002).

Spec-side reconciliation of NFR-001/NFR-003/`spec.md` (resolution surface = sync; discovery = the one async surface) is already landed; Task-007 verifies the code matches.

## Dependency Graph

- `Task-001 (FR-008 core search) -> Task-002 (FR-008 dedupe/rank/signal/redaction)`
  Reason: merge/rank operate on the normalized candidate results Task-001 produces.
- `Task-001 -> Task-003 (FR-009 verification)`
  Reason: verification filters the candidates Task-001 returns.
- `Task-001, Task-003 -> Task-004 (FR-010 cache + factory)`
  Reason: `createPluginSearch` wraps the full search+verify pipeline and caches its `SearchResponse`.
- `Task-001, Task-004 -> Task-005 (FR-011 rate-limit)`
  Reason: rate state is read from GitHub responses (Task-001) and retained by the factory (Task-004).
- `Task-006 (FR-012 sourceToInstallInput)` is independent — only depends on the `Source` type — and runs in parallel.
- `Task-002, Task-003, Task-004, Task-005, Task-006 -> Task-007 (exports + gates)`
- `Task-007 -> Task-008 (publish hand-off gate)`

### Execution Tracks

- **Track A — search pipeline (serial):** Task-001 → Task-002, and Task-001 → Task-003.
- **Track B — cache & rate (serial, after A):** Task-004 → Task-005.
- **Track C — helper (parallel):** Task-006.
- **Track S — integration/release (serial, last):** Task-007 → Task-008.

### Hand-off contract (to filament-ide)

This kit must be **specced + implemented + published** before filament-ide's
discovery work (its US-016/FR-030…032) consumes the published `search` API.
**Task-008 (publish) is the gate**: filament-ide bumps to the version that exports
`searchPlugins`/`createPluginSearch`/`sourceToInstallInput` only after it lands on
npm.

## Test Plan

All discovery tests live in a new `tests/search.test.ts` (vitest), driven by an
injected fake `HttpFetcher` and `Clock` — no real npm/GitHub/unpkg/raw access
(NFR-005). TC IDs trace to `spec/tests.md` (TC-022…TC-054).

### Unit (fake fetcher + clock)

- [ ] **candidate search** (FR-008 AC-1..4,6,7,8 / CON-1): TC-022, TC-023, TC-024, TC-025, TC-043, TC-044, TC-045.
- [ ] **dedupe / rank / signal / redaction** (FR-008 AC-5,9,10 / CON-2): TC-026, TC-046, TC-047, TC-054.
- [ ] **verification** (FR-009 AC-1..8): TC-027, TC-028, TC-029, TC-030, TC-031, TC-048, TC-049, TC-050.
- [ ] **cache + factory** (FR-010 AC-1..7): TC-032, TC-033, TC-034, TC-035, TC-036, TC-051, TC-052.
- [ ] **rate-limit** (FR-011 AC-1..5): TC-037, TC-038, TC-039, TC-040, TC-053.
- [ ] **sourceToInstallInput** (FR-012 AC-1,2): TC-041, TC-042.
- [ ] **defaultHttpFetcher** (NFR-005): `vi.stubGlobal('fetch', spy)` delegation.

## Quality Gates

- `make test` — vitest at the **100%** branches/functions/lines/statements gate (NFR-002) over `src/**` including `src/search.ts`.
- `make lint` — eslint + prettier clean.
- `quire validate --scope . "spec/**/*.md" "plan/**/*.md"` — spec + plan validate.
- Zero runtime dependencies preserved (`package.json` `dependencies` stays empty; default fetcher uses global `fetch`).

## Notes

`search.ts` is the kit's first asynchronous, networked surface; everything is
bounded behind `HttpFetcher`/`Clock` injection so the suite stays offline and
deterministic. The kit performs **no** manifest parsing — the host `CandidateVerifier`
owns that — keeping the toolkit framework-agnostic.
