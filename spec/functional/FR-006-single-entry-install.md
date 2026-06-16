---
id: FR-006
title: "Single-Entry Install and Materialization"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "requires"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-005"
    type: "requires"
    cardinality: "1:1"
---

## Description

The library SHALL export `installEntry(entry, opts)` which resolves a single
`MarketplaceEntry`, materializes its content under `<targetRoot>/<name>`, upserts
the install into the registry, and returns the resulting `InstalledPlugin`.
`InstallOptions` extends `ResolveOptions` with `targetRoot`, `registryPath`, a
host-supplied `readName(dir)` callback, and an optional `materialize` mode
(`"copy"` default, or `"symlink"`).

## Behavior

`installEntry` SHALL:

- Resolve the entry's source via `resolveSource` (FR-004).
- Compute the content root: `<resolved.dir>/<entry.path>` when `entry.path` is set,
  otherwise `resolved.dir`. (This applies `entry.path` against a whole-repo source,
  complementing the `git-subdir` sparse-checkout.)
- Derive the install name: `entry.name` when present, otherwise
  `opts.readName(contentRoot)` — the host's callback derives the name from
  resolved content (the library never inspects payload semantics).
- Create `targetRoot`, then materialize the content root into
  `<targetRoot>/<name>`: when a target already exists it is removed first; in
  `"symlink"` mode a directory symlink is created pointing at the content root, and
  in `"copy"` mode (default) the content is recursively copied. **Note:** the
  remove-then-create is **not atomic** — if the create fails after the remove, the
  prior materialized module is gone (spec.md §10/§14). **Note:** a `"symlink"`
  target points into the mutable per-URL cache worktree, so it is not pin-stable if
  that cache later checks out a different ref; `"copy"` (the default) is pin-stable.
- Build an `InstalledPlugin` record (`name`, `source`, `ref`, `sha`,
  `resolvedPath = contentRoot`, `targetPath`, `installedAt = now ISO-8601`) and
  persist it via `writeRegistry(upsertPlugin(readRegistry(registryPath), record))`
  (FR-005), then return the record.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                         | Verification  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-006-AC-1 | Installing a named `git-subdir` entry materializes the subdir under `targetPath` (its files are present), records the resolved sha, and writes a registry entry under that name. | Test (TC-014) |
| FR-006-AC-2 | Installing an entry with no `name` derives the name via `readName` on the resolved content root.                                                                                 | Test (TC-015) |
| FR-006-AC-3 | An entry with `entry.path` against a whole-repo `git` source materializes the named subdir's content under `targetPath`.                                                         | Test (TC-016) |
| FR-006-AC-4 | With `materialize: "symlink"`, the target is a symbolic link; re-installing the same name (a different pin) replaces it and the target is still a symlink.                       | Test (TC-017) |

## Dependencies

- Implements StR-001 (host supplies `readName`; library is payload-agnostic).
- Requires FR-004 (`resolveSource`) and FR-005 (registry read/upsert/write).
- Consumed by FR-007 (`reconcile` calls `installEntry` for missing/repinned entries).
