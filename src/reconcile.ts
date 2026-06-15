import { existsSync } from "node:fs";

import { MarketplaceEntry, MarketplaceManifest } from "./manifest.js";
import { InstallOptions, installEntry } from "./install.js";
import { InstalledPlugin, readRegistry } from "./registry.js";

export interface ReconcileOptions extends InstallOptions {
  /** "lazy" (default): install only what's missing/repinned, zero git when settled. "sync": re-resolve all. */
  mode?: "lazy" | "sync";
}

export interface ReconcileResult {
  installed: InstalledPlugin[];
  unchanged: InstalledPlugin[];
  updated: InstalledPlugin[];
  skipped: MarketplaceEntry[];
}

function pinMatches(
  existing: InstalledPlugin,
  entry: MarketplaceEntry,
): boolean {
  const src = entry.source as { ref?: string; sha?: string };
  if (src.sha) return existing.sha === src.sha;
  return existing.ref === src.ref;
}

/**
 * Reconcile a manifest's default set into `targetRoot`. In lazy mode an entry
 * that is already present and pinned to the same ref/sha is reported as
 * `unchanged` with **no** git invocation — the hot path for every CLI run.
 */
export function reconcile(
  manifest: MarketplaceManifest,
  opts: ReconcileOptions,
): ReconcileResult {
  const mode = opts.mode ?? "lazy";
  const result: ReconcileResult = {
    installed: [],
    unchanged: [],
    updated: [],
    skipped: [],
  };
  const reg = readRegistry(opts.registryPath);

  for (const entry of manifest.entries) {
    if (entry.defaultEnabled === false) {
      result.skipped.push(entry);
      continue;
    }
    const existing = reg.plugins.find((p) => p.name === entry.name);
    const present = existing !== undefined && existsSync(existing.targetPath);
    if (mode === "lazy" && present && pinMatches(existing, entry)) {
      result.unchanged.push(existing);
      continue;
    }
    const installed = installEntry(entry, opts);
    if (existing === undefined) result.installed.push(installed);
    else if (mode === "sync" && existing.sha === installed.sha)
      result.unchanged.push(installed);
    else result.updated.push(installed);
  }
  return result;
}
