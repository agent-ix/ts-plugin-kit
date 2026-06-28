/**
 * Typed plugin/marketplace source descriptors.
 *
 * Mirrors the shape of Claude Code marketplace `source` entries, but is its own
 * framework-agnostic contract. `url` and `npm` resolution is intentionally
 * deferred (see {@link UnsupportedSourceError}) until a consumer needs it — the
 * default flow is git-only. The `npm` variant still exists in the type so hosts
 * can build install specs (e.g. an oclif `plugins:install` bridge) without the
 * library having to resolve it.
 */
export type Source =
  | { type: "github"; repo: string; ref?: string; sha?: string }
  | {
      type: "git-subdir";
      url: string;
      path: string;
      ref?: string;
      sha?: string;
    }
  | { type: "git"; url: string; ref?: string; sha?: string }
  | { type: "url"; url: string; ref?: string; sha?: string }
  | { type: "path"; path: string }
  | { type: "npm"; package: string; version?: string; registry?: string };

export type SourceType = Source["type"];

/** Thrown when a source descriptor is structurally invalid. */
export class SourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceError";
  }
}

/** Thrown when a source type is valid but its resolution is not implemented yet. */
export class UnsupportedSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedSourceError";
  }
}

function req(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new SourceError(`source field "${field}" must be a non-empty string`);
  }
  return value;
}

/**
 * Like {@link req}, but also rejects an option-like value (leading `-`). Source
 * fields that flow into a `git`/`npm` argv must not be interpretable as a CLI
 * flag — e.g. a package named `-x` would become an `npm pack` option, or a `ref`
 * of `--upload-pack=<cmd>` / a `repo` of `--output=…` would become a `git`
 * option (a second-order command-line injection), so it is rejected up front,
 * before any subprocess invocation.
 *
 * The check is on the **trimmed** value: `toGitUrl` does `raw.trim()` before the
 * value reaches `git clone`/`git fetch`, so a leading-whitespace-then-dash
 * payload (e.g. `" --upload-pack=…"`) would otherwise pass the raw guard yet
 * trim to an option at the argv. Guarding the trimmed value makes the value that
 * is validated the value that actually reaches the argv.
 */
function reqArg(value: unknown, field: string): string {
  const v = req(value, field);
  if (v.trim().startsWith("-")) {
    throw new SourceError(`source field "${field}" must not begin with "-"`);
  }
  return v;
}

/**
 * Like {@link reqArg}, but for an optional field (`ref`/`sha`): `undefined`
 * passes through, but any present value must be a non-empty, non-option-like
 * string. `git checkout` does not accept a `--` separator cleanly before a ref,
 * so an option-like ref/sha is rejected rather than escaped.
 */
function optArg(value: unknown, field: string): void {
  if (value === undefined) return;
  reqArg(value, field);
}

/** Validate a source descriptor, throwing {@link SourceError} on malformed input. */
export function normalizeSource(source: Source): Source {
  if (!source || typeof (source as { type?: unknown }).type !== "string") {
    throw new SourceError("source must have a string `type`");
  }
  switch (source.type) {
    case "github":
      reqArg(source.repo, "repo");
      optArg(source.ref, "ref");
      optArg(source.sha, "sha");
      return source;
    case "git":
      reqArg(source.url, "url");
      optArg(source.ref, "ref");
      optArg(source.sha, "sha");
      return source;
    case "git-subdir":
      reqArg(source.url, "url");
      reqArg(source.path, "path");
      optArg(source.ref, "ref");
      optArg(source.sha, "sha");
      return source;
    case "url":
      reqArg(source.url, "url");
      optArg(source.ref, "ref");
      optArg(source.sha, "sha");
      return source;
    case "path":
      req(source.path, "path");
      return source;
    case "npm":
      reqArg(source.package, "package");
      return source;
    default:
      throw new SourceError(
        `unknown source type "${(source as { type: string }).type}"`,
      );
  }
}

/**
 * Expand a git reference to a clonable URL. Full URLs (`https://`, `git@`) pass
 * through; an `owner/repo` shorthand expands to GitHub.
 */
export function toGitUrl(raw: string): string {
  const s = raw.trim();
  if (s.includes("://") || s.startsWith("git@")) return s;
  return `https://github.com/${s.replace(/\.git$/, "")}.git`;
}
