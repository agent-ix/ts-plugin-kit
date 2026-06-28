---
id: TM-001
type: TestMatrix
name: ts-plugin-kit
org: agent-ix
title: "Test Matrix"
---

# Test Matrix

## Overview

This matrix covers `@agent-ix/ts-plugin-kit`, the framework-agnostic plugin /
marketplace install toolkit (typed sources, ref/sha pinning, install registry,
and lazy/sync default-set reconciliation).

This is a **backsync** matrix: the implementation and its tests already exist.
Every Test Case (TC) below references a real test in `tests/index.test.ts` by its
`describe` / `test` string. No TC is aspirational — each maps to code that runs
today under `make test` (vitest) at the 100% coverage gate (NFR-002).

> **Concurrent-PR note.** TC-022…TC-054 are a shared TC-ID block also claimed by
> the concurrent `feat/plugin-discovery` PR. This (`feat/npm-source-resolution`)
> PR lands first and uses TC-022…TC-028 for npm source resolution; the two
> matrices will be **reconciled at the second merge** so the IDs do not collide.

Tests fall into the following types:

| Type        | Description                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Pure-function / in-memory tests. Run under vitest.                                                                         |
| Unit (git)  | Unit tests that drive a **local bare git fixture** (no network).                                                           |
| Unit (fake) | Unit tests using an injected fake `GitRunner` / `NpmFetcher` (no real git/npm).                                            |
| Unit (npm)  | Unit tests that run the real `defaultNpmFetcher` against a **local package folder** via `npm pack` (offline, no registry). |

The library's side effects are the local `git` subprocess (exercised against a
temp bare repo created in `beforeAll`) and, for npm sources, `npm pack` + `tar`
(exercised offline against a local package folder, TC-024). The `url` source type
is reserved and verified only via its `UnsupportedSourceError` (TC-007).

---

## Test Files

| File                  | Primary requirements     |
| --------------------- | ------------------------ |
| `tests/index.test.ts` | FR-001 … FR-007, NFR-003 |

> `tests/scripts.test.ts` covers the repo's `scripts/` build tooling, not the
> library surface, and is out of scope for this requirements matrix.

The fixture (`beforeAll`) builds a local work repo with two tagged commits
(`v0.2.0` → `shaV2`, `v0.3.0` → `shaV3`) containing a `spec_objects_business/`
subdir, then clones it `--bare` with `uploadpack.allowFilter=true` so blobless
partial clones work offline.

---

## Stakeholder Requirement Coverage

| Stakeholder Req                 | Trace to US / FR               | Test Cases                     | Coverage Status |
| ------------------------------- | ------------------------------ | ------------------------------ | --------------- |
| StR-001 (shared, dep-free)      | US-002, FR-001, FR-003, FR-006 | TC-001, TC-004, TC-014, TC-015 | ✅ Unit         |
| StR-002 (deterministic pinning) | FR-004, FR-005                 | TC-008, TC-010, TC-011, TC-013 | ✅ Unit         |
| StR-003 (fast reconcile)        | US-001, FR-007                 | TC-018, TC-019, TC-020, TC-021 | ✅ Unit         |

## User Story Coverage

| User Story | Acceptance Criteria                          | Test Cases | Coverage Status |
| ---------- | -------------------------------------------- | ---------- | --------------- |
| US-001     | US-001-AC-1 (install enabled, skip disabled) | TC-018     | ✅ Unit         |
| US-001     | US-001-AC-2 (2nd reconcile zero git)         | TC-018     | ✅ Unit         |
| US-001     | US-001-AC-3 (sync detects a moved pin)       | TC-019     | ✅ Unit         |
| US-002     | US-002-AC-1 (derive name via readName)       | TC-015     | ✅ Unit         |
| US-002     | US-002-AC-2 (explicit name wins)             | TC-014     | ✅ Unit         |
| US-002     | US-002-AC-3 (symlink materialization)        | TC-017     | ✅ Unit         |

---

## Functional Requirement Coverage

| Functional Req | Acceptance Criteria                                               | Test Case · Case String                                                                                                                                   | Coverage Status    |
| -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| FR-001         | AC-1: all six valid source shapes accepted                        | TC-001 — `normalizeSource › "accepts every valid shape"`                                                                                                  | ✅ Unit            |
| FR-001         | AC-2: null / no-`type` → SourceError                              | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-001         | AC-3: missing required field → SourceError naming the field       | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-001         | AC-4: unknown type → SourceError "unknown source type"            | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-002         | AC-1: `owner/repo` → GitHub https URL                             | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-2: `owner/repo.git` strips trailing `.git`                     | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-3: full `https://` URL passes through                          | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-4: `git@…` scp-style URL passes through                        | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-5: surrounding whitespace is trimmed                           | TC-003 — `"toGitUrl expands shorthand and passes through URLs"` (padded-input assertion)                                                                  | ✅ Unit            |
| FR-003         | AC-1: valid manifest with name round-trips                        | TC-004 — `validateMarketplaceManifest › "accepts a valid manifest (with and without a name)"`                                                             | ✅ Unit            |
| FR-003         | AC-2: missing name → `name === undefined`                         | TC-004 — `validateMarketplaceManifest › "accepts a valid manifest (with and without a name)"`                                                             | ✅ Unit            |
| FR-003         | AC-3: null / non-object manifest → ManifestError                  | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-4: bad schemaVersion / non-array entries → ManifestError       | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-5: null entry / missing entry name → ManifestError             | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-6: invalid entry source → SourceError                          | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-004         | AC-1: path source returns the dir                                 | TC-006 — `resolveSource › "path source returns the dir; missing path throws"`                                                                             | ✅ Unit            |
| FR-004         | AC-2: missing path → SourceError                                  | TC-006 — `resolveSource › "path source returns the dir; missing path throws"`                                                                             | ✅ Unit            |
| FR-004         | AC-3: url → UnsupportedSourceError                                | TC-007 — `resolveSource › "url sources are not yet supported"`                                                                                            | ✅ Unit            |
| FR-004         | AC-4: git-subdir sparse-checkout at tag → dir/sha/ref             | TC-008 — `resolveSource › "git-subdir sparse-checks out only the subdir at a tag"`                                                                        | ✅ Unit (git)      |
| FR-004         | AC-5: whole-repo HEAD when unpinned; re-fetch existing cache      | TC-009 — `resolveSource › "whole-repo git resolves to HEAD when unpinned, and re-fetches an existing cache"`                                              | ✅ Unit (git)      |
| FR-004         | AC-6: sha pin checks out the exact commit                         | TC-010 — `resolveSource › "sha pin checks out the exact commit"`                                                                                          | ✅ Unit (git)      |
| FR-004         | AC-7: github + injected runner needs no real git                  | TC-011 — `resolveSource › "github source + injected runner needs no real git"`                                                                            | ✅ Unit (fake)     |
| FR-004         | CON-1: git is the sole side effect                                | TC-011 — `resolveSource › "github source + injected runner needs no real git"`                                                                            | ✅ Unit (fake)     |
| FR-004         | CON-2: blobless + sparse (subdir only)                            | TC-008 — `resolveSource › "git-subdir sparse-checks out only the subdir at a tag"`                                                                        | ✅ Unit (git)      |
| FR-004         | AC-8: npm resolves+extracts+pins resolved version (fake fetcher)  | TC-022 — `resolveSource › "npm source downloads, extracts, and pins the resolved version"` + `"… resolves via the default fetcher when none is injected"` | ✅ Unit (fake/npm) |
| FR-004         | AC-9: exact-version pin cached; unpinned re-fetches               | TC-023 — `resolveSource › "exact-version npm pins are cached; unpinned specs re-fetch"`                                                                   | ✅ Unit (fake)     |
| FR-004         | AC-10: defaultNpmFetcher local-pack offline (npm pack + tar)      | TC-024 — `resolveSource › "defaultNpmFetcher packs and extracts a local package offline"`                                                                 | ✅ Unit (npm)      |
| FR-004         | AC-11: npmPackArgs builds pinned/unpinned + registry argv         | TC-025 — `resolveSource › "npmPackArgs builds pinned, unpinned, and registry argv"`                                                                       | ✅ Unit            |
| FR-004         | CON-3: rejects option-like npm package (injection guard)          | TC-026 — `normalizeSource › "rejects malformed input"` (option-like `-x` package assertion)                                                               | ✅ Unit            |
| FR-004         | AC-12: robust npm-pack-json parse (skip noise; metadata object)   | TC-027 — `resolveSource › "parseNpmPackJson skips prepack noise and parses the trailing array"` (+ scans-past-empty / scans-past-numeric tests)           | ✅ Unit            |
| FR-004         | CON-4: descriptive SourceError on no-array/empty/invalid output   | TC-027 — `resolveSource › "parseNpmPackJson throws SourceError on no-bracket output"` (+ empty-array / numeric / no-string-filename throw tests)          | ✅ Unit            |
| FR-004         | AC-13: unpinned re-fetch clears stale tarballs (cache hygiene)    | TC-028 — `resolveSource › "unpinned re-fetch does not accumulate stale tarballs"`                                                                         | ✅ Unit (fake)     |
| FR-005         | AC-1: missing / shape-invalid (`{}`) registry read as empty       | TC-012 — `registry › "missing and malformed files read as empty"`                                                                                         | ✅ Unit            |
| FR-005         | AC-2: atomic write + nested-dir creation round-trips              | TC-013 — `registry › "write is atomic and round-trips; upsert replaces by name"`                                                                          | ✅ Unit            |
| FR-005         | AC-3: upsert replaces by name (count stays 1)                     | TC-013 — `registry › "write is atomic and round-trips; upsert replaces by name"`                                                                          | ✅ Unit            |
| FR-006         | AC-1: named git-subdir entry materializes + records               | TC-014 — `installEntry › "materializes a named git-subdir entry and records it"`                                                                          | ✅ Unit (git)      |
| FR-006         | AC-2: name derived via readName when absent                       | TC-015 — `installEntry › "derives the name via readName when the entry has none"`                                                                         | ✅ Unit (git)      |
| FR-006         | AC-3: entry.path against a whole-repo source                      | TC-016 — `installEntry › "honors entry.path against a whole-repo source"`                                                                                 | ✅ Unit (git)      |
| FR-006         | AC-4: symlink mode; re-install replaces                           | TC-017 — `installEntry › "symlink mode links instead of copying, and re-install replaces"`                                                                | ✅ Unit (git)      |
| FR-007         | AC-1: lazy installs enabled, skips disabled                       | TC-018 — `reconcile › "lazy installs the enabled set, skips disabled, and is idempotent with zero git on the 2nd run"`                                    | ✅ Unit (git)      |
| FR-007         | AC-2: 2nd lazy reconcile → unchanged, zero git                    | TC-018 — `reconcile › "lazy installs the enabled set, skips disabled, and is idempotent with zero git on the 2nd run"`                                    | ✅ Unit (git)      |
| FR-007         | AC-3: sync unchanged on stable ref; updated on moved pin          | TC-019 — `reconcile › "sync re-resolves: unchanged on a stable ref, updated on a moved pin"`                                                              | ✅ Unit (git)      |
| FR-007         | AC-4: lazy re-materializes when target dir is gone                | TC-020 — `reconcile › "lazy re-materializes when the target dir is gone"`                                                                                 | ✅ Unit (git)      |
| FR-007         | AC-5: lazy sha pin → unchanged when matches, updated when differs | TC-021 — `reconcile › "lazy honors a sha pin: unchanged when it matches, updated when it differs"`                                                        | ✅ Unit (git)      |

---

## Non-Functional Requirement Coverage

| Non-Functional Req | Verification Method                                                | Evidence / Test Cases                                                                                  | Status        |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------- |
| NFR-001            | Inspection + static grep: no `dependencies`, no non-`node:` import | `package.json` (no `dependencies` key); grep of `src/**` imports                                       | ✅ Inspection |
| NFR-002            | Test: 100% coverage gate fails the build below threshold           | `vite.config.ts` `test.coverage.thresholds = 100/100/100/100`; `make test`                             | ✅ Test       |
| NFR-003            | Test: 2nd lazy reconcile issues zero git; API is synchronous       | TC-018 (zero-git assertion) + TC-011 (no real git via fake runner); `src/index.ts` has no async export | ✅ Test       |
| NFR-004            | Inspection + Analysis: distinct cache/target/registry paths        | `InstallOptions` fields; per-case temp roots in the `opts()` helper (used by TC-006…TC-021)            | ✅ Analysis   |

---

## Test Case Summary

| Test ID | Title                                                            | Type            | Priority | Traces To                                       | Status |
| ------- | ---------------------------------------------------------------- | --------------- | -------- | ----------------------------------------------- | ------ |
| TC-001  | normalizeSource accepts every valid shape                        | Unit            | P0       | FR-001-AC-1                                     | ✅     |
| TC-002  | normalizeSource rejects malformed input                          | Unit            | P0       | FR-001-AC-2, -AC-3, -AC-4                       | ✅     |
| TC-003  | toGitUrl expands shorthand / passes through URLs                 | Unit            | P1       | FR-002-AC-1, -AC-2, -AC-3, -AC-4                | ✅     |
| TC-004  | validateMarketplaceManifest accepts valid (with/without name)    | Unit            | P0       | FR-003-AC-1, -AC-2                              | ✅     |
| TC-005  | validateMarketplaceManifest rejects malformed manifests/entries  | Unit            | P0       | FR-003-AC-3, -AC-4, -AC-5, -AC-6                | ✅     |
| TC-006  | resolveSource path source: returns dir / missing throws          | Unit            | P0       | FR-004-AC-1, -AC-2                              | ✅     |
| TC-007  | resolveSource url sources unsupported                            | Unit            | P1       | FR-004-AC-3                                     | ✅     |
| TC-008  | resolveSource git-subdir sparse-checkout at a tag                | Unit (git)      | P0       | FR-004-AC-4, -CON-2                             | ✅     |
| TC-009  | resolveSource whole-repo HEAD + re-fetch existing cache          | Unit (git)      | P0       | FR-004-AC-5                                     | ✅     |
| TC-010  | resolveSource sha pin checks out exact commit                    | Unit (git)      | P0       | FR-004-AC-6                                     | ✅     |
| TC-011  | resolveSource github + injected runner (no real git)             | Unit (fake)     | P0       | FR-004-AC-7, -CON-1, NFR-003                    | ✅     |
| TC-012  | registry missing / malformed reads empty                         | Unit            | P0       | FR-005-AC-1                                     | ✅     |
| TC-013  | registry atomic write round-trip + upsert by name                | Unit            | P0       | FR-005-AC-2, -AC-3                              | ✅     |
| TC-014  | installEntry named git-subdir materializes + records             | Unit (git)      | P0       | FR-006-AC-1, US-002-AC-2                        | ✅     |
| TC-015  | installEntry derives name via readName                           | Unit (git)      | P0       | FR-006-AC-2, US-002-AC-1                        | ✅     |
| TC-016  | installEntry honors entry.path on whole-repo source              | Unit (git)      | P1       | FR-006-AC-3                                     | ✅     |
| TC-017  | installEntry symlink mode + re-install replaces                  | Unit (git)      | P1       | FR-006-AC-4, US-002-AC-3                        | ✅     |
| TC-018  | reconcile lazy install/skip + zero-git 2nd run                   | Unit (git)      | P0       | FR-007-AC-1, -AC-2, US-001-AC-1, -AC-2, NFR-003 | ✅     |
| TC-019  | reconcile sync unchanged-stable / updated-moved                  | Unit (git)      | P0       | FR-007-AC-3, US-001-AC-3                        | ✅     |
| TC-020  | reconcile lazy re-materializes vanished target                   | Unit (git)      | P1       | FR-007-AC-4                                     | ✅     |
| TC-021  | reconcile lazy sha pin unchanged/updated                         | Unit (git)      | P0       | FR-007-AC-5                                     | ✅     |
| TC-022  | resolveSource npm resolve+extract+pin (fake & default fetcher)   | Unit (fake/npm) | P0       | FR-004-AC-8                                     | ✅     |
| TC-023  | resolveSource exact-cache vs unpinned-refetch (fake fetcher)     | Unit (fake)     | P0       | FR-004-AC-9                                     | ✅     |
| TC-024  | defaultNpmFetcher local-pack offline (npm pack + tar)            | Unit (npm)      | P1       | FR-004-AC-10                                    | ✅     |
| TC-025  | npmPackArgs pinned/unpinned + registry argv                      | Unit            | P1       | FR-004-AC-11                                    | ✅     |
| TC-026  | normalizeSource rejects option-like npm package (`-x`)           | Unit            | P0       | FR-004-CON-3                                    | ✅     |
| TC-027  | parseNpmPackJson robust parse + descriptive parse-failure errors | Unit            | P0       | FR-004-AC-12, -CON-4                            | ✅     |
| TC-028  | unpinned npm re-fetch clears stale tarballs (cache hygiene)      | Unit (fake)     | P1       | FR-004-AC-13                                    | ✅     |

> TC-022…TC-028 belong to the shared TC-022…TC-054 block also used by the
> concurrent `feat/plugin-discovery` PR; IDs are reconciled at the second merge
> (this PR lands first).

---

## Constraint Boundary Tests

| Constraint   | Boundary / Case                                    | Test Value                                    | Test Case      | Expected                                               |
| ------------ | -------------------------------------------------- | --------------------------------------------- | -------------- | ------------------------------------------------------ |
| FR-004-CON-1 | package-manager subprocess is the sole side effect | injected fake `GitRunner` / `NpmFetcher`      | TC-011, TC-022 | resolves with no real git/npm; argv[0]=`clone`         |
| FR-004-CON-2 | blobless + sparse                                  | `git-subdir` at `v0.2.0`                      | TC-008         | only the subdir present; tag sha resolved              |
| FR-004-CON-3 | option-like npm package rejected                   | `{type:"npm", package:"-x"}`                  | TC-026         | `SourceError` "must not begin with -"; no `npm pack`   |
| FR-004-CON-4 | no metadata array in `npm pack --json` output      | `""`, `"[]"`, `"[1,2,3]"`, `'[{"name":"p"}]'` | TC-027         | `SourceError` "could not parse npm pack --json output" |

---

## Error-Path Coverage

| Error                        | Trigger                                            | Test Case | Status |
| ---------------------------- | -------------------------------------------------- | --------- | ------ |
| `SourceError`                | null / no-`type` / missing field / unknown type    | TC-002    | ✅     |
| `SourceError`                | `path` source dir does not exist                   | TC-006    | ✅     |
| `UnsupportedSourceError`     | `url` passed to `resolveSource` (npm now resolves) | TC-007    | ✅     |
| `ManifestError`              | non-object / bad schemaVersion / non-array entries | TC-005    | ✅     |
| `ManifestError`              | null entry / entry missing a non-empty `name`      | TC-005    | ✅     |
| `SourceError` (via manifest) | entry with an invalid `source.type`                | TC-005    | ✅     |

---

## Edge Cases

| ID     | Description                                                           | Related Req | Test Case | Risk if Untested                           |
| ------ | --------------------------------------------------------------------- | ----------- | --------- | ------------------------------------------ |
| EC-001 | Second resolve of a cached URL takes the `fetch` (not `clone`) branch | FR-004-AC-5 | TC-009    | Re-fetch path silently broken              |
| EC-002 | Settled lazy reconcile issues **zero** git calls                      | FR-007-AC-2 | TC-018    | Per-invocation git cost regresses          |
| EC-003 | Registry file is valid JSON but `plugins` is absent (`{}`)            | FR-005-AC-1 | TC-012    | Read throws instead of degrading to empty  |
| EC-004 | Target dir deleted out from under an installed entry                  | FR-007-AC-4 | TC-020    | Reconcile reports unchanged for a gone dir |
| EC-005 | Re-install over an existing symlink target                            | FR-006-AC-4 | TC-017    | Stale symlink or copy-over-symlink error   |

---

## Coverage Summary

- **Acceptance Criteria → Test Case coverage: 40 of 40 functional ACs (100%) map to
  an executed Test Case.** All ACs of FR-001…FR-007 (incl. FR-002-AC-5 whitespace
  trimming via the padded-input assertion in TC-003, the four npm-resolution ACs
  AC-8…AC-11, and the two npm-robustness ACs AC-12 robust-parse and AC-13
  cache-hygiene), all four FR-004 constraints (CON-1…CON-4), and all 6 user-story ACs
  map to a real test in `tests/index.test.ts`. NFR-001…NFR-004 are covered by the
  coverage gate, the zero-git assertion, inspection, and analysis.
- The 28 TCs map to the tests in `tests/index.test.ts` (TC-022 spans both the
  fake-fetcher and default-fetcher npm tests; TC-027 spans the five `parseNpmPackJson`
  noise/no-bracket/empty/numeric/no-filename tests). All pass under `make test` at the
  100% coverage gate.
- All six test-matrix rules are satisfied: every AC has a TC (Rule 1); the
  copy/symlink materialize options are both exercised (Rule 2, TC-014/TC-017); the
  two FR-004 constraints are boundary-tested (Rule 3); every documented error is
  triggered (Rule 4); reconcile's installed/unchanged/updated/skipped outcomes are
  all reached (Rule 5); and the edge cases above are explicit (Rule 6).

## Status: ✅ Complete — 100% AC→TC coverage

## Backsync Findings (code behavior vs. test coverage)

Recorded during /spec-review. None block the spec; each is a candidate test/hardening item.

1. **FR-002-AC-5 — CLOSED** — TC-003 now passes a padded string (`"  owner/repo  "`),
   so the trim behavior is executed, not inspection-only.
2. **Malformed-JSON registry throws** — `readRegistry` only degrades a _shape-invalid
   but valid-JSON_ file (`{}`) to empty; a non-JSON file throws `SyntaxError`
   (`registry.ts:35`). FR-005/TC-012 scope "shape-invalid" accordingly; the
   "malformed reads as empty" over-claim was corrected.
3. **Unhandled git failures** — clone/fetch/checkout failures and a missing
   `git-subdir` path throw raw subprocess errors; no typed `ResolveError`, no test
   (spec.md §14, FR-004).
4. **Lazy reconcile never chases `HEAD`** — an unpinned entry (`undefined`
   sha+ref) matches `unchanged` forever in lazy mode; not tested across two lazy
   runs (FR-007, spec.md §14).
5. **Non-atomic materialization, cache-key collisions, symlink pin-instability, and
   read-modify-write concurrency** — code-level limitations recorded in spec.md §14;
   not exercised by tests.

## Notes

- This matrix is a **backsync** of existing tests; TC IDs are an authoring overlay
  on `tests/index.test.ts` (the test strings do not yet embed `TC-XXX` labels).
  The `Test Case · Case String` column is the canonical pointer from each AC to the
  exact `describe › test` it is verified by.
- The `url` source variant is deliberately unimplemented (FR-004-AC-3); there is
  therefore no happy-path TC for it, only the `UnsupportedSourceError` assertion
  (TC-007). This is correct, not a coverage gap. The `npm` variant **is** now
  resolved (TC-022…TC-028).
