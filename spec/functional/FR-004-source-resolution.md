---
id: FR-004
title: "Synchronous Source Resolution and Pinning"
artifact_type: FR
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
`ref?`). `git` (via the injectable `GitRunner`, default `defaultGitRunner` using
`execFileSync`) SHALL be the only side effect. `ResolveOptions` carries a
`cacheRoot` (sources cached under `<cacheRoot>/git/<key>`) and an optional `git`
runner. The function SHALL validate the source via `normalizeSource` (FR-001) and
expand git URLs via `toGitUrl` (FR-002).

## Behavior

`resolveSource` SHALL:

- **`path` source**: resolve `source.path` to an absolute path; if it does not
  exist, throw `SourceError("path source not found: <dir>")`; otherwise return
  `{ dir }` (no `sha`, no `ref`).
- **`url` / `npm` source**: throw `UnsupportedSourceError` (message mentions the
  type is not yet supported) — these reserved types are not resolved.
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
consumer (FR-006). The library defines no dedicated `ResolveError` today (see
spec.md §14 Known Limitations).

**`defaultGitRunner`.** The default runner shells out via
`execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe",
"pipe"] })`; an injected `GitRunner` replaces it so tests run with no real git
(FR-004-AC-7).

## Constraints

| ID           | Constraint                                                                                                                          | Type          | Validation    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| FR-004-CON-1 | Git is the sole side effect; resolution performs no other I/O beyond filesystem reads/dir creation and the `git` subprocess.        | architectural | Test (TC-011) |
| FR-004-CON-2 | The clone is blobless and no-checkout (`--filter=blob:none --no-checkout`); subdir sources sparse-checkout only the requested path. | performance   | Test (TC-008) |

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                    | Verification  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-004-AC-1 | A `path` source for an existing directory returns `{ dir }` pointing at that directory (its contents are readable).                                                         | Test (TC-006) |
| FR-004-AC-2 | A `path` source for a non-existent directory throws `SourceError`.                                                                                                          | Test (TC-006) |
| FR-004-AC-3 | A `url` source and an `npm` source each throw `UnsupportedSourceError`.                                                                                                     | Test (TC-007) |
| FR-004-AC-4 | A `git-subdir` source pinned to a tag returns `dir` ending in the subdir path, contains the subdir's files, and reports the tag's `sha` and the requested `ref`.            | Test (TC-008) |
| FR-004-AC-5 | A whole-repo `git` source with no pin resolves to `HEAD` (latest commit); re-resolving the same cached URL at a tag exercises the fetch branch and resolves that tag's sha. | Test (TC-009) |
| FR-004-AC-6 | A `git` source pinned by `sha` checks out exactly that commit.                                                                                                              | Test (TC-010) |
| FR-004-AC-7 | A `github` source resolved with an injected `GitRunner` performs no real git: the returned `sha` is the runner's output and the first git argv is `clone`.                  | Test (TC-011) |

## Dependencies

- Implements StR-002 (durable sha pinning).
- Requires FR-001 (`normalizeSource`) and FR-002 (`toGitUrl`).
- Consumed by FR-006 (`installEntry`) and, transitively, FR-007 (`reconcile`).
