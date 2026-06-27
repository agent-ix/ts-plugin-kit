---
id: Task-008
title: "Publish hand-off gate (npm) for filament-ide consumption"
type: Task
status: todo
track: S
priority: P0
relationships:
  - target: ix://agent-ix/ts-plugin-kit/spec/usecase/US-003
    type: references
  - target: ix://agent-ix/ts-plugin-kit/plan/Plan-001-plugin-discovery/tasks/Task-007
    type: depends_on
---

# Task-008: Publish hand-off gate

## Scope

Cut and publish the kit version that exports the discovery surface, so filament-ide
can bump to it. This is the **hand-off gate** between this plan and filament-ide's
discovery work (its US-016 / FR-030…032).

## Subtasks

- [ ] Bump `@agent-ix/ts-plugin-kit` version (minor — additive public surface).
- [ ] `make build` (vite lib + rolled-up `.d.ts`) and verify `searchPlugins`,
      `createPluginSearch`, `createTtlCache`, `sourceToInstallInput`, and all discovery types appear in `dist/`.
- [ ] Publish to the public npm registry (`prepublishOnly` runs the build; `publish:dry-run` first).
- [ ] Record the published version so filament-ide's plan pins to it.

## Deliverables

- Published `@agent-ix/ts-plugin-kit` with the discovery API; version recorded for the downstream bump.

## Notes

filament-ide MUST NOT start consuming `searchPlugins` until this lands on npm —
this gate is the cross-repo sequencing point called out in `plan.md`.
