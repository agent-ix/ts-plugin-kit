/**
 * @agent-ix/ts-plugin-kit — a framework-agnostic toolkit for building plugin /
 * marketplace systems: typed git sources, ref/sha pinning, an install registry,
 * and lazy default-set reconciliation. Zero runtime dependencies.
 */
export {
  type Source,
  type SourceType,
  SourceError,
  UnsupportedSourceError,
  normalizeSource,
  toGitUrl,
} from "./sources.js";

export {
  type MarketplaceEntry,
  type MarketplaceManifest,
  ManifestError,
  validateMarketplaceManifest,
} from "./manifest.js";

export {
  type GitRunner,
  type ResolveOptions,
  type ResolvedSource,
  defaultGitRunner,
  resolveSource,
} from "./resolve.js";

export {
  type InstalledPlugin,
  type PluginRegistry,
  readRegistry,
  writeRegistry,
  upsertPlugin,
} from "./registry.js";

export { type InstallOptions, installEntry } from "./install.js";

export {
  type ReconcileOptions,
  type ReconcileResult,
  reconcile,
} from "./reconcile.js";
