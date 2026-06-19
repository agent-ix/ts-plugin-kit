# ts-plugin-kit

Framework-agnostic plugin/marketplace toolkit: typed git/npm sources, ref/sha pinning, install registry, and default-set reconciliation. **Zero runtime dependencies.**

It is the install mechanism shared by Agent-IX CLIs and any other host (the `ix` CLI, `quoin`, a future desktop app). It knows nothing about oclif or any particular plugin payload — a host supplies a `readName` callback and decides what to do with the resolved files.

## Install

Published on the public npm registry:

```bash
npm install @agent-ix/ts-plugin-kit
```

## Usage

```ts
import {
  reconcile,
  validateMarketplaceManifest,
} from "@agent-ix/ts-plugin-kit";

// host parses YAML/JSON itself, then validates the object
const manifest = validateMarketplaceManifest(parsedYaml);

const result = reconcile(manifest, {
  mode: "lazy", // install only what's missing/repinned; zero git when settled
  cacheRoot: "~/.cache/ix/ts-plugin-kit",
  targetRoot: "~/.ix/filament/modules", // <name>/ materialized here
  registryPath: "~/.ix/filament/registry.json",
  readName: (dir) => /* derive a name from the resolved content */ "...",
});
// result.{installed, unchanged, updated, skipped}
```

A manifest entry's `source` is one of:

| `type`        | fetches                                              |
| ------------- | ---------------------------------------------------- |
| `github`      | `owner/repo` at a `ref`/`sha`                        |
| `git-subdir`  | one **sparse-checked-out** subdir of a repo at a pin |
| `git`         | any git URL at a `ref`/`sha`                         |
| `path`        | a local directory (dev)                              |
| `url` / `npm` | reserved — resolution not yet implemented            |

All operations are **synchronous** (git is the only side effect) and pins are recorded as resolved commit shas, so a settled lazy `reconcile` performs no git at all.

Included:

- ✅ CI via [`agent-ix/nodejs-actions`](https://github.com/agent-ix/nodejs-actions)
- 📦 **Local Development** via [PNPM](https://pnpm.io/) + Corepack
- 🧪 Jest for unit testing (supports coverage, JSON output)
- 💃 Prettier and ESLint for code quality
- 🏷 Tag-triggered release workflow with registry support
- 🔖 Automatic versioning based on Git tags

---

## 🚀 Getting Started

This project uses **pnpm** with **Corepack** for local development.

### Prerequisites

- Node.js 20+
- Corepack enabled (`corepack enable`)

### Setup

```bash
# Install dependencies (uses pnpm version from package.json)
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm run test
```

---

## 📜 Scripts

All development commands are defined in `package.json` scripts.
Run `pnpm run help` or `pnpm run` to see the full list.

### Core Development

| Command           | Description                             |
| ----------------- | --------------------------------------- |
| `pnpm run build`  | Compile TypeScript                      |
| `pnpm test`       | Run tests                               |
| `pnpm run lint`   | Run ESLint                              |
| `pnpm run format` | Run Prettier                            |
| `pnpm run clean`  | Remove build artifacts and node_modules |

### Package Management

| Command                        | Description                              |
| ------------------------------ | ---------------------------------------- |
| `pnpm run pkg:add <pkg>`       | Add dependency                           |
| `pnpm run pkg:add-dev <pkg>`   | Add dev dependency                       |
| `pnpm run pkg:update`          | Update dependencies                      |
| `pnpm run pkg:use-local <pkg>` | Link local package via @agent-ix/js-deps |

### Publishing & Docker

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| `pnpm run publish`       | Publish to the public npm registry (upstream) |
| `pnpm run publish:local` | Publish to local npm.ix registry (via Docker) |
| `pnpm run docker:build`  | Build release Docker image                    |

---

## 🛠 Makefile

A `Makefile` is provided for backwards compatibility. It delegates all commands to the equivalent `pnpm run` scripts.

```bash
make build          # -> pnpm run build
make test           # -> pnpm run test
make local-publish  # -> pnpm run publish:local
```
