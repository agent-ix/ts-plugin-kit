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

Most of this matrix is a **backsync**: TC-001…TC-031 reference a real test in
`tests/index.test.ts` by its `describe` / `test` string — each maps to code that
runs today under `make test` (vitest) at the 100% coverage gate (NFR-002). TC-001…
TC-021 cover the original source/registry/install/reconcile surface; TC-022…TC-028
cover npm source resolution; and TC-029…TC-031 are the git argv-injection guards.

The **plugin-discovery** rows (US-003, FR-008…FR-012, NFR-005; TC-032…TC-070)
describe `tests/search.test.ts`, the discovery suite driven entirely by an injected
fake `HttpFetcher` + `Clock` (no real network). The 100% coverage gate (NFR-002)
forces every branch of `src/search.ts` to be exercised.

> **Merge note.** The discovery TCs were renumbered from their original TC-022…
> TC-060 block to TC-032…TC-070 (a uniform +10 shift) so they sit above main's
> npm/git-security block (TC-022…TC-031) without colliding, reconciled at the
> discovery merge.

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

| File                   | Primary requirements               |
| ---------------------- | ---------------------------------- |
| `tests/index.test.ts`  | FR-001 … FR-007, NFR-003           |
| `tests/search.test.ts` | FR-008 … FR-012, NFR-005 (planned) |

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

| User Story | Acceptance Criteria                            | Test Cases     | Coverage Status |
| ---------- | ---------------------------------------------- | -------------- | --------------- |
| US-001     | US-001-AC-1 (install enabled, skip disabled)   | TC-018         | ✅ Unit         |
| US-001     | US-001-AC-2 (2nd reconcile zero git)           | TC-018         | ✅ Unit         |
| US-001     | US-001-AC-3 (sync detects a moved pin)         | TC-019         | ✅ Unit         |
| US-002     | US-002-AC-1 (derive name via readName)         | TC-015         | ✅ Unit         |
| US-002     | US-002-AC-2 (explicit name wins)               | TC-014         | ✅ Unit         |
| US-002     | US-002-AC-3 (symlink materialization)          | TC-017         | ✅ Unit         |
| US-003     | US-003-EX-1 (find candidates by tag)           | TC-032         | 🚧 Planned      |
| US-003     | US-003-EX-2 (keep only compatible)             | TC-037, TC-038 | 🚧 Planned      |
| US-003     | US-003-EX-3 (one backend fails, other returns) | TC-034         | 🚧 Planned      |

---

## Functional Requirement Coverage

| Functional Req | Acceptance Criteria                                                    | Test Case · Case String                                                                                                                                   | Coverage Status    |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| FR-001         | AC-1: all six valid source shapes accepted                             | TC-001 — `normalizeSource › "accepts every valid shape"`                                                                                                  | ✅ Unit            |
| FR-001         | AC-2: null / no-`type` → SourceError                                   | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-001         | AC-3: missing required field → SourceError naming the field            | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-001         | AC-4: unknown type → SourceError "unknown source type"                 | TC-002 — `normalizeSource › "rejects malformed input"`                                                                                                    | ✅ Unit            |
| FR-002         | AC-1: `owner/repo` → GitHub https URL                                  | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-2: `owner/repo.git` strips trailing `.git`                          | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-3: full `https://` URL passes through                               | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-4: `git@…` scp-style URL passes through                             | TC-003 — `"toGitUrl expands shorthand and passes through URLs"`                                                                                           | ✅ Unit            |
| FR-002         | AC-5: surrounding whitespace is trimmed                                | TC-003 — `"toGitUrl expands shorthand and passes through URLs"` (padded-input assertion)                                                                  | ✅ Unit            |
| FR-003         | AC-1: valid manifest with name round-trips                             | TC-004 — `validateMarketplaceManifest › "accepts a valid manifest (with and without a name)"`                                                             | ✅ Unit            |
| FR-003         | AC-2: missing name → `name === undefined`                              | TC-004 — `validateMarketplaceManifest › "accepts a valid manifest (with and without a name)"`                                                             | ✅ Unit            |
| FR-003         | AC-3: null / non-object manifest → ManifestError                       | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-4: bad schemaVersion / non-array entries → ManifestError            | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-5: null entry / missing entry name → ManifestError                  | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-003         | AC-6: invalid entry source → SourceError                               | TC-005 — `validateMarketplaceManifest › "rejects malformed manifests and entries"`                                                                        | ✅ Unit            |
| FR-004         | AC-1: path source returns the dir                                      | TC-006 — `resolveSource › "path source returns the dir; missing path throws"`                                                                             | ✅ Unit            |
| FR-004         | AC-2: missing path → SourceError                                       | TC-006 — `resolveSource › "path source returns the dir; missing path throws"`                                                                             | ✅ Unit            |
| FR-004         | AC-3: url → UnsupportedSourceError                                     | TC-007 — `resolveSource › "url sources are not yet supported"`                                                                                            | ✅ Unit            |
| FR-004         | AC-4: git-subdir sparse-checkout at tag → dir/sha/ref                  | TC-008 — `resolveSource › "git-subdir sparse-checks out only the subdir at a tag"`                                                                        | ✅ Unit (git)      |
| FR-004         | AC-5: whole-repo HEAD when unpinned; re-fetch existing cache           | TC-009 — `resolveSource › "whole-repo git resolves to HEAD when unpinned, and re-fetches an existing cache"`                                              | ✅ Unit (git)      |
| FR-004         | AC-6: sha pin checks out the exact commit                              | TC-010 — `resolveSource › "sha pin checks out the exact commit"`                                                                                          | ✅ Unit (git)      |
| FR-004         | AC-7: github + injected runner needs no real git                       | TC-011 — `resolveSource › "github source + injected runner needs no real git"`                                                                            | ✅ Unit (fake)     |
| FR-004         | CON-1: git is the sole side effect                                     | TC-011 — `resolveSource › "github source + injected runner needs no real git"`                                                                            | ✅ Unit (fake)     |
| FR-004         | CON-2: blobless + sparse (subdir only)                                 | TC-008 — `resolveSource › "git-subdir sparse-checks out only the subdir at a tag"`                                                                        | ✅ Unit (git)      |
| FR-004         | AC-8: npm resolves+extracts+pins resolved version (fake fetcher)       | TC-022 — `resolveSource › "npm source downloads, extracts, and pins the resolved version"` + `"… resolves via the default fetcher when none is injected"` | ✅ Unit (fake/npm) |
| FR-004         | AC-9: exact-version pin cached; unpinned re-fetches                    | TC-023 — `resolveSource › "exact-version npm pins are cached; unpinned specs re-fetch"`                                                                   | ✅ Unit (fake)     |
| FR-004         | AC-10: defaultNpmFetcher local-pack offline (npm pack + tar)           | TC-024 — `resolveSource › "defaultNpmFetcher packs and extracts a local package offline"`                                                                 | ✅ Unit (npm)      |
| FR-004         | AC-11: npmPackArgs builds pinned/unpinned + registry argv              | TC-025 — `resolveSource › "npmPackArgs builds pinned, unpinned, and registry argv"`                                                                       | ✅ Unit            |
| FR-004         | CON-3: rejects option-like npm package (injection guard)               | TC-026 — `normalizeSource › "rejects malformed input"` (option-like `-x` package assertion)                                                               | ✅ Unit            |
| FR-004         | AC-12: robust npm-pack-json parse (skip noise; metadata object)        | TC-027 — `resolveSource › "parseNpmPackJson skips prepack noise and parses the trailing array"` (+ scans-past-empty / scans-past-numeric tests)           | ✅ Unit            |
| FR-004         | CON-4: descriptive SourceError on no-array/empty/invalid output        | TC-027 — `resolveSource › "parseNpmPackJson throws SourceError on no-bracket output"` (+ empty-array / numeric / no-string-filename throw tests)          | ✅ Unit            |
| FR-004         | AC-13: unpinned re-fetch clears stale tarballs (cache hygiene)         | TC-028 — `resolveSource › "unpinned re-fetch does not accumulate stale tarballs"`                                                                         | ✅ Unit (fake)     |
| FR-004         | AC-14 / CON-5: option-like git argv field rejected (injection guard)   | TC-029 — `normalizeSource › "rejects option-like git argv fields (injection guard)"`                                                                      | ✅ Unit            |
| FR-004         | AC-15 / CON-5: leading-whitespace trim-bypass repo/url rejected        | TC-030 — `normalizeSource › "rejects leading-whitespace option-like repo/url (trim bypass)"`                                                              | ✅ Unit            |
| FR-004         | AC-16 / CON-5: option-like `git-subdir.path` rejected                  | TC-031 — `normalizeSource › "rejects option-like git-subdir path"`                                                                                        | ✅ Unit            |
| FR-005         | AC-1: missing / shape-invalid (`{}`) registry read as empty            | TC-012 — `registry › "missing and malformed files read as empty"`                                                                                         | ✅ Unit            |
| FR-005         | AC-2: atomic write + nested-dir creation round-trips                   | TC-013 — `registry › "write is atomic and round-trips; upsert replaces by name"`                                                                          | ✅ Unit            |
| FR-005         | AC-3: upsert replaces by name (count stays 1)                          | TC-013 — `registry › "write is atomic and round-trips; upsert replaces by name"`                                                                          | ✅ Unit            |
| FR-006         | AC-1: named git-subdir entry materializes + records                    | TC-014 — `installEntry › "materializes a named git-subdir entry and records it"`                                                                          | ✅ Unit (git)      |
| FR-006         | AC-2: name derived via readName when absent                            | TC-015 — `installEntry › "derives the name via readName when the entry has none"`                                                                         | ✅ Unit (git)      |
| FR-006         | AC-3: entry.path against a whole-repo source                           | TC-016 — `installEntry › "honors entry.path against a whole-repo source"`                                                                                 | ✅ Unit (git)      |
| FR-006         | AC-4: symlink mode; re-install replaces                                | TC-017 — `installEntry › "symlink mode links instead of copying, and re-install replaces"`                                                                | ✅ Unit (git)      |
| FR-007         | AC-1: lazy installs enabled, skips disabled                            | TC-018 — `reconcile › "lazy installs the enabled set, skips disabled, and is idempotent with zero git on the 2nd run"`                                    | ✅ Unit (git)      |
| FR-007         | AC-2: 2nd lazy reconcile → unchanged, zero git                         | TC-018 — `reconcile › "lazy installs the enabled set, skips disabled, and is idempotent with zero git on the 2nd run"`                                    | ✅ Unit (git)      |
| FR-007         | AC-3: sync unchanged on stable ref; updated on moved pin               | TC-019 — `reconcile › "sync re-resolves: unchanged on a stable ref, updated on a moved pin"`                                                              | ✅ Unit (git)      |
| FR-007         | AC-4: lazy re-materializes when target dir is gone                     | TC-020 — `reconcile › "lazy re-materializes when the target dir is gone"`                                                                                 | ✅ Unit (git)      |
| FR-007         | AC-5: lazy sha pin → unchanged when matches, updated when differs      | TC-021 — `reconcile › "lazy honors a sha pin: unchanged when it matches, updated when it differs"`                                                        | ✅ Unit (git)      |
| FR-008         | AC-1: both backends normalize to typed sources, merged + ranked        | TC-032 — `searchPlugins › "merges npm + github candidates into one ranked list"`                                                                          | 🚧 Planned (fake)  |
| FR-008         | AC-2: URL-encoded `keywords:`/`topic:` queries; `limit` plumbing       | TC-033 — `searchPlugins › "composes encoded npm size + github per_page queries"`                                                                          | 🚧 Planned (fake)  |
| FR-008         | AC-3: one backend rejects → other returns + SearchBackendError         | TC-034 — `searchPlugins › "one backend failing still returns the other plus an error"`                                                                    | 🚧 Planned (fake)  |
| FR-008         | AC-4: Authorization header present iff token; `sources` filter         | TC-035 — `searchPlugins › "adds Authorization only with a token; honors sources filter"`                                                                  | 🚧 Planned (fake)  |
| FR-008         | AC-5: npm/github of same project dedupe (npm preferred)                | TC-036 — `searchPlugins › "dedupes an npm package against its github repo, preferring npm"`                                                               | 🚧 Planned (fake)  |
| FR-008         | AC-6: all backends fail → results:[] + one error each                  | TC-053 — `searchPlugins › "returns empty results with one error per failed backend"`                                                                      | 🚧 Planned (fake)  |
| FR-008         | AC-7: malformed body → SearchBackendError; missing optionals undefined | TC-054 — `searchPlugins › "tolerates malformed payloads and missing optional fields"`                                                                     | 🚧 Planned (fake)  |
| FR-008         | AC-8: limit clamped (npm size ≤250, github per_page ≤100)              | TC-055 — `searchPlugins › "clamps limit to each backend maximum"`                                                                                         | 🚧 Planned (fake)  |
| FR-008         | AC-9: ranking is a total order (absent stars/updatedAt last)           | TC-056 — `searchPlugins › "ranks deterministically with a fullName tie-break"`                                                                            | 🚧 Planned (fake)  |
| FR-008         | AC-10: signal passed to every fetch; abort → backend error             | TC-057 — `searchPlugins › "propagates signal and surfaces an abort as a backend error"`                                                                   | 🚧 Planned (fake)  |
| FR-008         | CON-1: all network flows through the injectable HttpFetcher            | TC-032 — `searchPlugins › "merges npm + github candidates into one ranked list"` (no real fetch)                                                          | 🚧 Planned (fake)  |
| FR-008         | CON-2: githubToken never in cache key / error / result                 | TC-064 — `searchPlugins › "never leaks the github token into errors, keys, or results"`                                                                   | 🚧 Planned (fake)  |
| FR-009         | AC-1: verify-accepted candidate kept, verified + capabilities          | TC-037 — `searchPlugins(verify) › "keeps a candidate whose verify returns capabilities"`                                                                  | 🚧 Planned (fake)  |
| FR-009         | AC-2: verify returns null → candidate dropped                          | TC-038 — `searchPlugins(verify) › "drops a candidate whose verify returns null"`                                                                          | 🚧 Planned (fake)  |
| FR-009         | AC-3: manifest fetch non-OK/reject → dropped, no verify call           | TC-039 — `searchPlugins(verify) › "drops a candidate whose manifest fetch fails without calling verify"`                                                  | 🚧 Planned (fake)  |
| FR-009         | AC-4: npm via unpkg, github via raw.githubusercontent HEAD             | TC-040 — `searchPlugins(verify) › "fetches manifests from unpkg and raw.githubusercontent"`                                                               | 🚧 Planned (fake)  |
| FR-009         | AC-5: no verifier → unfiltered, no manifest fetch                      | TC-041 — `searchPlugins › "skips verification entirely when no verifier is given"`                                                                        | 🚧 Planned (fake)  |
| FR-009         | AC-6: transient (non-404) fetch fail → drop + transient error          | TC-058 — `searchPlugins(verify) › "drops on a transient fetch failure and records a transient error"`                                                     | 🚧 Planned (fake)  |
| FR-009         | AC-7: verify throws → drop only that candidate, no escape              | TC-059 — `searchPlugins(verify) › "isolates a throwing verify to its candidate"`                                                                          | 🚧 Planned (fake)  |
| FR-009         | AC-8: ≤6 manifest fetches in flight at once                            | TC-060 — `searchPlugins(verify) › "caps manifest-fetch concurrency at six"`                                                                               | 🚧 Planned (fake)  |
| FR-009         | AC-9 / CON-1: traversal/control-char name dropped, no fetch            | TC-067 — `searchPlugins(verify) › "rejects path-traversal / control-char candidate names before fetching a manifest"`                                     | ✅ Unit (fake)     |
| FR-010         | AC-1: TTL cache returns value before expiry, undefined after           | TC-042 — `createTtlCache › "returns before expiry, evicts after the clock advances"`                                                                      | 🚧 Planned (fake)  |
| FR-010         | AC-2: `max`-bounded cache evicts oldest                                | TC-043 — `createTtlCache › "evicts the oldest entry past max"`                                                                                            | 🚧 Planned (fake)  |
| FR-010         | AC-3: cache hit within TTL issues no further fetch                     | TC-044 — `createPluginSearch › "serves an identical search from cache with no fetch"`                                                                     | 🚧 Planned (fake)  |
| FR-010         | AC-4: invalidate(opts) re-fetches; invalidate() clears all             | TC-045 — `createPluginSearch › "invalidate forces a re-fetch"`                                                                                            | 🚧 Planned (fake)  |
| FR-010         | AC-5: function-valued githubToken resolved per call                    | TC-046 — `createPluginSearch › "resolves a late-bound github token per call"`                                                                             | 🚧 Planned (fake)  |
| FR-010         | AC-6: error/rate-limited response is not cached                        | TC-061 — `createPluginSearch › "does not cache a response carrying errors"`                                                                               | 🚧 Planned (fake)  |
| FR-010         | AC-7: verifier/token-id discriminate cache entries                     | TC-062 — `createPluginSearch › "keys verifier-presence and token-id distinctly"`                                                                          | 🚧 Planned (fake)  |
| FR-010         | AC-8: distinct non-empty tokens → distinct cache entries               | TC-065 — `createPluginSearch › "keys distinct non-empty tokens to distinct cache entries"`                                                                | ✅ Unit (fake)     |
| FR-010         | AC-9: cache bounded by default cacheMax (256) + explicit override      | TC-066, TC-070 — `createPluginSearch › "bounds the cache by a default max…" / "honors an explicit cacheMax override"`                                     | ✅ Unit (fake)     |
| FR-010         | AC-10: cache hit returns a distinct (cloned) response                  | TC-069 — `createPluginSearch › "returns a distinct response object on a cache hit"`                                                                       | ✅ Unit (fake)     |
| FR-011         | AC-1: 200 headers populate rate.github                                 | TC-047 — `searchPlugins › "reads github rate-limit headers into rate.github"`                                                                             | 🚧 Planned (fake)  |
| FR-011         | AC-2: 403 remaining:0 → rateLimited error, no throw                    | TC-048 — `searchPlugins › "surfaces an exhausted github window as a rateLimited error"`                                                                   | 🚧 Planned (fake)  |
| FR-011         | AC-3: exhausted window short-circuits next github request              | TC-049 — `createPluginSearch › "skips github while the window is exhausted"`                                                                              | 🚧 Planned (fake)  |
| FR-011         | AC-4: after resetAt passes, github request resumes                     | TC-050 — `createPluginSearch › "resumes github once the clock passes resetAt"`                                                                            | 🚧 Planned (fake)  |
| FR-011         | AC-5: first call (no prior snapshot) issues github; lastRate empty     | TC-063 — `createPluginSearch › "does not short-circuit on the first call"`                                                                                | 🚧 Planned (fake)  |
| FR-011         | AC-6: non-finite rate header → no rate info (undefined)                | TC-068 — `searchPlugins › "treats non-finite rate-limit headers as no rate info"`                                                                         | ✅ Unit (fake)     |
| FR-012         | AC-1: npm→package, github→owner/repo                                   | TC-051 — `sourceToInstallInput › "renders npm and github sources"`                                                                                        | 🚧 Planned         |
| FR-012         | AC-2: git/url→url, path→path                                           | TC-052 — `sourceToInstallInput › "renders git/url and path sources"`                                                                                      | 🚧 Planned         |

---

## Non-Functional Requirement Coverage

| Non-Functional Req | Verification Method                                                                                 | Evidence / Test Cases                                                                                             | Status        |
| ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| NFR-001            | Inspection + static grep: no `dependencies`, no non-`node:` import                                  | `package.json` (no `dependencies` key); grep of `src/**` imports                                                  | ✅ Inspection |
| NFR-002            | Test: 100% coverage gate fails the build below threshold                                            | `vite.config.ts` `test.coverage.thresholds = 100/100/100/100`; `make test`                                        | ✅ Test       |
| NFR-003            | Test: 2nd lazy reconcile issues zero git; API is synchronous                                        | TC-018 (zero-git assertion) + TC-011 (no real git via fake runner); `src/index.ts` has no async export            | ✅ Test       |
| NFR-004            | Inspection + Analysis: distinct cache/target/registry paths                                         | `InstallOptions` fields; per-case temp roots in the `opts()` helper (used by TC-006…TC-021)                       | ✅ Analysis   |
| NFR-005            | Inspection + Test: discovery network flows through one injectable `HttpFetcher`; suite runs offline | `package.json` (no `dependencies`); `tests/search.test.ts` injects a fake `HttpFetcher` + `Clock` (TC-032…TC-070) | 🚧 Planned    |

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
| TC-029  | normalizeSource rejects option-like git argv fields (`-x`)       | Unit            | P0       | FR-004-AC-14, -CON-5                            | ✅     |
| TC-030  | normalizeSource rejects leading-ws trim-bypass repo/url          | Unit            | P0       | FR-004-AC-15, -CON-5                            | ✅     |
| TC-031  | normalizeSource rejects option-like `git-subdir.path`            | Unit            | P0       | FR-004-AC-16, -CON-5                            | ✅     |
| TC-032  | searchPlugins merges npm + github into one ranked list           | Unit (fake)     | P0       | FR-008-AC-1, -CON-1, US-003-EX-1                | 🚧     |
| TC-033  | searchPlugins composes encoded queries + limit plumbing          | Unit (fake)     | P0       | FR-008-AC-2                                     | 🚧     |
| TC-034  | searchPlugins one backend fails, other returns + error           | Unit (fake)     | P0       | FR-008-AC-3, US-003-EX-3                        | 🚧     |
| TC-035  | searchPlugins Authorization header + sources filter              | Unit (fake)     | P1       | FR-008-AC-4                                     | 🚧     |
| TC-036  | searchPlugins dedupes npm vs github (npm preferred)              | Unit (fake)     | P1       | FR-008-AC-5                                     | 🚧     |
| TC-037  | verify keeps candidate returning capabilities                    | Unit (fake)     | P0       | FR-009-AC-1, US-003-EX-2                        | 🚧     |
| TC-038  | verify drops candidate returning null                            | Unit (fake)     | P0       | FR-009-AC-2, US-003-EX-2                        | 🚧     |
| TC-039  | verify drops candidate when manifest fetch fails                 | Unit (fake)     | P0       | FR-009-AC-3                                     | 🚧     |
| TC-040  | verify fetches manifests from unpkg / raw.githubusercontent      | Unit (fake)     | P1       | FR-009-AC-4                                     | 🚧     |
| TC-041  | no verifier → unfiltered, no manifest fetch                      | Unit (fake)     | P1       | FR-009-AC-5                                     | 🚧     |
| TC-042  | createTtlCache returns before expiry, evicts after clock         | Unit (fake)     | P0       | FR-010-AC-1                                     | 🚧     |
| TC-043  | createTtlCache evicts oldest past max                            | Unit (fake)     | P1       | FR-010-AC-2                                     | 🚧     |
| TC-044  | createPluginSearch cache hit issues no fetch                     | Unit (fake)     | P0       | FR-010-AC-3                                     | 🚧     |
| TC-045  | createPluginSearch invalidate forces re-fetch                    | Unit (fake)     | P1       | FR-010-AC-4                                     | 🚧     |
| TC-046  | createPluginSearch resolves late-bound token per call            | Unit (fake)     | P1       | FR-010-AC-5                                     | 🚧     |
| TC-047  | searchPlugins reads github rate-limit headers                    | Unit (fake)     | P0       | FR-011-AC-1                                     | 🚧     |
| TC-048  | searchPlugins surfaces exhausted window as rateLimited error     | Unit (fake)     | P0       | FR-011-AC-2                                     | 🚧     |
| TC-049  | createPluginSearch short-circuits github while exhausted         | Unit (fake)     | P0       | FR-011-AC-3                                     | 🚧     |
| TC-050  | createPluginSearch resumes github past resetAt                   | Unit (fake)     | P1       | FR-011-AC-4                                     | 🚧     |
| TC-051  | sourceToInstallInput renders npm + github sources                | Unit            | P1       | FR-012-AC-1                                     | 🚧     |
| TC-052  | sourceToInstallInput renders git/url + path sources              | Unit            | P1       | FR-012-AC-2                                     | 🚧     |
| TC-053  | searchPlugins all backends fail → empty + per-backend errors     | Unit (fake)     | P0       | FR-008-AC-6                                     | 🚧     |
| TC-054  | searchPlugins tolerates malformed payloads / missing optionals   | Unit (fake)     | P0       | FR-008-AC-7                                     | 🚧     |
| TC-055  | searchPlugins clamps limit to backend maxima                     | Unit (fake)     | P1       | FR-008-AC-8                                     | 🚧     |
| TC-056  | searchPlugins deterministic total-order ranking                  | Unit (fake)     | P1       | FR-008-AC-9                                     | 🚧     |
| TC-057  | searchPlugins propagates signal; abort → backend error           | Unit (fake)     | P1       | FR-008-AC-10                                    | 🚧     |
| TC-058  | verify drops on transient fetch fail + transient error           | Unit (fake)     | P0       | FR-009-AC-6                                     | 🚧     |
| TC-059  | verify throw isolated to its candidate                           | Unit (fake)     | P0       | FR-009-AC-7                                     | 🚧     |
| TC-060  | verify caps manifest-fetch concurrency at six                    | Unit (fake)     | P1       | FR-009-AC-8                                     | 🚧     |
| TC-061  | createPluginSearch does not cache an errored response            | Unit (fake)     | P0       | FR-010-AC-6                                     | 🚧     |
| TC-062  | createPluginSearch keys verifier-presence + token-id             | Unit (fake)     | P1       | FR-010-AC-7                                     | 🚧     |
| TC-063  | createPluginSearch first call issues github (no short-circuit)   | Unit (fake)     | P1       | FR-011-AC-5                                     | 🚧     |
| TC-064  | searchPlugins never leaks github token                           | Unit (fake)     | P0       | FR-008-CON-2                                    | 🚧     |
| TC-065  | createPluginSearch keys distinct tokens to distinct entries      | Unit (fake)     | P0       | FR-010-AC-8, FR-008-CON-2                       | ✅     |
| TC-066  | createPluginSearch bounds cache by default max (256)             | Unit (fake)     | P1       | FR-010-AC-9                                     | ✅     |
| TC-067  | verify drops traversal/control-char name before fetch            | Unit (fake)     | P0       | FR-009-AC-9, -CON-1                             | ✅     |
| TC-068  | searchPlugins treats non-finite rate header as no rate info      | Unit (fake)     | P1       | FR-011-AC-6                                     | ✅     |
| TC-069  | createPluginSearch cache hit returns a distinct clone            | Unit (fake)     | P1       | FR-010-AC-10                                    | ✅     |
| TC-070  | createPluginSearch honors an explicit cacheMax override          | Unit (fake)     | P1       | FR-010-AC-9                                     | ✅     |

> TC-022…TC-028 are npm source-resolution tests and TC-029…TC-031 are
> the git argv-injection guard tests; both blocks are 1:1 with tests in
> `tests/index.test.ts`. TC-032…TC-070 are the plugin-discovery tests in
> `tests/search.test.ts`, renumbered above main's block when the two PRs
> were reconciled at the discovery merge.

---

## Constraint Boundary Tests

| Constraint         | Boundary / Case                                    | Test Value                                                      | Test Case      | Expected                                                       |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| FR-004-CON-1       | package-manager subprocess is the sole side effect | injected fake `GitRunner` / `NpmFetcher`                        | TC-011, TC-022 | resolves with no real git/npm; argv[0]=`clone`                 |
| FR-004-CON-2       | blobless + sparse                                  | `git-subdir` at `v0.2.0`                                        | TC-008         | only the subdir present; tag sha resolved                      |
| FR-004-CON-3       | option-like npm package rejected                   | `{type:"npm", package:"-x"}`                                    | TC-026         | `SourceError` "must not begin with -"; no `npm pack`           |
| FR-004-CON-4       | no metadata array in `npm pack --json` output      | `""`, `"[]"`, `"[1,2,3]"`, `'[{"name":"p"}]'`                   | TC-027         | `SourceError` "could not parse npm pack --json output"         |
| FR-004-CON-5       | option-like git argv field                         | `repo`/`url`/`ref`/`sha` = `-x` (e.g. `ref: "--upload-pack=…"`) | TC-029         | `SourceError` "must not begin with `-`"; no `git` invocation   |
| FR-004-CON-5       | trim-bypass (leading ws)                           | `repo`/`url` = `" --upload-pack=… ext://x"`                     | TC-030         | `SourceError` "must not begin with `-`"; trimmed value guarded |
| FR-004-CON-5       | option-like subdir path                            | `git-subdir.path` = `"--stdin"` / `"-X"`                        | TC-031         | `SourceError` "must not begin with `-`"; no `git` invocation   |
| FR-008-CON-1       | network via injectable seam                        | injected fake `HttpFetcher`                                     | TC-032         | results returned with no real network call                     |
| FR-008-CON-2       | token never leaks                                  | `githubToken` set + error/cache path                            | TC-064         | token absent from key, error, and result                       |
| FR-009-CON-1       | name path-traversal / ctrl                         | `name: "../evil"`, ctrl char                                    | TC-067         | candidate dropped; no manifest URL fetched                     |
| FR-009 concurrency | verification fan-out                               | 12 candidates, verifier set                                     | TC-060         | ≤ 6 concurrent manifest fetches                                |
| FR-008 limit       | clamp above max                                    | `limit: 9999`                                                   | TC-055         | npm `size`=250, github `per_page`=100                          |

---

## Error-Path Coverage

| Error                            | Trigger                                                            | Test Case | Status |
| -------------------------------- | ------------------------------------------------------------------ | --------- | ------ |
| `SourceError`                    | null / no-`type` / missing field / unknown type                    | TC-002    | ✅     |
| `SourceError`                    | `path` source dir does not exist                                   | TC-006    | ✅     |
| `SourceError`                    | option-like (`-`) `repo`/`url`/`ref`/`sha` (argv injection guard)  | TC-029    | ✅     |
| `SourceError`                    | leading-whitespace trim-bypass `repo`/`url` (argv injection guard) | TC-030    | ✅     |
| `SourceError`                    | option-like (`-`) `git-subdir.path` (argv injection guard)         | TC-031    | ✅     |
| `UnsupportedSourceError`         | `url` passed to `resolveSource` (npm now resolves)                 | TC-007    | ✅     |
| `ManifestError`                  | non-object / bad schemaVersion / non-array entries                 | TC-005    | ✅     |
| `ManifestError`                  | null entry / entry missing a non-empty `name`                      | TC-005    | ✅     |
| `SourceError` (via manifest)     | entry with an invalid `source.type`                                | TC-005    | ✅     |
| `SearchBackendError`             | one search backend rejects (network/parse failure)                 | TC-034    | 🚧     |
| `SearchBackendError`             | all backends fail → empty results + per-backend errors             | TC-053    | 🚧     |
| `SearchBackendError`             | structurally-invalid backend body (no `objects[]`/`items[]`)       | TC-054    | 🚧     |
| `SearchBackendError` (rate)      | github `403`/`429` with `remaining:0`                              | TC-048    | 🚧     |
| `SearchBackendError` (transient) | manifest fetch non-404 non-OK / rejects                            | TC-058    | 🚧     |
| candidate dropped (incompatible) | manifest fetch returns `404`                                       | TC-039    | 🚧     |
| candidate dropped (verify threw) | host `verify` callback throws                                      | TC-059    | 🚧     |

---

## Edge Cases

| ID     | Description                                                           | Related Req         | Test Case      | Risk if Untested                                |
| ------ | --------------------------------------------------------------------- | ------------------- | -------------- | ----------------------------------------------- |
| EC-001 | Second resolve of a cached URL takes the `fetch` (not `clone`) branch | FR-004-AC-5         | TC-009         | Re-fetch path silently broken                   |
| EC-002 | Settled lazy reconcile issues **zero** git calls                      | FR-007-AC-2         | TC-018         | Per-invocation git cost regresses               |
| EC-003 | Registry file is valid JSON but `plugins` is absent (`{}`)            | FR-005-AC-1         | TC-012         | Read throws instead of degrading to empty       |
| EC-004 | Target dir deleted out from under an installed entry                  | FR-007-AC-4         | TC-020         | Reconcile reports unchanged for a gone dir      |
| EC-005 | Re-install over an existing symlink target                            | FR-006-AC-4         | TC-017         | Stale symlink or copy-over-symlink error        |
| EC-006 | npm package and its github repo both match the same tag               | FR-008-AC-5         | TC-036         | Same project shown twice in results             |
| EC-007 | Candidate carries the tag but has no valid manifest                   | FR-009-AC-2         | TC-038         | Incompatible package offered as installable     |
| EC-008 | Exhausted github window before reset; then clock passes reset         | FR-011-AC-3 · -AC-4 | TC-049, TC-050 | Hammering a rate-limited API / never recovering |
| EC-009 | Identical query within TTL must not re-hit the network                | FR-010-AC-3         | TC-044         | Debounced UI still floods the registries        |

---

## Coverage Summary

- **Acceptance Criteria → Test Case coverage: 43 of 43 functional ACs (100%) map to
  an executed Test Case.** All ACs of FR-001…FR-007 (incl. FR-002-AC-5 whitespace
  trimming via the padded-input assertion in TC-003, the four npm-resolution ACs
  AC-8…AC-11, the two npm-robustness ACs AC-12 robust-parse and AC-13
  cache-hygiene, and the three git argv-injection guard ACs AC-14 via TC-029, the
  trim-bypass AC-15 via TC-030, and the `git-subdir.path` AC-16 via TC-031), all
  five FR-004 constraints (CON-1…CON-5), and all 6 user-story ACs map to a real test
  in `tests/index.test.ts`. NFR-001…NFR-004 are covered by the coverage gate, the
  zero-git assertion, inspection, and analysis.
- The 31 TCs map to the tests in `tests/index.test.ts` (TC-022 spans both the
  fake-fetcher and default-fetcher npm tests; TC-027 spans the five `parseNpmPackJson`
  noise/no-bracket/empty/numeric/no-filename tests; TC-029…TC-031 are 1:1 with the
  three argv-injection guard tests). All pass under `make test` at the
  100% coverage gate.
- All six test-matrix rules are satisfied: every AC has a TC (Rule 1); the
  copy/symlink materialize options are both exercised (Rule 2, TC-014/TC-017); the
  five FR-004 constraints are boundary-tested (Rule 3); every documented error is
  triggered (Rule 4); reconcile's installed/unchanged/updated/skipped outcomes are
  all reached (Rule 5); and the edge cases above are explicit (Rule 6).
- **Discovery (US-003, FR-008…FR-012, NFR-005; TC-032…TC-070): every AC is
  mapped to a TC.** These rows describe `tests/search.test.ts`, the discovery
  suite driven by an injected fake `HttpFetcher` + `Clock` (no real network).
  AC→TC mapping is 100% (Rule 1); the 100% coverage gate (NFR-002) keeps every
  branch of `src/search.ts` exercised. Backend-reject, rate-limit, and
  manifest-fetch failure paths are all triggered (Rule 4), the rate-limit
  exhausted→reset transition is reached (Rule 5, TC-049/TC-050), and the
  discovery edge cases above are explicit (Rule 6).

## Status: ⚠️ Partial — backsync ✅ Complete (executed); discovery 🚧 Planned (100% AC→TC mapped, awaiting `tests/search.test.ts`)

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
- TC-032…TC-070 cover `tests/search.test.ts`: the `Case String` values are the
  `describe › test` names of the discovery suite, all driven by an injected
  fake `HttpFetcher` + `Clock` (no real network), so the suite stays offline
  and deterministic (NFR-005).
