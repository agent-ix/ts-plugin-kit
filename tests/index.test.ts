import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ManifestError,
  SourceError,
  UnsupportedSourceError,
  installEntry,
  normalizeSource,
  readRegistry,
  reconcile,
  resolveSource,
  toGitUrl,
  upsertPlugin,
  validateMarketplaceManifest,
  writeRegistry,
  type GitRunner,
  type InstallOptions,
  type InstalledPlugin,
  type Source,
} from "../src";

// ── Fixture: a local bare git repo with two tagged versions, no network ──────

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

interface Fixture {
  url: string;
  work: string;
  shaV2: string;
  shaV3: string;
}

const roots: string[] = [];
function freshRoot(): string {
  const r = mkdtempSync(join(tmpdir(), "tpk-"));
  roots.push(r);
  return r;
}

let fx: Fixture;

beforeAll(() => {
  const root = freshRoot();
  const work = join(root, "work");
  const pkg = join(work, "spec_objects_business");
  mkdirSync(join(work, "spec_objects_other"), { recursive: true });
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(work, "README.md"), "# root\n");
  writeFileSync(
    join(pkg, "manifest.yaml"),
    "name: spec-objects-business\nversion: 0.2.0\n",
  );
  git(["init", "-q", "-b", "main"], work);
  git(["config", "user.email", "t@example.com"], work);
  git(["config", "user.name", "Test"], work);
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "v2"], work);
  git(["tag", "v0.2.0"], work);
  const shaV2 = git(["rev-parse", "HEAD"], work).trim();
  writeFileSync(
    join(pkg, "manifest.yaml"),
    "name: spec-objects-business\nversion: 0.3.0\n",
  );
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "v3"], work);
  git(["tag", "v0.3.0"], work);
  const shaV3 = git(["rev-parse", "HEAD"], work).trim();
  const bare = join(root, "repo.git");
  git(["clone", "-q", "--bare", work, bare]);
  git(["-C", bare, "config", "uploadpack.allowFilter", "true"]);
  fx = { url: `file://${bare}`, work, shaV2, shaV3 };
});

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function readName(dir: string): string {
  const text = readFileSync(join(dir, "manifest.yaml"), "utf8");
  const m = text.match(/^name:\s*(.+)$/m);
  return m ? m[1].trim() : "unknown";
}

function opts(extra: Partial<InstallOptions> = {}): InstallOptions {
  const root = freshRoot();
  return {
    cacheRoot: join(root, "cache"),
    targetRoot: join(root, "target"),
    registryPath: join(root, "filament", "registry.json"),
    readName,
    ...extra,
  };
}

const subdir = (ref?: string, sha?: string): Source => ({
  type: "git-subdir",
  url: fx.url,
  path: "spec_objects_business",
  ref,
  sha,
});

// ── sources ──────────────────────────────────────────────────────────────────

describe("normalizeSource", () => {
  test("accepts every valid shape", () => {
    expect(normalizeSource({ type: "github", repo: "a/b" }).type).toBe(
      "github",
    );
    expect(normalizeSource({ type: "git", url: "u" }).type).toBe("git");
    expect(
      normalizeSource({ type: "git-subdir", url: "u", path: "p" }).type,
    ).toBe("git-subdir");
    expect(normalizeSource({ type: "url", url: "u" }).type).toBe("url");
    expect(normalizeSource({ type: "path", path: "p" }).type).toBe("path");
    expect(normalizeSource({ type: "npm", package: "x" }).type).toBe("npm");
  });

  test("rejects malformed input", () => {
    expect(() => normalizeSource(null as unknown as Source)).toThrow(
      SourceError,
    );
    expect(() => normalizeSource({} as unknown as Source)).toThrow(
      /string `type`/,
    );
    expect(() => normalizeSource({ type: "github" } as Source)).toThrow(/repo/);
    expect(() => normalizeSource({ type: "git" } as Source)).toThrow(/url/);
    expect(() =>
      normalizeSource({ type: "git-subdir", url: "u" } as Source),
    ).toThrow(/path/);
    expect(() => normalizeSource({ type: "url" } as Source)).toThrow(/url/);
    expect(() => normalizeSource({ type: "path" } as Source)).toThrow(/path/);
    expect(() => normalizeSource({ type: "npm" } as Source)).toThrow(/package/);
    expect(() =>
      normalizeSource({ type: "bogus" } as unknown as Source),
    ).toThrow(/unknown source type/);
  });

  // FR-004-CON-3..6: source fields that flow into the `git` argv must not be
  // interpretable as a CLI flag (leading `-`), or git treats them as an option
  // (e.g. `ref` of `--upload-pack=<cmd>`) — a second-order command-line
  // injection. `normalizeSource` rejects them before any git invocation.
  test("rejects option-like git argv fields (injection guard)", () => {
    // repo / url reach `git clone` / `git fetch`
    expect(() =>
      normalizeSource({ type: "github", repo: "-x" } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() => normalizeSource({ type: "git", url: "-x" } as Source)).toThrow(
      /must not begin with "-"/,
    );
    expect(() =>
      normalizeSource({ type: "git-subdir", url: "-x", path: "p" } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() => normalizeSource({ type: "url", url: "-x" } as Source)).toThrow(
      /must not begin with "-"/,
    );
    // ref / sha reach `git checkout --detach <wanted>`
    expect(() =>
      normalizeSource({
        type: "github",
        repo: "a/b",
        ref: "--upload-pack=touch /tmp/pwned",
      } as Source),
    ).toThrow(SourceError);
    expect(() =>
      normalizeSource({ type: "git", url: "u", sha: "-x" } as Source),
    ).toThrow(SourceError);
    expect(() =>
      normalizeSource({
        type: "git-subdir",
        url: "u",
        path: "p",
        ref: "-r",
      } as Source),
    ).toThrow(SourceError);
    expect(() =>
      normalizeSource({ type: "url", url: "u", sha: "-s" } as Source),
    ).toThrow(SourceError);
  });

  // TC-023 (F1): the argv guard must validate the value that actually reaches the
  // `git` argv. `toGitUrl` trims its input (and passes a `://` value through
  // unwrapped), so a leading-whitespace-then-dash payload (e.g.
  // `" --upload-pack=touch /tmp/pwned ext://x"`) would slip past a raw
  // `startsWith("-")` check yet trim to an *option* at the argv — a second-order
  // command-line injection. The guard must reject the TRIMMED value.
  test("rejects leading-whitespace option-like repo/url (trim bypass)", () => {
    const payload = " --upload-pack=touch /tmp/pwned ext://x";
    expect(() =>
      normalizeSource({ type: "github", repo: payload } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() =>
      normalizeSource({ type: "git", url: payload } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() =>
      normalizeSource({
        type: "git-subdir",
        url: payload,
        path: "p",
      } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() =>
      normalizeSource({ type: "url", url: payload } as Source),
    ).toThrow(/must not begin with "-"/);
  });

  // TC-024 (F2): `git-subdir.path` flows into `git sparse-checkout set <path>`
  // and was only checked for non-emptiness (`req`), so an option-like value
  // (`--stdin`, `-X`) reached the argv as a flag. Guard it like the other argv
  // fields.
  test("rejects option-like git-subdir path", () => {
    expect(() =>
      normalizeSource({
        type: "git-subdir",
        url: "u",
        path: "--stdin",
      } as Source),
    ).toThrow(/must not begin with "-"/);
    expect(() =>
      normalizeSource({
        type: "git-subdir",
        url: "u",
        path: "-X",
      } as Source),
    ).toThrow(/must not begin with "-"/);
  });
});

test("toGitUrl expands shorthand and passes through URLs", () => {
  expect(toGitUrl("agent-ix/spec-objects-business")).toBe(
    "https://github.com/agent-ix/spec-objects-business.git",
  );
  expect(toGitUrl("owner/repo.git")).toBe("https://github.com/owner/repo.git");
  expect(toGitUrl("https://example.com/x.git")).toBe(
    "https://example.com/x.git",
  );
  expect(toGitUrl("git@github.com:owner/repo.git")).toBe(
    "git@github.com:owner/repo.git",
  );
  // FR-002-AC-5: surrounding whitespace is trimmed before classification.
  expect(toGitUrl("  owner/repo  ")).toBe("https://github.com/owner/repo.git");
});

// ── manifest ─────────────────────────────────────────────────────────────────

describe("validateMarketplaceManifest", () => {
  test("accepts a valid manifest (with and without a name)", () => {
    const m = validateMarketplaceManifest({
      schemaVersion: 1,
      name: "set",
      entries: [{ name: "a", source: { type: "git", url: "u" } }],
    });
    expect(m.name).toBe("set");
    expect(m.entries).toHaveLength(1);
    expect(
      validateMarketplaceManifest({ schemaVersion: 1, entries: [] }).name,
    ).toBeUndefined();
  });

  test("rejects malformed manifests and entries", () => {
    expect(() => validateMarketplaceManifest(null)).toThrow(ManifestError);
    expect(() => validateMarketplaceManifest("x")).toThrow(/must be an object/);
    expect(() =>
      validateMarketplaceManifest({ schemaVersion: 2, entries: [] }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validateMarketplaceManifest({ schemaVersion: 1, entries: "no" }),
    ).toThrow(/array/);
    expect(() =>
      validateMarketplaceManifest({ schemaVersion: 1, entries: [null] }),
    ).toThrow(/entry 0 must be/);
    expect(() =>
      validateMarketplaceManifest({
        schemaVersion: 1,
        entries: [{ source: { type: "git", url: "u" } }],
      }),
    ).toThrow(/non-empty name/);
    expect(() =>
      validateMarketplaceManifest({
        schemaVersion: 1,
        entries: [{ name: "a", source: { type: "bad" } }],
      }),
    ).toThrow(SourceError);
  });
});

// ── registry ─────────────────────────────────────────────────────────────────

describe("registry", () => {
  test("missing and malformed files read as empty", () => {
    const p = join(freshRoot(), "r.json");
    expect(readRegistry(p).plugins).toEqual([]);
    writeFileSync(p, "{}");
    expect(readRegistry(p).plugins).toEqual([]);
  });

  test("write is atomic and round-trips; upsert replaces by name", () => {
    const p = join(freshRoot(), "nested", "r.json");
    const rec: InstalledPlugin = {
      name: "a",
      source: { type: "git", url: "u" },
      resolvedPath: "/c",
      targetPath: "/t",
      installedAt: "now",
    };
    writeRegistry(p, { schemaVersion: 1, plugins: [rec] });
    expect(readRegistry(p).plugins).toHaveLength(1);
    const reg2 = upsertPlugin(readRegistry(p), { ...rec, sha: "x" });
    expect(reg2.plugins).toHaveLength(1);
    expect(reg2.plugins[0].sha).toBe("x");
  });
});

// ── resolve ──────────────────────────────────────────────────────────────────

describe("resolveSource", () => {
  test("path source returns the dir; missing path throws", () => {
    const r = resolveSource(
      { type: "path", path: join(fx.work, "spec_objects_business") },
      opts(),
    );
    expect(existsSync(join(r.dir, "manifest.yaml"))).toBe(true);
    expect(() =>
      resolveSource({ type: "path", path: "/no/such/dir" }, opts()),
    ).toThrow(SourceError);
  });

  test("url and npm sources are not yet supported", () => {
    expect(() => resolveSource({ type: "url", url: "u" }, opts())).toThrow(
      UnsupportedSourceError,
    );
    expect(() => resolveSource({ type: "npm", package: "p" }, opts())).toThrow(
      UnsupportedSourceError,
    );
  });

  test("git-subdir sparse-checks out only the subdir at a tag", () => {
    const r = resolveSource(subdir("v0.2.0"), opts());
    expect(r.dir.endsWith("spec_objects_business")).toBe(true);
    expect(existsSync(join(r.dir, "manifest.yaml"))).toBe(true);
    expect(r.sha).toBe(fx.shaV2);
    expect(r.ref).toBe("v0.2.0");
  });

  test("whole-repo git resolves to HEAD when unpinned, and re-fetches an existing cache", () => {
    const o = opts();
    const head = resolveSource({ type: "git", url: fx.url }, o);
    expect(head.sha).toBe(fx.shaV3); // HEAD is the latest commit
    // second resolve on the same cached url exercises the fetch branch
    const again = resolveSource({ type: "git", url: fx.url, ref: "v0.2.0" }, o);
    expect(again.sha).toBe(fx.shaV2);
  });

  test("sha pin checks out the exact commit", () => {
    expect(
      resolveSource({ type: "git", url: fx.url, sha: fx.shaV2 }, opts()).sha,
    ).toBe(fx.shaV2);
  });

  test("github source + injected runner needs no real git", () => {
    const calls: string[][] = [];
    const fake: GitRunner = (args) => {
      calls.push(args);
      return { stdout: "fakesha\n" };
    };
    const r = resolveSource(
      { type: "github", repo: "agent-ix/x", ref: "v1" },
      { cacheRoot: join(freshRoot(), "c"), git: fake },
    );
    expect(r.sha).toBe("fakesha");
    expect(calls[0][0]).toBe("clone");
  });
});

// ── install ──────────────────────────────────────────────────────────────────

describe("installEntry", () => {
  test("materializes a named git-subdir entry and records it", () => {
    const o = opts();
    const rec = installEntry(
      { name: "spec-objects-business", source: subdir("v0.2.0") },
      o,
    );
    expect(rec.sha).toBe(fx.shaV2);
    expect(existsSync(join(rec.targetPath, "manifest.yaml"))).toBe(true);
    expect(readRegistry(o.registryPath).plugins[0].name).toBe(
      "spec-objects-business",
    );
  });

  test("derives the name via readName when the entry has none", () => {
    const rec = installEntry({ source: subdir("v0.2.0") }, opts());
    expect(rec.name).toBe("spec-objects-business");
  });

  test("honors entry.path against a whole-repo source", () => {
    const rec = installEntry(
      {
        name: "m",
        source: { type: "git", url: fx.url, ref: "v0.2.0" },
        path: "spec_objects_business",
      },
      opts(),
    );
    expect(existsSync(join(rec.targetPath, "manifest.yaml"))).toBe(true);
  });

  test("symlink mode links instead of copying, and re-install replaces", () => {
    const o = opts({ materialize: "symlink" });
    const rec = installEntry({ name: "m", source: subdir("v0.2.0") }, o);
    expect(lstatSync(rec.targetPath).isSymbolicLink()).toBe(true);
    const again = installEntry({ name: "m", source: subdir("v0.3.0") }, o);
    expect(lstatSync(again.targetPath).isSymbolicLink()).toBe(true);
  });
});

// ── reconcile ────────────────────────────────────────────────────────────────

describe("reconcile", () => {
  const manifest = (
    entries: { name: string; source: Source; defaultEnabled?: boolean }[],
  ) => ({
    schemaVersion: 1 as const,
    entries,
  });

  test("lazy installs the enabled set, skips disabled, and is idempotent with zero git on the 2nd run", () => {
    let gitCalls = 0;
    const spy: GitRunner = (args, o2) => {
      gitCalls += 1;
      return {
        stdout: execFileSync("git", args, {
          cwd: o2?.cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      };
    };
    const o = opts({ git: spy });
    const m = manifest([
      { name: "spec-objects-business", source: subdir("v0.2.0") },
      { name: "off", source: subdir("v0.2.0"), defaultEnabled: false },
    ]);
    const first = reconcile(m, o);
    expect(first.installed).toHaveLength(1);
    expect(first.skipped).toHaveLength(1);
    expect(gitCalls).toBeGreaterThan(0);

    gitCalls = 0;
    const second = reconcile(m, o);
    expect(second.unchanged).toHaveLength(1);
    expect(gitCalls).toBe(0);
  });

  test("sync re-resolves: unchanged on a stable ref, updated on a moved pin", () => {
    const o = opts();
    const stable = manifest([
      { name: "spec-objects-business", source: subdir("v0.2.0") },
    ]);
    reconcile(stable, o);
    expect(reconcile(stable, { ...o, mode: "sync" }).unchanged).toHaveLength(1);

    const moved = manifest([
      { name: "spec-objects-business", source: subdir("v0.3.0") },
    ]);
    expect(reconcile(moved, { ...o, mode: "sync" }).updated).toHaveLength(1);
  });

  test("lazy re-materializes when the target dir is gone", () => {
    const o = opts();
    const m = manifest([
      { name: "spec-objects-business", source: subdir("v0.2.0") },
    ]);
    const rec = reconcile(m, o).installed[0];
    rmSync(rec.targetPath, { recursive: true, force: true });
    expect(reconcile(m, o).updated).toHaveLength(1);
  });

  test("lazy honors a sha pin: unchanged when it matches, updated when it differs", () => {
    const o = opts();
    const atV2 = manifest([
      {
        name: "spec-objects-business",
        source: { type: "git", url: fx.url, sha: fx.shaV2 },
      },
    ]);
    reconcile(atV2, o);
    expect(reconcile(atV2, o).unchanged).toHaveLength(1);
    const atV3 = manifest([
      {
        name: "spec-objects-business",
        source: { type: "git", url: fx.url, sha: fx.shaV3 },
      },
    ]);
    expect(reconcile(atV3, o).updated).toHaveLength(1);
  });
});
