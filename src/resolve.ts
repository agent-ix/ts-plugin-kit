import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";

import {
  Source,
  SourceError,
  UnsupportedSourceError,
  normalizeSource,
  toGitUrl,
} from "./sources.js";

/** A runnable `git` — injectable so tests can spy/fake without a real binary. */
export interface GitRunner {
  (args: string[], opts?: { cwd?: string }): { stdout: string };
}

/** Default runner: spawns the system `git` synchronously. */
export const defaultGitRunner: GitRunner = (args, opts) => {
  const stdout = execFileSync("git", args, {
    cwd: opts?.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { stdout };
};

/**
 * Downloads and extracts an npm package tarball into `destDir`, returning the
 * resolved content root and exact published version. Injectable so tests fake
 * it without a real `npm`/network. The default uses `npm pack` + `tar`.
 *
 * **Contract.** A fetcher MUST extract the package so its content root lives at
 * `<destDir>/package` (the layout `npm pack` tarballs already use), and SHOULD
 * return that path as `dir`. `resolveNpm` records only the resolved `version`
 * (the durable pin) durably; on a later exact-version cache hit it serves
 * `<cacheDir>/package` directly and does **not** re-read the `dir` a custom
 * fetcher returned. A fetcher that extracts elsewhere is therefore honored on
 * the miss path but silently ignored on subsequent cached resolves.
 */
export interface NpmFetcher {
  (
    spec: { package: string; version?: string; registry?: string },
    destDir: string,
  ): { dir: string; version: string };
}

/**
 * Build the `npm pack` argv for a spec. Pure + exported so the version (`pkg`
 * vs `pkg@version`) and `--registry` branches stay unit-testable offline.
 */
export function npmPackArgs(
  spec: { package: string; version?: string; registry?: string },
  destDir: string,
): string[] {
  const ref = spec.version ? `${spec.package}@${spec.version}` : spec.package;
  const args = ["pack", ref, "--pack-destination", destDir, "--json"];
  if (spec.registry) args.push("--registry", spec.registry);
  return args;
}

/**
 * Robustly parse the metadata array `npm pack --json` prints. Packing a local
 * dir runs its `prepack`/`prepare`, whose stdout precedes the JSON and may even
 * contain stray `[` brackets (e.g. `[build] done`), so a naive
 * `indexOf("[")` slice mis-parses. Instead, scan candidate `[` positions and
 * take the first that parses to a non-empty JSON array. Throws a descriptive
 * `SourceError` when no parseable array (or an empty one) is found. Exported
 * pure so the noise/garbage branches stay unit-testable offline.
 */
export function parseNpmPackJson(out: string): {
  filename: string;
  version: string;
} {
  for (let i = out.indexOf("["); i >= 0; i = out.indexOf("[", i + 1)) {
    let parsed: { filename: string; version: string }[];
    try {
      parsed = JSON.parse(out.slice(i));
    } catch {
      continue;
    }
    if (parsed.length === 0)
      throw new SourceError(
        `npm pack returned no package metadata: ${out.trim()}`,
      );
    return parsed[0];
  }
  throw new SourceError(
    `could not parse npm pack --json output: ${out.trim()}`,
  );
}

/** Default fetcher: `npm pack <spec>` then extract the tarball with `tar`. */
export const defaultNpmFetcher: NpmFetcher = (spec, destDir) => {
  mkdirSync(destDir, { recursive: true });
  const out = execFileSync("npm", npmPackArgs(spec, destDir), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const meta = parseNpmPackJson(out);
  execFileSync("tar", ["-xzf", join(destDir, meta.filename), "-C", destDir], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  // npm tarballs always extract under a top-level `package/` directory.
  return { dir: join(destDir, "package"), version: meta.version };
};

export interface ResolveOptions {
  /**
   * Root under which sources are cached: git sources under
   * `<cacheRoot>/git/<key>`, npm sources under `<cacheRoot>/npm/<key>`.
   */
  cacheRoot: string;
  git?: GitRunner;
  npm?: NpmFetcher;
}

export interface ResolvedSource {
  /** Absolute path to the resolved content root. */
  dir: string;
  /** Durable pin: the resolved commit sha (git sources) or published version (npm sources). */
  sha?: string;
  /** The git ref that was requested, echoed back for the registry record. */
  ref?: string;
}

function cacheKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Fetch a source to a local directory and return its resolved content root +
 * durable pin. Synchronous: the only side effect is the per-source
 * package-manager subprocess (`git` for git sources; `npm pack` + `tar` for npm
 * sources) plus the filesystem reads/writes under `cacheRoot`.
 */
export function resolveSource(
  source: Source,
  opts: ResolveOptions,
): ResolvedSource {
  normalizeSource(source);

  if (source.type === "path") {
    const dir = resolvePath(source.path);
    if (!existsSync(dir))
      throw new SourceError(`path source not found: ${dir}`);
    return { dir };
  }

  if (source.type === "npm") {
    return resolveNpm(source, opts);
  }

  if (source.type === "url") {
    throw new UnsupportedSourceError(
      `source type "${source.type}" is not yet supported`,
    );
  }

  const subdir = source.type === "git-subdir" ? source.path : undefined;
  const url = toGitUrl(source.type === "github" ? source.repo : source.url);
  const git = opts.git ?? defaultGitRunner;
  const cacheDir = join(opts.cacheRoot, "git", cacheKey(url));

  if (!existsSync(cacheDir)) {
    mkdirSync(dirname(cacheDir), { recursive: true });
    git(["clone", "--filter=blob:none", "--no-checkout", url, cacheDir]);
    if (subdir) {
      git(["sparse-checkout", "init", "--cone"], { cwd: cacheDir });
      git(["sparse-checkout", "set", subdir], { cwd: cacheDir });
    }
  } else {
    git(["fetch", "--filter=blob:none", "--tags", "origin"], { cwd: cacheDir });
  }

  const wanted = source.sha ?? source.ref ?? "HEAD";
  git(["checkout", "--detach", wanted], { cwd: cacheDir });
  const sha = git(["rev-parse", "HEAD"], { cwd: cacheDir }).stdout.trim();
  const dir = subdir ? join(cacheDir, subdir) : cacheDir;
  return { dir, sha, ref: source.ref };
}

/** True for a concrete, immutable version pin (e.g. `1.2.3`, `1.2.3-rc.1`). */
function isExactVersion(version: string | undefined): version is string {
  return !!version && /^\d+\.\d+\.\d+([-+].*)?$/.test(version);
}

/**
 * Resolve an npm source by downloading+extracting its tarball into the cache.
 * The exact published version acts as the durable `sha` pin (mirroring git).
 * Exact-version pins are cached; unpinned/range specs re-fetch to honor "latest".
 */
function resolveNpm(
  source: Extract<Source, { type: "npm" }>,
  opts: ResolveOptions,
): ResolvedSource {
  const fetch = opts.npm ?? defaultNpmFetcher;
  const cacheDir = join(
    opts.cacheRoot,
    "npm",
    cacheKey(`${source.package}@${source.version ?? "latest"}`),
  );
  const verFile = join(cacheDir, ".resolved-version");
  const contentDir = join(cacheDir, "package");

  if (
    isExactVersion(source.version) &&
    existsSync(join(contentDir, "package.json")) &&
    existsSync(verFile)
  ) {
    return {
      dir: contentDir,
      sha: readFileSync(verFile, "utf8").trim(),
      ref: source.version,
    };
  }

  // Cache miss (unpinned/range re-fetch, or a not-yet-cached pin): clear any
  // prior tarball + extraction so the cache dir doesn't accumulate stale
  // artifacts across "latest" re-fetches.
  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });
  const { dir, version } = fetch(
    {
      package: source.package,
      version: source.version,
      registry: source.registry,
    },
    cacheDir,
  );
  writeFileSync(verFile, version + "\n");
  return { dir, sha: version, ref: source.version };
}
