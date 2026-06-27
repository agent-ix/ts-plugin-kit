---
id: Task-001
title: "FR-008 candidate search core (search.ts scaffold + HttpFetcher + backends)"
type: Task
status: todo
track: A
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-008
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/usecase/US-003
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/non-functional/NFR-005
    type: references
---

# Task-001: FR-008 candidate search core

## Scope

Stand up `src/search.ts` with the discovery type surface and the `HttpFetcher`
seam, and implement candidate search across npm and GitHub with independent
backends, normalization to `Source`, defensive parsing, the all-fail shape, and
`limit` clamping. (Dedupe/rank/signal/redaction are Task-002.)

## Subtasks

- [ ] Write Vitest specs FIRST in `tests/search.test.ts` with an injected fake `HttpFetcher`:
      TC-022 (merge both backends), TC-023 (encoded `keywords:`/`topic:` + `size`/`per_page`),
      TC-024 (one backend rejects → other returns + `SearchBackendError`), TC-025 (`Authorization`
      iff token; `sources:["npm"]` skips GitHub), TC-043 (all backends fail → `results:[]` + per-backend
      errors), TC-044 (malformed body / missing optionals degrade, no throw), TC-045 (`limit` clamp 250/100).
- [ ] Define types: `HttpResponse`, `HttpFetcher`, `defaultHttpFetcher` (global `fetch`), `SearchBackend`,
      `PluginSearchResult`, `RateLimit`, `SearchBackendError`, `SearchResponse`, `SearchOptions`,
      `CandidateVerifier`, `SearchError`.
- [ ] Implement `searchPlugins(opts)`: per-backend `Promise.allSettled`; npm
      `GET {npmRegistry}/-/v1/search?text=keywords:{tag}[ {query}]&size={limit}`; GitHub
      `GET {githubApi}/search/repositories?q=topic:{tag}[ {query}]&per_page={limit}` with
      `Accept`/`X-GitHub-Api-Version` and conditional `Authorization`; URL-encode the query.
- [ ] Normalize npm→`{type:"npm",package}` and github→`{type:"github",repo:full_name}`; tolerate missing
      `objects[]`/`items[]` (→ `SearchBackendError`) and missing optional item fields (→ `undefined`).
- [ ] Clamp `limit` to npm `size` ≤ 250 and GitHub `per_page` ≤ 100.

## Deliverables

- `src/search.ts` with the type surface, `defaultHttpFetcher`, and `searchPlugins` candidate path.
- `tests/search.test.ts` covering TC-022, TC-023, TC-024, TC-025, TC-043, TC-044, TC-045 (all via fake fetcher).

## Notes

CON-1: every request goes through the injected `HttpFetcher`; tests assert no real
network. Feeds Task-002 (dedupe/rank) and Task-003 (verification).
