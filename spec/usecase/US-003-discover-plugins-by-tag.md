---
id: US-003
title: "Discover and Verify Publishable Plugins by Tag"
type: US
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "traces_to"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-008"
    type: "satisfied_by"
    cardinality: "1:1"
---

## Story

**As a** host application author embedding the toolkit
**I want** to search npm and GitHub for published plugins that carry my plugin
type's discriminator tag, and confirm each candidate is genuinely compatible
**So that** I can offer my users a curated set of installable plugins without
making them browse all of npm or GitHub or hand-type package names.

This story expresses the host's intent in informal language; it does not prescribe
how the toolkit issues queries, parses manifests, or caches results.

## Context

The toolkit already turns a known `Source` into a pinned, materialized install
([US-002](./US-002-install-ad-hoc-source.md)). What a host cannot yet do is _find_
candidate sources in the first place. Each plugin type (Filament modules, oclif
data plugins, a future kind) is published with a conventional marker — an npm
`keywords` entry and/or a GitHub repository `topic` — and a host wants to turn that
marker into a list of install candidates. Because anyone can attach a topic, the
host also needs to _verify_ a candidate really declares the expected plugin
manifest before presenting it, and the toolkit must do this without learning any
plugin type's manifest format (it stays framework-agnostic and dependency-free,
per [StR-001](../stakeholder/StR-001-shared-zero-dep-install-mechanism.md)).

## Acceptance Examples (Illustrative)

These examples clarify the host's expectations; they are illustrative only, not
test cases or verification criteria.

### [US-003-EX-1] Find candidates by tag

- **Given** a discriminator tag the host's plugin type publishes under
- **When** the host searches with that tag
- **Then** it receives candidate results from npm and GitHub, each already shaped
  as a `Source` it could hand to the existing install path

### [US-003-EX-2] Keep only compatible candidates

- **Given** a candidate repository that carries the tag but has no valid plugin
  manifest
- **When** the host runs discovery with its compatibility check supplied
- **Then** that candidate is dropped and only verified, installable plugins remain

### [US-003-EX-3] One slow backend does not sink the search

- **Given** GitHub is temporarily rate-limited
- **When** the host searches
- **Then** npm results still come back, alongside a clearly-marked GitHub error

## Options (Exploratory)

Approaches weighed during discovery, none binding: querying a central marketplace
manifest instead of the public registries; verifying compatibility by downloading
the full package tarball versus fetching only the manifest from a CDN; embedding a
YAML parser in the toolkit versus delegating parsing to the host.

## Dependencies (Contextual)

- Upstream: the host owns the discriminator tag and the compatibility predicate.
- Downstream: candidate `Source` values feed the existing `installEntry` /
  `resolveSource` path; a host install field that accepts a source string is
  served by [FR-012](../functional/FR-012-source-to-install-input.md).

## Traceability (Informative)

This story traces to
[StR-001](../stakeholder/StR-001-shared-zero-dep-install-mechanism.md) (a shared,
framework-agnostic, dependency-free mechanism) and is satisfied by the discovery
functional requirements [FR-008](../functional/FR-008-candidate-search.md) through
[FR-012](../functional/FR-012-source-to-install-input.md).
