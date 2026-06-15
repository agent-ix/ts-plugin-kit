import { Source, normalizeSource } from "./sources.js";

/**
 * One entry in a marketplace / default-set manifest.
 *
 * `name` is optional in the type so {@link install.installEntry} can install an
 * ad-hoc source and derive the name via `readName`. Manifests parsed through
 * {@link validateMarketplaceManifest} always require it.
 */
export interface MarketplaceEntry {
  name?: string;
  source: Source;
  /** Informational pin label (e.g. the git tag); not used for resolution. */
  version?: string;
  /** Defaults to true. `false` → reconcile skips the entry. */
  defaultEnabled?: boolean;
  /** Optional subdir within the resolved source that holds the module root. */
  path?: string;
}

export interface MarketplaceManifest {
  schemaVersion: 1;
  name?: string;
  entries: MarketplaceEntry[];
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/**
 * Validate a parsed object into a {@link MarketplaceManifest}. The host parses
 * YAML/JSON itself and passes the plain object here, keeping this library
 * dependency-free.
 */
export function validateMarketplaceManifest(obj: unknown): MarketplaceManifest {
  const m = obj as {
    schemaVersion?: unknown;
    name?: unknown;
    entries?: unknown;
  };
  if (!m || typeof m !== "object")
    throw new ManifestError("manifest must be an object");
  if (m.schemaVersion !== 1)
    throw new ManifestError("manifest schemaVersion must be 1");
  if (!Array.isArray(m.entries))
    throw new ManifestError("manifest entries must be an array");
  const entries = m.entries.map((raw, i) => validateEntry(raw, i));
  return {
    schemaVersion: 1,
    name: typeof m.name === "string" ? m.name : undefined,
    entries,
  };
}

function validateEntry(raw: unknown, index: number): MarketplaceEntry {
  const e = raw as MarketplaceEntry;
  if (!e || typeof e !== "object")
    throw new ManifestError(`entry ${index} must be an object`);
  if (typeof e.name !== "string" || e.name.length === 0) {
    throw new ManifestError(`entry ${index} requires a non-empty name`);
  }
  normalizeSource(e.source as Source);
  return e;
}
