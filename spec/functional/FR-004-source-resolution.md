---
id: FR-004
title: "Synchronous Source Resolution and Pinning"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-002"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "requires"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-002"
    type: "requires"
    cardinality: "1:1"
---

## Description

The library SHALL export `resolveSource(source, opts)` which synchronously fetches
a source to a local directory and returns a `ResolvedSource` (`dir`, `sha?`,
`ref?`). A per-source package-manager subprocess SHALL be the only side effect:
`git` for git sources (via the injectable `GitRunner`, default `defaultGitRunner`
using `execFileSync`); `npm pack` + `tar` for `npm` sources (via the injectable
`NpmFetcher`, default `defaultNpmFetcher`). `ResolveOptions` carries a `cacheRoot`
(git sources cached under `<cacheRoot>/git/<key>`, npm sources under
`<cacheRoot>/npm/<key>`), an optional `git` runner, and an optional `npm` fetcher.
The function SHALL validate the source via `normalizeSource` ([FR-001](./FR-001-typed-source-union.md)) and
expand git URLs via `toGitUrl` ([FR-002](./FR-002-git-url-shorthand.md)).

## Behavior

`resolveSource` SHALL:

- **`path` source**: resolve `source.path` to an absolute path; if it does not
  exist, throw `SourceError("path source not found: <dir>")`; otherwise return
  `{ dir }` (no `sha`, no `ref`).
- **`url` source**: throw `UnsupportedSourceError` (message mentions the type is
  not yet supported) — this reserved type is not resolved.
- **`npm` source**: cache under `<cacheRoot>/npm/<key>` (key sanitized from
  `<package>@<version | "latest">`); invoke the `NpmFetcher` to `npm pack` the
  package tarball and extract it, then return `{ dir, sha, ref }` where `dir` is
  the extracted content root, `sha` is the **resolved published version** (the
  durable pin, mirroring a git sha), and `ref` echoes back the requested
  `source.version`. An **exact-version** pin (`X.Y.Z[-+…]`) whose extracted
  `package.json` and recorded version are already cached is reused without
  re-fetching; an unpinned or range spec re-fetches every time to honor "latest".
  On a re-fetch (or any cache miss) the npm cache dir is cleared before
  re-extracting so stale tarball artifacts do not accumulate (FR-004-AC-13).
- **git sources** (`github`, `git`, `git-subdir`):
  - Compute the clone URL via `toGitUrl(source.repo | source.url)` and the cache
    dir `<cacheRoot>/git/<sanitized-url>` (non-`[A-Za-z0-9._-]` chars replaced
    with `_`).
  - **First time** (cache dir absent): create the parent dir, then
    `git clone --filter=blob:none --no-checkout <url> <cacheDir>` (a blobless,
    no-checkout clone). For `git-subdir`, additionally
    `git sparse-checkout init --cone` then `git sparse-checkout set <path>`.
  - **Subsequent times** (cache dir present): `git fetch --filter=blob:none
--tags origin` to refresh refs without re-cloning.
  - Check out the wanted target `source.sha ?? source.ref ?? "HEAD"` via
    `git checkout --detach <wanted>`, then read the resolved sha via
    `git rev-parse HEAD`.
  - Return `{ dir, sha, ref }` where `dir` is the cache dir (or
    `<cacheDir>/<path>` for `git-subdir`), `sha` is the resolved commit, and `ref`
    is the requested `source.ref` echoed back for the registry record.

The default checkout precedence (`sha` over `ref` over `HEAD`) makes a sha pin
exact and an unpinned source resolve to `HEAD`.

**Git-failure propagation.** Resolution does not catch errors from the
`GitRunner`. With the default runner (`execFileSync`), any nonzero git exit —
clone of an unreachable/private repo, a fetch failure, or a checkout of a ref/sha
that does not exist — throws the underlying Node subprocess error; it is **not**
wrapped in a `SourceError`. A `git-subdir` whose `path` is absent at the resolved
ref does not fail in `resolveSource`; the returned `dir`
(`<cacheDir>/<path>`) simply will not exist, and the failure surfaces in the
consumer ([FR-006](./FR-006-single-entry-install.md)). The library defines no dedicated `ResolveError` today (see
spec.md §14 Known Limitations).

**`defaultGitRunner`.** The default runner shells out via
`execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe",
"pipe"] })`; an injected `GitRunner` replaces it so tests run with no real git
(FR-004-AC-7).

**`defaultNpmFetcher`.** The default fetcher runs `npm pack <ref> --pack-destination
<destDir> --json` (where `<ref>` is `<package>@<version>` when a version is given,
else `<package>`, plus `--registry <registry>` when supplied), parses the JSON
metadata for the tarball `filename` and resolved `version`, then extracts the
tarball with `tar -xzf <tarball> -C <destDir>` and returns `{ dir:
<destDir>/package, version }`. The `npm pack` argv is built by the pure, exported
`npmPackArgs(spec, destDir)` helper so the version and `--registry` branches are
unit-testable offline (FR-004-AC-11). Metadata parsing is delegated to the pure,
exported `parseNpmPackJson(out)` helper, which scans past lifecycle-script stdout
noise and returns the first npm-pack metadata object (an object with a string
`filename`), throwing a descriptive `SourceError` on no-array/empty/invalid
output (FR-004-AC-12, FR-004-CON-4). `npm pack` of a **local folder** runs
offline (no registry), which is how the default fetcher is integration-tested
(FR-004-AC-10). An injected `NpmFetcher` replaces the default so tests run with no
real `npm`/network (FR-004-AC-8, -AC-9).

## Constraints

| ID           | Constraint                                                                                                                                                                                                                                                                                    | Type          | Validation    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| FR-004-CON-1 | The only side effect is the per-source package-manager subprocess (`git` for git sources; `npm pack` + `tar` for npm sources); resolution performs no other network or I/O beyond filesystem reads/dir creation.                                                                              | architectural | Test (TC-011) |
| FR-004-CON-2 | The clone is blobless and no-checkout (`--filter=blob:none --no-checkout`); subdir sources sparse-checkout only the requested path.                                                                                                                                                           | performance   | Test (TC-008) |
| FR-004-CON-3 | `normalizeSource` rejects an `npm` `package` beginning with `-`, so it cannot reach `npm pack` as a CLI flag (second-order command-line-injection guard).                                                                                                                                     | security      | Test (TC-026) |
| FR-004-CON-4 | When `npm pack --json` output contains no metadata array (no array at all, an empty array, or an array whose first element is not an object with a string `filename`), `parseNpmPackJson` throws a descriptive `SourceError` rather than returning garbage or a confusing downstream failure. | robustness    | Test (TC-027) |

## Acceptance Criteria

| ID           | Criteria                                                                                                                                                                                                                                                                                                                                                                                | Verification  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-004-AC-1  | A `path` source for an existing directory returns `{ dir }` pointing at that directory (its contents are readable).                                                                                                                                                                                                                                                                     | Test (TC-006) |
| FR-004-AC-2  | A `path` source for a non-existent directory throws `SourceError`.                                                                                                                                                                                                                                                                                                                      | Test (TC-006) |
| FR-004-AC-3  | A `url` source throws `UnsupportedSourceError`.                                                                                                                                                                                                                                                                                                                                         | Test (TC-007) |
| FR-004-AC-4  | A `git-subdir` source pinned to a tag returns `dir` ending in the subdir path, contains the subdir's files, and reports the tag's `sha` and the requested `ref`.                                                                                                                                                                                                                        | Test (TC-008) |
| FR-004-AC-5  | A whole-repo `git` source with no pin resolves to `HEAD` (latest commit); re-resolving the same cached URL at a tag exercises the fetch branch and resolves that tag's sha.                                                                                                                                                                                                             | Test (TC-009) |
| FR-004-AC-6  | A `git` source pinned by `sha` checks out exactly that commit.                                                                                                                                                                                                                                                                                                                          | Test (TC-010) |
| FR-004-AC-7  | A `github` source resolved with an injected `GitRunner` performs no real git: the returned `sha` is the runner's output and the first git argv is `clone`.                                                                                                                                                                                                                              | Test (TC-011) |
| FR-004-AC-8  | An `npm` source resolved with an injected `NpmFetcher` extracts the tarball content (manifest present at the returned `dir`) and pins the **resolved version** as `sha`, echoing the requested version as `ref`.                                                                                                                                                                        | Test (TC-022) |
| FR-004-AC-9  | An **exact-version** `npm` pin is served from cache on a second resolve (fetcher invoked once); an **unpinned** spec re-fetches every resolve (fetcher invoked each time) and pins the resolved version returned by the fetcher.                                                                                                                                                        | Test (TC-023) |
| FR-004-AC-10 | `defaultNpmFetcher` packs and extracts a **local** package folder via `npm pack` + `tar`, fully offline, returning the package version and an extracted content root containing `package.json`.                                                                                                                                                                                         | Test (TC-024) |
| FR-004-AC-11 | `npmPackArgs` builds the correct argv for a pinned spec (`<pkg>@<version>`), an unpinned spec (`<pkg>`), and includes `--registry <registry>` when a registry is supplied.                                                                                                                                                                                                              | Test (TC-025) |
| FR-004-AC-12 | `parseNpmPackJson` robustly parses the `npm pack --json` metadata: it scans past lifecycle-script stdout noise (including stray `[` brackets, empty arrays, and non-metadata noise arrays) and returns the first array whose first element is an npm-pack metadata object (an object with a string `filename`); on no-array/empty/invalid output it throws a descriptive `SourceError`. | Test (TC-027) |
| FR-004-AC-13 | An **unpinned** (or range) `npm` re-fetch clears any prior cached tarball + extraction before re-extracting, so the npm cache dir does not accumulate stale tarball artifacts across "latest" re-fetches.                                                                                                                                                                               | Test (TC-028) |

## Dependencies

- Implements [StR-002](../stakeholder/StR-002-deterministic-pinning.md) (durable sha pinning).
- Requires [FR-001](./FR-001-typed-source-union.md) (`normalizeSource`) and [FR-002](./FR-002-git-url-shorthand.md) (`toGitUrl`).
- Consumed by [FR-006](./FR-006-single-entry-install.md) (`installEntry`) and, transitively, [FR-007](./FR-007-reconcile.md) (`reconcile`).
