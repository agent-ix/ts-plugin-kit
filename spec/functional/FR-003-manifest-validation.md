---
id: FR-003
title: "Marketplace Manifest Validation"
artifact_type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "requires"
    cardinality: "1:1"
---

## Description

The library SHALL define `MarketplaceManifest` (`schemaVersion: 1`, optional
`name`, `entries: MarketplaceEntry[]`) and `MarketplaceEntry` (`name?`, `source`,
`version?`, `defaultEnabled?`, `path?`), and SHALL export
`validateMarketplaceManifest(obj)` which validates a host-parsed plain object into
a `MarketplaceManifest`, throwing `ManifestError` on malformed input. The host
parses YAML/JSON itself and passes the object, keeping the library
dependency-free.

## Behavior

`validateMarketplaceManifest` SHALL:

- Throw `ManifestError("manifest must be an object")` when the input is not a
  non-null object.
- Throw `ManifestError` (message mentions `schemaVersion`) when `schemaVersion`
  is not exactly `1`.
- Throw `ManifestError` (message mentions `array`) when `entries` is not an array.
- Carry through `name` only when it is a string, otherwise leave it `undefined`.
- Validate each entry (by index): throw `ManifestError` (message of the form
  "entry &lt;i&gt; must be an object") for a non-object entry; throw `ManifestError`
  (message mentions `non-empty name`) when an entry's `name` is missing or empty;
  and run
  `normalizeSource(entry.source)` (FR-001), which throws `SourceError` for a bad
  source — note that, unlike `installEntry` (FR-006), a manifest entry's `name`
  is **required** here.

Each `MarketplaceEntry` field has the following meaning: `version` is an
informational pin label not used for resolution; `defaultEnabled` defaults to
true and, when `false`, causes reconcile to skip the entry (FR-007); `path` is an
optional subdir within the resolved source that holds the module root (FR-006).

## Acceptance Criteria

| ID          | Criteria                                                                                                                                    | Verification  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-003-AC-1 | A valid manifest with a `name` and one entry round-trips: `name` is preserved and `entries` has length 1.                                   | Test (TC-004) |
| FR-003-AC-2 | A valid manifest with no `name` yields `name === undefined`.                                                                                | Test (TC-004) |
| FR-003-AC-3 | `validateMarketplaceManifest(null)` throws `ManifestError`; a non-object (e.g. `"x"`) throws with message mentioning "must be an object".   | Test (TC-005) |
| FR-003-AC-4 | `schemaVersion !== 1` throws `ManifestError` mentioning `schemaVersion`; non-array `entries` throws mentioning `array`.                     | Test (TC-005) |
| FR-003-AC-5 | A `null` entry throws `ManifestError` mentioning "entry 0 must be"; an entry without a non-empty `name` throws mentioning "non-empty name". | Test (TC-005) |
| FR-003-AC-6 | An entry whose `source.type` is invalid causes `normalizeSource` to throw `SourceError`.                                                    | Test (TC-005) |

## Dependencies

- Implements StR-001 (host-parsed object keeps the library dep-free).
- Requires FR-001 (`normalizeSource` validates each entry's source).
