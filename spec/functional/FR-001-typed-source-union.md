---
id: FR-001
title: "Typed Source Union and Structural Validation"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "implements"
    cardinality: "1:1"
---

## Description

The library SHALL define a discriminated `Source` union keyed by a string `type`
field, with the variants and required fields below, and SHALL export
`normalizeSource(source)` which validates a descriptor's required string fields
and returns it, throwing `SourceError` on malformed input.

Variants (from `src/sources.ts`):

- `github` — `repo` (required), `ref?`, `sha?`
- `git-subdir` — `url` (required), `path` (required), `ref?`, `sha?`
- `git` — `url` (required), `ref?`, `sha?`
- `url` — `url` (required), `ref?`, `sha?` — reserved (resolution deferred, [FR-004](./FR-004-source-resolution.md))
- `path` — `path` (required)
- `npm` — `package` (required), `version?`, `registry?` — reserved (resolution
  deferred; exists so hosts can build install specs, [FR-004](./FR-004-source-resolution.md))

The library SHALL also export `SourceType` (the `type` discriminant), `SourceError`
(structurally invalid descriptor), and `UnsupportedSourceError` (valid but
not-yet-resolvable type — raised by [FR-004](./FR-004-source-resolution.md), not by `normalizeSource`).

## Behavior

`normalizeSource` SHALL:

- Throw `SourceError` with the message "source must have a string type" when the
  input is null/undefined or its `type` field is not a string.
- For each known variant, require that its mandatory field(s) are non-empty
  strings, throwing `SourceError` naming the missing field otherwise (the message
  contains the field name, e.g. `repo`, `url`, `path`, `package`).
- Throw `SourceError` whose message contains `unknown source type` for any `type`
  value not in the union.
- Return the input descriptor unchanged when valid (validation is structural, not
  transforming).

`normalizeSource` SHALL accept every valid variant — `github`, `git`,
`git-subdir`, `url`, `path`, and `npm` — including the two reserved types, because
validation of a descriptor is distinct from its resolution ([FR-004](./FR-004-source-resolution.md)).

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                                  | Verification  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-001-AC-1 | `normalizeSource` returns the descriptor with its `type` preserved for each of the six valid variants (`github`, `git`, `git-subdir`, `url`, `path`, `npm`).                              | Test (TC-001) |
| FR-001-AC-2 | `normalizeSource(null)` and an object with no string `type` both throw `SourceError` (message mentions `` `type` `` for the latter).                                                      | Test (TC-002) |
| FR-001-AC-3 | A variant missing its required field throws `SourceError` whose message names that field: `github`→`repo`, `git`→`url`, `git-subdir`→`path`, `url`→`url`, `path`→`path`, `npm`→`package`. | Test (TC-002) |
| FR-001-AC-4 | An unknown `type` throws `SourceError` whose message contains `unknown source type`.                                                                                                      | Test (TC-002) |

## Dependencies

- Implements [StR-001](../stakeholder/StR-001-shared-zero-dep-install-mechanism.md) (typed, framework-agnostic source contract).
- Consumed by [FR-003](./FR-003-manifest-validation.md) (manifest entry validation), [FR-004](./FR-004-source-resolution.md) (resolution), and [FR-005](./FR-005-install-registry.md)
  (registry records the source).
