import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** Default fetcher: `npm pack <spec>` then extract the tarball with `tar`. */
export const defaultNpmFetcher: NpmFetcher = (spec, destDir) => {
  mkdirSync(destDir, { recursive: true });
  const out = execFileSync("npm", npmPackArgs(spec, destDir), {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Packing a local dir runs its `prepack`, whose stdout precedes the JSON;
  // slice from the array start so lifecycle noise doesn't break the parse.
  const meta = JSON.parse(out.slice(out.indexOf("[")))[0] as {
    filename: string;
    version: string;
  };
  execFileSync("tar", ["-xzf", join(destDir, meta.filename), "-C", destDir], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  // npm tarballs always extract under a top-level `package/` directory.
  return { dir: join(destDir, "package"), version: meta.version };
};

export interface ResolveOptions {
  /** Root under which sources are cached (`<cacheRoot>/git/<key>`). */
  cacheRoot: string;
  git?: GitRunner;
  npm?: NpmFetcher;
}

export interface ResolvedSource {
  /** Absolute path to the resolved content root. */
  dir: string;
  /** Resolved commit sha (git sources). */
  sha?: string;
  /** The git ref that was requested, echoed back for the registry record. */
  ref?: string;
}

function cacheKey(url: string): string {
  return url.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Fetch a source to a local directory and return its resolved content root +
 * durable sha pin. Synchronous: git is the only side effect.
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
