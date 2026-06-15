import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { MarketplaceEntry } from "./manifest.js";
import { ResolveOptions, resolveSource } from "./resolve.js";
import {
  InstalledPlugin,
  readRegistry,
  upsertPlugin,
  writeRegistry,
} from "./registry.js";

export interface InstallOptions extends ResolveOptions {
  /** Directory under which materialized modules live (`<targetRoot>/<name>`). */
  targetRoot: string;
  /** Path to the registry JSON file. */
  registryPath: string;
  /** Host-supplied: derive a module name from its content dir (keeps this lib domain-agnostic). */
  readName: (dir: string) => string;
  /** "copy" (default) materializes owned files; "symlink" points at the cache. */
  materialize?: "symlink" | "copy";
}

function materialize(
  src: string,
  dest: string,
  mode: "symlink" | "copy",
): void {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  if (mode === "symlink") symlinkSync(src, dest, "dir");
  else cpSync(src, dest, { recursive: true });
}

/**
 * Resolve a single entry, materialize it under `targetRoot`, and upsert the
 * registry. `entry.name` wins; otherwise the name is derived via `readName`.
 */
export function installEntry(
  entry: MarketplaceEntry,
  opts: InstallOptions,
): InstalledPlugin {
  const resolved = resolveSource(entry.source, opts);
  const contentRoot = entry.path
    ? join(resolved.dir, entry.path)
    : resolved.dir;
  const name = entry.name ?? opts.readName(contentRoot);
  const target = join(opts.targetRoot, name);

  mkdirSync(opts.targetRoot, { recursive: true });
  materialize(contentRoot, target, opts.materialize ?? "copy");

  const record: InstalledPlugin = {
    name,
    source: entry.source,
    ref: resolved.ref,
    sha: resolved.sha,
    resolvedPath: contentRoot,
    targetPath: target,
    installedAt: new Date().toISOString(),
  };
  writeRegistry(
    opts.registryPath,
    upsertPlugin(readRegistry(opts.registryPath), record),
  );
  return record;
}
