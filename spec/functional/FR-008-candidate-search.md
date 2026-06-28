---
id: FR-008
title: "Candidate Plugin Search Across npm and GitHub"
type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/usecase/US-003"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-001"
    type: "requires"
    cardinality: "1:1"
---

# [FR-008] Candidate Plugin Search Across npm and GitHub

## Description

The library SHALL export `searchPlugins(opts)` which, given a discriminator `tag`,
queries the selected backends (`npm` and/or `github`) through an injectable
`HttpFetcher` and returns a `SearchResponse` whose every `PluginSearchResult`
carries a normalized [`Source`](./FR-001-typed-source-union.md). The default
`HttpFetcher` SHALL delegate to the Node global `fetch`, adding no runtime
dependency.

## Inputs

- `SearchOptions`: `tag` (required), optional `query`, `sources`
  (default `["npm","github"]`), `limit` (per backend, default 20), `http`,
  `githubToken`, `npmRegistry`, `githubApi`, `signal`.

## Outputs

- `SearchResponse`: `results` (normalized, deduped, ranked), `rate`
  (per-backend rate-limit snapshots, see [FR-011](./FR-011-github-rate-limit.md)),
  and `errors` (one `SearchBackendError` per failed backend).

- The library SHALL run each selected backend independently via
  `Promise.allSettled`, so a rejecting backend does not prevent the other backend's
  results from being returned.
- When a selected backend rejects or returns a non-OK status, the library SHALL
  record one `SearchBackendError` for it in `errors` and SHALL NOT throw.
- When every selected backend fails, the library SHALL resolve to a `SearchResponse`
  with `results: []` and one `SearchBackendError` per backend, so a host
  distinguishes a total failure from a successful empty search (empty `results`,
  empty `errors`).
- When `npm` is selected, the library SHALL issue
  `GET {npmRegistry}/-/v1/search?text=keywords:{tag}[ {query}]&size={limit}` with
  default `npmRegistry` `https://registry.npmjs.org`.
- For each npm `objects[].package`, the library SHALL emit a result whose `source`
  is `{type:"npm", package:<name>}`.
- When `github` is selected, the library SHALL issue
  `GET {githubApi}/search/repositories?q=topic:{tag}[ {query}]&per_page={limit}`
  (default `githubApi` `https://api.github.com`) with headers
  `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, and
  `Authorization: Bearer {githubToken}` only when a token is supplied.
- For each GitHub `items[]` entry, the library SHALL emit a result whose `source`
  is `{type:"github", repo:<full_name>}`.
- The library SHALL URL-encode the composed query string so a `tag` or `query`
  containing reserved characters does not corrupt the request.
- The library SHALL clamp `limit` to each backend's maximum (npm `size` ≤ 250,
  GitHub `per_page` ≤ 100) so a large `limit` cannot provoke a backend `422`.
- When a backend body is structurally invalid (missing or non-array
  `objects[]`/`items[]`), the library SHALL record a `SearchBackendError` for that
  backend rather than throwing; a per-item entry missing an optional field
  (`links.repository`, `author`, `stargazers_count`, `updatedAt`) SHALL degrade to
  an `undefined` result field, never an exception.
- The library SHALL merge results across backends and dedupe an npm package against
  a GitHub repository when their repository URLs are equal after normalization
  (lowercased host/owner/repo, stripped `git+`, scheme, trailing `/`, and `.git`),
  preferring the npm entry while carrying the matched repository's `stars` and
  `updatedAt` onto it.
- The library SHALL rank the merged set by `stars` descending, then `updatedAt`
  descending, then `fullName` ascending, so ordering is a total order even when
  `stars`/`updatedAt` are absent (treated as the lowest value).
- When `opts.signal` is supplied, the library SHALL pass it to every `HttpFetcher`
  call; an abort SHALL surface as a `SearchBackendError` for the in-flight backend,
  leaving any already-resolved backend's results intact.

## Constraints

| ID           | Constraint                                                                                                                                | Type            | Validation    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------- |
| FR-008-CON-1 | The library SHALL route all discovery network access through the injectable `HttpFetcher`, with no direct transport call that bypasses it | Maintainability | Test (TC-032) |
| FR-008-CON-2 | The library SHALL NOT include the `githubToken` value in any cache key, `SearchBackendError`, or `PluginSearchResult`                     | Security        | Test (TC-064) |

## Acceptance Criteria

| ID           | Criteria                                                                                                                                                                                   | Verification  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| FR-008-AC-1  | A search over both backends returns npm results sourced as `{type:"npm",…}` and GitHub results sourced as `{type:"github",…}`, merged into one ranked list.                                | Test (TC-032) |
| FR-008-AC-2  | The composed npm URL contains `keywords:{tag}` and the GitHub URL contains `topic:{tag}`, both URL-encoded; `limit` maps to npm `size` and GitHub `per_page`.                              | Test (TC-033) |
| FR-008-AC-3  | When one backend's fetch rejects, the other backend's results are returned and a `SearchBackendError` for the failed backend appears in `errors`.                                          | Test (TC-034) |
| FR-008-AC-4  | A GitHub request carries `Authorization: Bearer …` when a token is supplied and omits it when none is; `sources:["npm"]` issues no GitHub request.                                         | Test (TC-035) |
| FR-008-AC-5  | An npm package whose normalized `links.repository` matches a returned GitHub repository collapses to one result, preferring the npm entry and carrying the repo's stars/updatedAt onto it. | Test (TC-036) |
| FR-008-AC-6  | When every selected backend fails, the response is `results: []` with one `SearchBackendError` per backend and no thrown error.                                                            | Test (TC-053) |
| FR-008-AC-7  | A structurally-invalid backend body yields a `SearchBackendError` for that backend (no throw); items missing optional fields degrade to `undefined`, not an exception.                     | Test (TC-054) |
| FR-008-AC-8  | A `limit` above a backend maximum is clamped (npm `size` ≤ 250, GitHub `per_page` ≤ 100).                                                                                                  | Test (TC-055) |
| FR-008-AC-9  | Ranking is a total order — results with absent `stars`/`updatedAt` sort last and ties break on `fullName`, giving a stable deterministic order.                                            | Test (TC-056) |
| FR-008-AC-10 | A supplied `opts.signal` is passed to every `HttpFetcher` call; an abort surfaces as a `SearchBackendError` for the in-flight backend and preserves resolved results.                      | Test (TC-057) |

## Dependencies

- Implements [US-003](../usecase/US-003-discover-plugins-by-tag.md).
- Requires [FR-001](./FR-001-typed-source-union.md) (results normalize to the typed
  `Source` union).
- Constrained by [NFR-001](../non-functional/NFR-001-zero-runtime-dependencies.md)
  and [NFR-005](../non-functional/NFR-005-injectable-discovery-transport.md).
