import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
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

export interface ResolveOptions {
  /** Root under which sources are cached (`<cacheRoot>/git/<key>`). */
  cacheRoot: string;
  git?: GitRunner;
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

  if (source.type === "url" || source.type === "npm") {
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
