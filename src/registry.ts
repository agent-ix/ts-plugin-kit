import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import { Source } from "./sources.js";

/** A record of one installed plugin/module, persisted in the registry file. */
export interface InstalledPlugin {
  name: string;
  source: Source;
  /** The git ref (tag/branch) that was requested, if any. */
  ref?: string;
  /** The resolved commit sha — the durable pin used for drift detection. */
  sha?: string;
  /** The cache path the content was materialized from. */
  resolvedPath: string;
  /** The materialized path under the host's target dir. */
  targetPath: string;
  installedAt: string;
}

export interface PluginRegistry {
  schemaVersion: 1;
  plugins: InstalledPlugin[];
}

/** Read the registry file, returning an empty registry if absent or malformed. */
export function readRegistry(path: string): PluginRegistry {
  if (!existsSync(path)) return { schemaVersion: 1, plugins: [] };
  const data = JSON.parse(readFileSync(path, "utf8")) as { plugins?: unknown };
  if (!Array.isArray(data.plugins)) return { schemaVersion: 1, plugins: [] };
  return { schemaVersion: 1, plugins: data.plugins as InstalledPlugin[] };
}

/** Write the registry atomically (temp file + rename). */
export function writeRegistry(path: string, reg: PluginRegistry): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(reg, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Return a new registry with `plugin` upserted by name (last write wins). */
export function upsertPlugin(
  reg: PluginRegistry,
  plugin: InstalledPlugin,
): PluginRegistry {
  return {
    schemaVersion: 1,
    plugins: [...reg.plugins.filter((p) => p.name !== plugin.name), plugin],
  };
}
