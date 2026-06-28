---
id: FR-012
title: "Render a Source as a Host Install-Input String"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/usecase/US-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "requires"
    cardinality: "1:1"
---

# [FR-012] Render a Source as a Host Install-Input String

## Description

The library SHALL export `sourceToInstallInput(source)` which renders a typed
[`Source`](./FR-001-typed-source-union.md) as its single **canonical source
string** — the same token form a host's string-based install entry point accepts —
so a discovery result can flow into an existing install path without a parallel
install API. The kit makes no assumption about the host's UI; the name reflects the
common host shape (a string install field), not a required one.

**Known limitation.** A `git-subdir` source is **lossy** under this rendering: the
returned `url` omits the `path` subdir, because a single token cannot express both.
Hosts that must preserve a subdir SHOULD pass the structured `Source` rather than
the rendered string.

## Inputs

- A normalized `Source` (any variant of the union).

## Outputs

- A string: the install token for that source.

## Behavior

- For an `npm` source the library SHALL return the `package`.
- For a `github` source the library SHALL return the `owner/repo` value.
- For a `git` or `url` source the library SHALL return the `url`.
- For a `path` source the library SHALL return the `path`.
- For a `git-subdir` source the library SHALL return the `url` (the subdir is not
  expressible as a single install token).

## Acceptance Criteria

| ID          | Criteria                                                                                     | Verification  |
| ----------- | -------------------------------------------------------------------------------------------- | ------------- |
| FR-012-AC-1 | An `npm` source renders to its `package`, and a `github` source renders to its `owner/repo`. | Test (TC-051) |
| FR-012-AC-2 | `git`/`url` sources render to their `url`, and a `path` source renders to its `path`.        | Test (TC-052) |

## Dependencies

- Implements [US-003](../usecase/US-003-discover-plugins-by-tag.md).
- Requires [FR-001](./FR-001-typed-source-union.md) (the `Source` union it renders).
