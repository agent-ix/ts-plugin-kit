---
id: Task-006
title: "FR-012 sourceToInstallInput (canonical source string)"
type: Task
status: todo
track: C
priority: P1
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-012
    type: references
  - target: ix://agent-ix/ts-plugin-kit/spec/functional/FR-001
    type: references
---

# Task-006: FR-012 sourceToInstallInput

## Scope

Add `sourceToInstallInput(source)` rendering a typed `Source` to its canonical
source string (the token a host's string-based install entry point accepts).

## Subtasks

- [ ] Write Vitest specs FIRST: TC-041 (npm→`package`, github→`owner/repo`), TC-042 (git/url→`url`, path→`path`).
- [ ] Implement the per-variant mapping; `git-subdir`→`url` (documented lossy — subdir not expressible as one token).

## Deliverables

- `sourceToInstallInput` in `src/search.ts`.
- Tests TC-041, TC-042.

## Notes

Independent of the search pipeline — only needs the `Source` union (FR-001), so it
runs in parallel (Track C).
