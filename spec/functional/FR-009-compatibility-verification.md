---
id: FR-009
title: "Host-Driven Compatibility Verification of Candidates"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/usecase/US-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "requires"
    cardinality: "1:1"
---

# [FR-009] Host-Driven Compatibility Verification of Candidates

## Description

Where the caller supplies a `CandidateVerifier`, the library SHALL include a
candidate only when the host's `verify` callback accepts that candidate's
CDN-fetched manifest, dropping every other candidate. The library SHALL NOT itself
parse manifest text in any format (YAML, JSON, or otherwise); interpretation
belongs entirely to the host callback. The detailed fetch, drop, and
capability-attachment steps are specified under Behavior below.

## Inputs

- `CandidateVerifier`: `manifestPath` (e.g. `"manifest.yaml"`) and
  `verify(rawManifest) => { capabilities?: unknown } | null`.
- The candidate results produced by [FR-008](./FR-008-candidate-search.md).

## Outputs

- The result set after verification: incompatible candidates removed; each surviving
  result marked `verified: true` and carrying the host-supplied `capabilities`. A
  candidate dropped because its manifest was _unreachable_ (as opposed to absent)
  contributes a `SearchBackendError` so the host can tell a real failure from an
  incompatible package.

## Behavior

- Where a `verifier` is given, the library SHALL fetch each npm candidate's
  manifest via `https://unpkg.com/{package}/{manifestPath}` and each GitHub
  candidate's manifest via
  `https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{manifestPath}`, through
  the same injectable `HttpFetcher`.
- Before building a manifest URL, the library SHALL reject a registry-supplied
  `name`/`fullName` whose path segments contain `..` or any control character,
  dropping that candidate without issuing a fetch, so a hostile registry entry
  cannot traverse within the trusted CDN authority. (`manifestPath` is host-supplied
  and therefore trusted.)
- When a manifest fetch returns `404`, the library SHALL drop the candidate as
  incompatible (no manifest at the declared path) without recording an error.
- If a manifest fetch rejects or returns a non-OK status other than `404`, then the
  library SHALL drop the candidate as _unverified_ and record one
  `SearchBackendError` marked transient, so a CDN/registry blip is not silently
  conflated with incompatibility.
- If `verify(rawManifest)` returns `null`, then the library SHALL drop the candidate.
- If `verify(rawManifest)` returns an object, then the library SHALL mark the
  candidate `verified: true` and attach `capabilities` from that object.
- If `verify(rawManifest)` throws, then the library SHALL drop only that candidate
  (treated as unverified) and SHALL NOT let the error escape `searchPlugins`.
- Where no `verifier` is given, the library SHALL skip verification and return
  candidates with `verified` left unset.
- The library SHALL cap manifest-fetch concurrency at no more than six simultaneous
  `HttpFetcher` calls so a large candidate set does not issue unbounded requests.

## Acceptance Criteria

| ID          | Criteria                                                                                                                                                                        | Verification  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-009-AC-1 | With a verifier supplied, a candidate whose `verify` returns an object survives with `verified:true` and the returned `capabilities` attached.                                  | Test (TC-037) |
| FR-009-AC-2 | A candidate whose `verify` returns `null` is removed from the results.                                                                                                          | Test (TC-038) |
| FR-009-AC-3 | A candidate whose manifest fetch returns `404` is dropped as incompatible with no error recorded, and `verify` is not called.                                                   | Test (TC-039) |
| FR-009-AC-4 | The npm manifest is fetched from an `unpkg.com/{package}/{manifestPath}` URL and the GitHub manifest from a `raw.githubusercontent.com/{owner}/{repo}/HEAD/{manifestPath}` URL. | Test (TC-040) |
| FR-009-AC-5 | With no verifier supplied, results are returned unfiltered with `verified` unset and no manifest fetch occurs.                                                                  | Test (TC-041) |
| FR-009-AC-6 | A manifest fetch that rejects or returns a non-`404` non-OK status drops the candidate as unverified and records a transient `SearchBackendError`.                              | Test (TC-058) |
| FR-009-AC-7 | A `verify` callback that throws drops only that candidate; no error escapes `searchPlugins` and other candidates are unaffected.                                                | Test (TC-059) |
| FR-009-AC-8 | No more than six manifest fetches are in flight simultaneously for a candidate set larger than six.                                                                             | Test (TC-060) |
| FR-009-AC-9 | A candidate whose registry-supplied name contains a `..` path segment or a control character is dropped before any manifest fetch is issued.                                    | Test (TC-067) |

## Constraints

| ID           | Constraint                                                                                                                                                         | Type     | Validation    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------- |
| FR-009-CON-1 | The library SHALL NOT interpolate a registry-supplied name containing a `..` path segment or a control character into a manifest URL; such a candidate is dropped. | Security | Test (TC-067) |

## Dependencies

- Implements [US-003](../usecase/US-003-discover-plugins-by-tag.md).
- Requires [FR-008](./FR-008-candidate-search.md) (the candidates it verifies).
- Constrained by [NFR-005](../non-functional/NFR-005-injectable-discovery-transport.md).
