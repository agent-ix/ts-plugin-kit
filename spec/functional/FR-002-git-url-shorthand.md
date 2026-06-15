---
id: FR-002
title: "Git URL Shorthand Expansion"
artifact_type: FR
relationships:
  - target: "ix://agent-ix/ts-plugin-kit/spec/stakeholder/StR-001"
    type: "implements"
    cardinality: "1:1"
  - target: "ix://agent-ix/ts-plugin-kit/spec/functional/FR-004"
    type: "references"
    cardinality: "1:1"
---

## Description

The library SHALL export `toGitUrl(raw)` which expands a git reference to a
clonable URL: a full URL (containing `://` or starting with `git@`) passes through
unchanged, and an `owner/repo` shorthand expands to
`https://github.com/owner/repo.git`.

## Behavior

`toGitUrl` SHALL:

- Trim surrounding whitespace from the input.
- Return the input unchanged when it contains `://` (e.g. `https://example.com/x.git`)
  or begins with `git@` (e.g. `git@github.com:owner/repo.git`).
- Otherwise treat the input as an `owner/repo` shorthand, strip a trailing `.git`
  if present, and return `https://github.com/<owner>/<repo>.git`.

`toGitUrl` is used by FR-004 to expand the `github` variant's `repo` and the
`git` / `git-subdir` variant's `url` before cloning.

## Acceptance Criteria

| ID          | Criteria                                                                                                       | Verification  |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------- |
| FR-002-AC-1 | `toGitUrl("agent-ix/spec-objects-business")` returns `https://github.com/agent-ix/spec-objects-business.git`.  | Test (TC-003) |
| FR-002-AC-2 | `toGitUrl("owner/repo.git")` strips the trailing `.git` and returns `https://github.com/owner/repo.git`.       | Test (TC-003) |
| FR-002-AC-3 | `toGitUrl("https://example.com/x.git")` passes through unchanged.                                              | Test (TC-003) |
| FR-002-AC-4 | `toGitUrl("git@github.com:owner/repo.git")` passes through unchanged.                                          | Test (TC-003) |
| FR-002-AC-5 | Surrounding whitespace is trimmed before classification (e.g. `"  owner/repo  "` yields the GitHub https URL). | Test (TC-003) |

## Dependencies

- Implements StR-001.
- Referenced by FR-004 (resolution expands the source URL via `toGitUrl`).
