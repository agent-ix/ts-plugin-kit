---
id: FR-005
title: "Install Registry: Read, Atomic Write, and Upsert"
artifact_type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-002"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "requires"
    cardinality: "1:1"
---

## Description

The library SHALL define `InstalledPlugin` (`name`, `source`, `ref?`, `sha?`,
`resolvedPath`, `targetPath`, `installedAt`) and `PluginRegistry`
(`schemaVersion: 1`, `plugins: InstalledPlugin[]`), and SHALL export
`readRegistry(path)`, `writeRegistry(path, reg)`, and `upsertPlugin(reg, plugin)`.

## Behavior

- `readRegistry(path)` SHALL return `{ schemaVersion: 1, plugins: [] }` when the
  file is absent, and SHALL also return an empty registry when the file is **valid
  JSON whose `plugins` is not an array** (e.g. `{}`); otherwise it returns the
  parsed `plugins` array. It SHALL NOT throw for a missing or shape-invalid file.
  **Backsync note:** the implementation parses with an unguarded `JSON.parse`
  (`registry.ts:35`), so a file that is _not valid JSON_ (e.g. a truncated
  half-written file) currently throws `SyntaxError` rather than degrading to empty;
  the registry is written atomically (below) precisely to avoid producing such a
  file. This requirement therefore scopes "shape-invalid" to valid-JSON-wrong-shape
  and does not claim malformed-JSON tolerance.
- `writeRegistry(path, reg)` SHALL create the parent directory, write the registry
  as pretty-printed JSON (2-space indent, trailing newline) to a sibling temp file
  named `<path>.<pid>.tmp`, then `rename` it over the target — an **atomic**
  temp+rename so a crash mid-write never leaves a partial registry.
- `upsertPlugin(reg, plugin)` SHALL return a **new** registry whose `plugins` is
  the prior list with any entry of the same `name` removed and `plugin` appended
  (last-write-wins by name); the input registry is not mutated.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                          | Verification  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-005-AC-1 | `readRegistry` on a missing path returns `plugins === []`; on a valid-JSON file containing `{}` (no `plugins` array) it also returns `plugins === []`.            | Test (TC-012) |
| FR-005-AC-2 | `writeRegistry` to a nested (not-yet-existing) path creates the directory and the written registry round-trips through `readRegistry` with the same plugin count. | Test (TC-013) |
| FR-005-AC-3 | `upsertPlugin` replacing an existing name keeps the plugin count at 1 and reflects the new field value (e.g. an added `sha`).                                     | Test (TC-013) |

## Dependencies

- Implements StR-002 (the registry persists the durable sha and requested ref).
- Requires FR-001 (`InstalledPlugin.source` is a typed `Source`).
- Consumed by FR-006 (`installEntry` upserts the record) and FR-007 (`reconcile`
  reads the registry to decide unchanged vs install/update).
