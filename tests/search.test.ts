import {
  createPluginSearch,
  createTtlCache,
  defaultHttpFetcher,
  searchPlugins,
  sourceToInstallInput,
  systemClock,
  type CandidateVerifier,
  type HttpFetcher,
  type HttpResponse,
} from "../src";

// ── Offline fakes: an HttpResponse builder + per-test routed fetchers ─────────

function res(
  body: unknown,
  opts: { status?: number; headers?: Record<string, string> } = {},
): HttpResponse {
  const status = opts.status ?? 200;
  const headers = opts.headers ?? {};
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const npmPkg = (over: Record<string, unknown> = {}) => ({
  name: "a-mod",
  version: "1.0.0",
  description: "d",
  date: "2024-01-01",
  links: { repository: "https://github.com/o/a-mod" },
  author: { name: "auth" },
  ...over,
});
const npmBody = (...pkgs: unknown[]) => ({
  objects: pkgs.map((p) => ({ package: p })),
});
const ghItem = (over: Record<string, unknown> = {}) => ({
  full_name: "o/r",
  name: "r",
  description: "gd",
  stargazers_count: 5,
  owner: { login: "o" },
  html_url: "https://github.com/o/r",
  pushed_at: "2024-02-01",
  ...over,
});
const ghBody = (...items: unknown[]) => ({ items });

const RL = (limit: string, remaining: string, reset: string) => ({
  "x-ratelimit-limit": limit,
  "x-ratelimit-remaining": remaining,
  "x-ratelimit-reset": reset,
});

const okVerifier = (caps: unknown = { x: 1 }): CandidateVerifier => ({
  manifestPath: "manifest.yaml",
  verify: () => ({ capabilities: caps }),
});

// ── FR-008: candidate search ─────────────────────────────────────────────────

describe("searchPlugins — candidate search (FR-008)", () => {
  it("merges npm + github candidates into one ranked list (TC-022)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/-/v1/search")
        ? res(npmBody(npmPkg({ links: {} })))
        : res(ghBody(ghItem()));
    const r = await searchPlugins({ tag: "filament-module", http });
    expect(r.results.map((x) => x.origin).sort()).toEqual(["github", "npm"]);
    expect(r.results.find((x) => x.origin === "npm")!.source).toEqual({
      type: "npm",
      package: "a-mod",
    });
    expect(r.results.find((x) => x.origin === "github")!.source).toEqual({
      type: "github",
      repo: "o/r",
    });
    expect(r.errors).toEqual([]);
  });

  it("composes encoded npm size + github per_page queries (TC-023)", async () => {
    const urls: string[] = [];
    const http: HttpFetcher = async (url) => {
      urls.push(url);
      return url.includes("/-/v1/search") ? res(npmBody()) : res(ghBody());
    };
    await searchPlugins({ tag: "fil mod", query: "a/b", limit: 7, http });
    const npmUrl = urls.find((u) => u.includes("/-/v1/search"))!;
    const ghUrl = urls.find((u) => u.includes("/search/repositories"))!;
    expect(npmUrl).toContain(encodeURIComponent("keywords:fil mod a/b"));
    expect(npmUrl).toContain("size=7");
    expect(ghUrl).toContain(encodeURIComponent("topic:fil mod a/b"));
    expect(ghUrl).toContain("per_page=7");
  });

  it("one backend failing still returns the other plus an error (TC-024)", async () => {
    const http: HttpFetcher = async (url) => {
      if (url.includes("/-/v1/search"))
        return res(npmBody(npmPkg({ links: {} })));
      throw new Error("gh down");
    };
    const r = await searchPlugins({ tag: "t", http });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].origin).toBe("npm");
    expect(r.errors).toEqual([{ backend: "github", message: "gh down" }]);
  });

  it("adds Authorization only with a token and honors the sources filter (TC-025)", async () => {
    let ghHeaders: Record<string, string> | undefined;
    let npmCalled = false;
    const http: HttpFetcher = async (url, init) => {
      if (url.includes("/search/repositories")) {
        ghHeaders = init?.headers;
        return res(ghBody());
      }
      npmCalled = true;
      return res(npmBody());
    };
    await searchPlugins({
      tag: "t",
      http,
      githubToken: "secret",
      sources: ["github"],
    });
    expect(ghHeaders?.Authorization).toBe("Bearer secret");
    expect(npmCalled).toBe(false);
    ghHeaders = undefined;
    await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(ghHeaders?.Authorization).toBeUndefined();
  });

  it("dedupes an npm package against its github repo, preferring npm (TC-026)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/-/v1/search")
        ? res(
            npmBody(
              npmPkg({
                name: "a-mod",
                date: undefined,
                links: { repository: "git+https://github.com/o/a-mod.git" },
              }),
            ),
          )
        : res(
            ghBody(
              ghItem({
                full_name: "o/a-mod",
                stargazers_count: 42,
                pushed_at: "2024-05-05",
              }),
            ),
          );
    const r = await searchPlugins({ tag: "t", http });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].origin).toBe("npm");
    expect(r.results[0].stars).toBe(42);
    expect(r.results[0].updatedAt).toBe("2024-05-05");
  });

  it("dedupes regardless of backend order, preferring npm (github-first)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(
            ghBody(
              ghItem({
                full_name: "o/m",
                stargazers_count: 9,
                pushed_at: "2024-07-07",
              }),
            ),
          )
        : res(
            npmBody(
              npmPkg({
                name: "m",
                date: undefined,
                links: { repository: "https://github.com/o/m" },
              }),
            ),
          );
    const r = await searchPlugins({
      tag: "t",
      http,
      sources: ["github", "npm"],
    });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].origin).toBe("npm");
    expect(r.results[0].stars).toBe(9);
  });

  it("collapses duplicate github entries with the same full_name", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(
            ghBody(
              ghItem({ full_name: "o/d", stargazers_count: 1 }),
              ghItem({ full_name: "o/d", stargazers_count: 2 }),
            ),
          )
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.results).toHaveLength(1);
  });

  it("returns empty results with one error per failed backend (TC-043)", async () => {
    const http: HttpFetcher = async () => {
      throw new Error("net");
    };
    const r = await searchPlugins({ tag: "t", http });
    expect(r.results).toEqual([]);
    expect(r.errors.map((e) => e.backend).sort()).toEqual(["github", "npm"]);
  });

  it("tolerates missing optional fields and skips invalid items (TC-044)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/-/v1/search")
        ? res({
            objects: [
              { package: null },
              { package: { name: "min", links: {} } },
            ],
          })
        : res(ghBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["npm"] });
    expect(r.results).toHaveLength(1);
    const only = r.results[0];
    expect(only.name).toBe("min");
    expect(only.description).toBeUndefined();
    expect(only.version).toBeUndefined();
    expect(only.author).toBeUndefined();
    expect(only.updatedAt).toBeUndefined();
    expect(only.url).toBeUndefined();
  });

  it("reports an npm malformed body and a github malformed body", async () => {
    const npmBad = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: async () => res({ nope: 1 }),
    });
    expect(npmBad.errors[0]).toMatchObject({ backend: "npm" });
    expect(npmBad.errors[0].message).toMatch(/malformed/);
    const ghBad = await searchPlugins({
      tag: "t",
      sources: ["github"],
      http: async () => res({ nope: 1 }),
    });
    expect(ghBad.errors[0]).toMatchObject({ backend: "github" });
    expect(ghBad.errors[0].message).toMatch(/malformed/);
  });

  it("skips invalid github items", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(ghBody(null, { name: "x" }, ghItem({ full_name: "o/r" })))
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.results.map((x) => x.fullName)).toEqual(["o/r"]);
  });

  it("reports non-rate npm/github failures on other non-OK statuses", async () => {
    const npm = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: async () => res({}, { status: 500 }),
    });
    expect(npm.errors[0]).toMatchObject({ backend: "npm", status: 500 });
    const gh = await searchPlugins({
      tag: "t",
      sources: ["github"],
      http: async () => res({}, { status: 500 }),
    });
    expect(gh.errors[0]).toMatchObject({ backend: "github", status: 500 });
    expect(gh.errors[0].rateLimited).toBeUndefined();
  });

  it("clamps limit to each backend maximum (TC-045)", async () => {
    const urls: string[] = [];
    const http: HttpFetcher = async (url) => {
      urls.push(url);
      return url.includes("/-/v1/search") ? res(npmBody()) : res(ghBody());
    };
    await searchPlugins({ tag: "t", http, limit: 9999 });
    expect(urls.find((u) => u.includes("/-/v1/search"))).toContain("size=250");
    expect(urls.find((u) => u.includes("/search/repositories"))).toContain(
      "per_page=100",
    );
  });

  it("ranks deterministically with a fullName tie-break (TC-046)", async () => {
    const items = [
      ghItem({
        full_name: "o/b",
        stargazers_count: undefined,
        pushed_at: undefined,
      }),
      ghItem({
        full_name: "o/a",
        stargazers_count: undefined,
        pushed_at: undefined,
      }),
      ghItem({ full_name: "o/c", stargazers_count: 10 }),
      ghItem({
        full_name: "o/d",
        stargazers_count: 10,
        pushed_at: "2024-09-09",
      }),
    ];
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(ghBody(...items))
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.results.map((x) => x.fullName)).toEqual([
      "o/d",
      "o/c",
      "o/a",
      "o/b",
    ]);
  });

  it("keeps repo-less results and treats fully-equal results as equal rank", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/-/v1/search")
        ? res(
            npmBody(
              npmPkg({ name: "dup", date: undefined, links: {} }),
              npmPkg({ name: "dup", date: undefined, links: {} }),
            ),
          )
        : res(ghBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["npm"] });
    expect(r.results).toHaveLength(2);
    expect(r.results.every((x) => x.fullName === "dup")).toBe(true);
  });

  it("falls back through npm link fields for the result url", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/-/v1/search")
        ? res(
            npmBody(
              npmPkg({ name: "a", links: { homepage: "https://hp" } }),
              npmPkg({ name: "b", links: { npm: "https://npmlink" } }),
            ),
          )
        : res(ghBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["npm"] });
    expect(r.results.find((x) => x.name === "a")!.url).toBe("https://hp");
    expect(r.results.find((x) => x.name === "b")!.url).toBe("https://npmlink");
  });

  it("propagates signal and surfaces an abort as a backend error (TC-047)", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const ctrl = new AbortController();
    const http: HttpFetcher = async (url, init) => {
      seen.push(init?.signal);
      if (url.includes("/search/repositories")) throw new Error("aborted");
      return res(npmBody(npmPkg({ links: {} })));
    };
    const r = await searchPlugins({ tag: "t", http, signal: ctrl.signal });
    expect(seen.every((s) => s === ctrl.signal)).toBe(true);
    expect(r.results).toHaveLength(1);
    expect(r.errors[0].backend).toBe("github");
  });

  it("never leaks the github token into errors, keys, or results (TC-054)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res({}, { status: 403, headers: RL("60", "0", "999") })
        : res(npmBody(npmPkg({ links: {} })));
    const r = await searchPlugins({ tag: "t", http, githubToken: "SECRET" });
    expect(JSON.stringify(r)).not.toContain("SECRET");
  });

  it("stringifies a non-Error backend rejection", async () => {
    const r = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: async () => {
        throw "kaboom";
      },
    });
    expect(r.errors[0]).toEqual({ backend: "npm", message: "kaboom" });
  });

  it("falls back github fields and orders equal-star results by date", async () => {
    const items = [
      { full_name: "o/nofields", stargazers_count: 3 },
      ghItem({
        full_name: "o/a1",
        stargazers_count: undefined,
        pushed_at: "2024-01-01",
      }),
      ghItem({
        full_name: "o/a2",
        stargazers_count: undefined,
        pushed_at: "2024-02-02",
      }),
      ghItem({
        full_name: "o/a3",
        stargazers_count: undefined,
        pushed_at: "2024-03-03",
      }),
    ];
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(ghBody(...items))
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    const nofields = r.results.find((x) => x.fullName === "o/nofields")!;
    expect(nofields.name).toBe("o/nofields");
    expect(nofields.description).toBeUndefined();
    expect(nofields.url).toBeUndefined();
    expect(nofields.author).toBeUndefined();
    expect(r.results.map((x) => x.fullName)).toEqual([
      "o/nofields",
      "o/a3",
      "o/a2",
      "o/a1",
    ]);
  });

  it("honors custom npmRegistry and githubApi endpoints", async () => {
    const urls: string[] = [];
    const http: HttpFetcher = async (url) => {
      urls.push(url);
      return url.includes("/-/v1/search") ? res(npmBody()) : res(ghBody());
    };
    await searchPlugins({
      tag: "t",
      http,
      npmRegistry: "https://custom-npm",
      githubApi: "https://custom-gh",
    });
    expect(
      urls.some((u) => u.startsWith("https://custom-npm/-/v1/search")),
    ).toBe(true);
    expect(
      urls.some((u) => u.startsWith("https://custom-gh/search/repositories")),
    ).toBe(true);
  });
});

// ── FR-009: compatibility verification ───────────────────────────────────────

describe("searchPlugins — verification (FR-009)", () => {
  const npmOnly =
    (manifest: HttpResponse | (() => Promise<HttpResponse>)): HttpFetcher =>
    async (url) => {
      if (url.includes("unpkg.com"))
        return typeof manifest === "function" ? manifest() : manifest;
      if (url.includes("/-/v1/search"))
        return res(npmBody(npmPkg({ name: "n", links: {} })));
      return res(ghBody());
    };

  it("keeps a candidate whose verify returns capabilities (TC-027)", async () => {
    const r = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: npmOnly(res("name: x")),
      verifier: okVerifier({ ok: true }),
    });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].verified).toBe(true);
    expect(r.results[0].capabilities).toEqual({ ok: true });
  });

  it("drops a candidate whose verify returns null (TC-028)", async () => {
    const r = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: npmOnly(res("manifest")),
      verifier: { manifestPath: "manifest.yaml", verify: () => null },
    });
    expect(r.results).toEqual([]);
  });

  it("drops a 404 candidate as incompatible without calling verify (TC-029)", async () => {
    let verifyCalls = 0;
    const r = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: npmOnly(res("", { status: 404 })),
      verifier: {
        manifestPath: "manifest.yaml",
        verify: () => {
          verifyCalls++;
          return { capabilities: {} };
        },
      },
    });
    expect(r.results).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(verifyCalls).toBe(0);
  });

  it("fetches manifests from unpkg and raw.githubusercontent (TC-030)", async () => {
    const urls: string[] = [];
    const http: HttpFetcher = async (url) => {
      if (
        url.includes("unpkg.com") ||
        url.includes("raw.githubusercontent.com")
      ) {
        urls.push(url);
        return res("m");
      }
      if (url.includes("/-/v1/search"))
        return res(npmBody(npmPkg({ name: "n", links: {} })));
      return res(ghBody(ghItem({ full_name: "o/r" })));
    };
    await searchPlugins({ tag: "t", http, verifier: okVerifier() });
    expect(urls).toContain("https://unpkg.com/n/manifest.yaml");
    expect(urls).toContain(
      "https://raw.githubusercontent.com/o/r/HEAD/manifest.yaml",
    );
  });

  it("skips verification entirely when no verifier is given (TC-031)", async () => {
    let manifestFetched = false;
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg") || url.includes("raw.github")) {
        manifestFetched = true;
        return res("m");
      }
      return url.includes("/-/v1/search")
        ? res(npmBody(npmPkg({ links: {} })))
        : res(ghBody());
    };
    const r = await searchPlugins({ tag: "t", http, sources: ["npm"] });
    expect(r.results[0].verified).toBeUndefined();
    expect(manifestFetched).toBe(false);
  });

  it("drops on a transient fetch failure and records a transient error (TC-048)", async () => {
    const r = await searchPlugins({
      tag: "t",
      sources: ["npm"],
      http: npmOnly(res("", { status: 500 })),
      verifier: okVerifier(),
    });
    expect(r.results).toEqual([]);
    expect(r.errors[0]).toMatchObject({
      backend: "npm",
      transient: true,
      status: 500,
    });
  });

  it("drops when the manifest fetch rejects, as a transient error", async () => {
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg")) throw new Error("dns");
      return url.includes("/-/v1/search")
        ? res(npmBody(npmPkg({ name: "n", links: {} })))
        : res(ghBody());
    };
    const r = await searchPlugins({
      tag: "t",
      http,
      sources: ["npm"],
      verifier: okVerifier(),
    });
    expect(r.results).toEqual([]);
    expect(r.errors[0]).toMatchObject({ backend: "npm", transient: true });
  });

  it("isolates a throwing verify to its candidate (TC-049)", async () => {
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg.com/bad")) return res("THROW");
      if (url.includes("unpkg.com/good")) return res("OK");
      return url.includes("/-/v1/search")
        ? res(
            npmBody(
              npmPkg({ name: "bad", links: {} }),
              npmPkg({ name: "good", links: {} }),
            ),
          )
        : res(ghBody());
    };
    const verifier: CandidateVerifier = {
      manifestPath: "manifest.yaml",
      verify: (t) => {
        if (t === "THROW") throw new Error("boom");
        return { capabilities: {} };
      },
    };
    const r = await searchPlugins({
      tag: "t",
      http,
      sources: ["npm"],
      verifier,
    });
    expect(r.results.map((x) => x.name)).toEqual(["good"]);
  });

  it("rejects path-traversal / control-char candidate names before fetching a manifest (TC-057)", async () => {
    const fetched: string[] = [];
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg.com")) {
        fetched.push(url);
        return res("m");
      }
      return url.includes("/-/v1/search")
        ? res(
            npmBody(
              npmPkg({ name: "../evil", links: {} }),
              npmPkg({ name: `ev${String.fromCharCode(1)}il`, links: {} }),
              npmPkg({ name: "good", links: {} }),
            ),
          )
        : res(ghBody());
    };
    const r = await searchPlugins({
      tag: "t",
      http,
      sources: ["npm"],
      verifier: okVerifier(),
    });
    expect(r.results.map((x) => x.name)).toEqual(["good"]);
    expect(fetched).toEqual(["https://unpkg.com/good/manifest.yaml"]);
  });

  it("caps manifest-fetch concurrency at six (TC-050)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg")) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>((r) => setTimeout(r, 0));
        inFlight--;
        return res("m");
      }
      return url.includes("/-/v1/search")
        ? res(
            npmBody(
              ...Array.from({ length: 12 }, (_, i) =>
                npmPkg({ name: `p${i}`, links: {} }),
              ),
            ),
          )
        : res(ghBody());
    };
    await searchPlugins({
      tag: "t",
      http,
      sources: ["npm"],
      verifier: okVerifier(),
    });
    expect(maxInFlight).toBe(6);
  });
});

// ── FR-010: TTL cache + factory ──────────────────────────────────────────────

describe("createTtlCache (FR-010)", () => {
  it("returns before expiry and evicts after the clock advances (TC-032)", () => {
    let t = 1000;
    const c = createTtlCache<string>({ ttlMs: 100, clock: { now: () => t } });
    c.set("k", "v");
    expect(c.get("k")).toBe("v");
    t = 1100;
    expect(c.get("k")).toBeUndefined();
    expect(c.get("k")).toBeUndefined();
    expect(c.size()).toBe(0);
  });

  it("evicts the oldest entry past max (TC-033)", () => {
    const c = createTtlCache<number>({
      ttlMs: 1000,
      clock: { now: () => 0 },
      max: 2,
    });
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
    expect(c.size()).toBe(2);
  });

  it("supports delete, clear, and size without a max bound", () => {
    const c = createTtlCache<number>({ ttlMs: 1000, clock: { now: () => 0 } });
    c.set("a", 1);
    c.set("b", 2);
    expect(c.size()).toBe(2);
    c.delete("a");
    expect(c.get("a")).toBeUndefined();
    c.clear();
    expect(c.size()).toBe(0);
  });

  it("defaults to the system clock when none is injected", () => {
    const c = createTtlCache<number>({ ttlMs: 10_000 });
    c.set("a", 1);
    expect(c.get("a")).toBe(1);
  });

  it("systemClock.now returns a number", () => {
    expect(typeof systemClock.now()).toBe("number");
  });
});

describe("createPluginSearch (FR-010)", () => {
  const okHttp: HttpFetcher = async (url) =>
    url.includes("/-/v1/search")
      ? res(npmBody(npmPkg({ links: {} })))
      : res(ghBody());

  it("serves an identical search from cache with no fetch (TC-034)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url, init) => {
      calls++;
      return okHttp(url, init);
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    await ps.search({ tag: "t" });
    const before = calls;
    await ps.search({ tag: "t" });
    expect(calls).toBe(before);
  });

  it("invalidate forces a re-fetch (TC-035)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url, init) => {
      calls++;
      return okHttp(url, init);
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    await ps.search({ tag: "t" });
    const after1 = calls;
    ps.invalidate();
    await ps.search({ tag: "t" });
    expect(calls).toBeGreaterThan(after1);
  });

  it("resolves a late-bound github token per call (TC-036)", async () => {
    let token: string | undefined;
    const seen: (string | undefined)[] = [];
    const http: HttpFetcher = async (url, init) => {
      if (url.includes("/search/repositories")) {
        seen.push(init?.headers?.Authorization);
        return res(ghBody());
      }
      return res(npmBody());
    };
    const ps = createPluginSearch({
      http,
      clock: { now: () => 0 },
      githubToken: () => token,
    });
    await ps.search({ tag: "t" });
    token = "later";
    await ps.search({ tag: "t" });
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toBe("Bearer later");
  });

  it("does not cache a response carrying errors (TC-051)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url) => {
      calls++;
      if (url.includes("/-/v1/search"))
        return res(npmBody(npmPkg({ links: {} })));
      throw new Error("gh down");
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    await ps.search({ tag: "t" });
    const after1 = calls;
    await ps.search({ tag: "t" });
    expect(calls).toBeGreaterThan(after1);
  });

  it("keys verifier-presence and token-id distinctly (TC-052)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url) => {
      calls++;
      if (url.includes("unpkg")) return res("m");
      return url.includes("/-/v1/search")
        ? res(npmBody(npmPkg({ links: {} })))
        : res(ghBody());
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    await ps.search({ tag: "t", sources: ["npm"] });
    const noVerifier = calls;
    await ps.search({ tag: "t", sources: ["npm"], verifier: okVerifier() });
    expect(calls).toBeGreaterThan(noVerifier);
  });

  it("uses a default verifier from deps when none is passed per call", async () => {
    let manifestFetched = false;
    const http: HttpFetcher = async (url) => {
      if (url.includes("unpkg")) {
        manifestFetched = true;
        return res("m");
      }
      return url.includes("/-/v1/search")
        ? res(npmBody(npmPkg({ links: {} })))
        : res(ghBody());
    };
    const ps = createPluginSearch({
      http,
      clock: { now: () => 0 },
      verifier: okVerifier(),
    });
    const r = await ps.search({ tag: "t", sources: ["npm"] });
    expect(manifestFetched).toBe(true);
    expect(r.results[0].verified).toBe(true);
  });

  it("prefers per-call endpoints, falling back to deps endpoints", async () => {
    const urls: string[] = [];
    const http: HttpFetcher = async (url) => {
      urls.push(url);
      return url.includes("/-/v1/search") ? res(npmBody()) : res(ghBody());
    };
    const ps = createPluginSearch({
      http,
      clock: { now: () => 0 },
      npmRegistry: "https://deps-npm",
      githubApi: "https://deps-gh",
    });
    await ps.search({
      tag: "t",
      npmRegistry: "https://call-npm",
      githubApi: "https://call-gh",
    });
    await ps.search({ tag: "t2", query: "q", limit: 5 });
    expect(urls.some((u) => u.startsWith("https://call-npm"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://call-gh"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://deps-npm"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://deps-gh"))).toBe(true);
  });

  it("keys distinct non-empty tokens to distinct cache entries (TC-055)", async () => {
    let token: string | undefined = "tokA";
    let calls = 0;
    const http: HttpFetcher = async (url, init) => {
      calls++;
      return okHttp(url, init);
    };
    const ps = createPluginSearch({
      http,
      clock: { now: () => 0 },
      githubToken: () => token,
    });
    await ps.search({ tag: "t" }); // caches under tokA's token-id
    const afterA = calls;
    token = "tokB";
    await ps.search({ tag: "t" }); // distinct token-id → must NOT cross-hit tokA
    expect(calls).toBeGreaterThan(afterA);
    const afterB = calls;
    await ps.search({ tag: "t" }); // tokB now cached → no fetch
    expect(calls).toBe(afterB);
    token = "tokA";
    await ps.search({ tag: "t" }); // tokA's entry still distinct + live → no fetch
    expect(calls).toBe(afterB);
  });

  it("bounds the cache by a default max, evicting the oldest entry (TC-056)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url, init) => {
      calls++;
      return okHttp(url, init);
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    for (let i = 0; i < 257; i++) await ps.search({ tag: `t${i}` });
    const afterFill = calls;
    await ps.search({ tag: "t0" }); // oldest was evicted past the default bound
    expect(calls).toBeGreaterThan(afterFill);
    const afterEvicted = calls;
    await ps.search({ tag: "t256" }); // a recent entry is still cached
    expect(calls).toBe(afterEvicted);
  });

  it("honors an explicit cacheMax override (TC-060)", async () => {
    let calls = 0;
    const http: HttpFetcher = async (url, init) => {
      calls++;
      return okHttp(url, init);
    };
    const ps = createPluginSearch({
      http,
      clock: { now: () => 0 },
      cacheMax: 1,
    });
    await ps.search({ tag: "a" });
    await ps.search({ tag: "b" }); // evicts "a" past the bound of 1
    const before = calls;
    await ps.search({ tag: "a" }); // "a" was evicted → re-fetch
    expect(calls).toBeGreaterThan(before);
  });

  it("returns a distinct response object on a cache hit (TC-059)", async () => {
    const ps = createPluginSearch({ http: okHttp, clock: { now: () => 0 } });
    const first = await ps.search({ tag: "t" });
    const hit = await ps.search({ tag: "t" });
    expect(hit).not.toBe(first);
    expect(hit.results).not.toBe(first.results);
    expect(hit).toEqual(first);
  });
});

// ── FR-011: GitHub rate limit ────────────────────────────────────────────────

describe("rate-limit surfacing + short-circuit (FR-011)", () => {
  it("reads github rate-limit headers into rate.github (TC-037)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(ghBody(), { headers: RL("30", "29", "12345") })
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.rate.github).toEqual({ limit: 30, remaining: 29, resetAt: 12345 });
  });

  it("treats non-finite rate-limit headers as no rate info (TC-058)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res(ghBody(), { headers: RL("oops", "29", "12345") })
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.rate.github).toBeUndefined();
  });

  it("surfaces an exhausted github window as a rateLimited error (TC-038)", async () => {
    const http: HttpFetcher = async (url) =>
      url.includes("/search/repositories")
        ? res({}, { status: 403, headers: RL("60", "0", "777") })
        : res(npmBody());
    const r = await searchPlugins({ tag: "t", http, sources: ["github"] });
    expect(r.errors[0]).toMatchObject({
      backend: "github",
      rateLimited: true,
      status: 403,
      resetAt: 777,
    });
    expect(r.rate.github?.remaining).toBe(0);
  });

  it("skips github while the window is exhausted (TC-039)", async () => {
    let t = 0;
    let ghCalls = 0;
    const http: HttpFetcher = async (url) => {
      if (url.includes("/search/repositories")) {
        ghCalls++;
        return res({}, { status: 403, headers: RL("60", "0", "100") });
      }
      return res(npmBody(npmPkg({ links: {} })));
    };
    const ps = createPluginSearch({ http, clock: { now: () => t } });
    await ps.search({ tag: "t" });
    expect(ghCalls).toBe(1);
    t = 50_000;
    const r = await ps.search({ tag: "x" });
    expect(ghCalls).toBe(1);
    expect(r.errors.some((e) => e.backend === "github" && e.rateLimited)).toBe(
      true,
    );
    expect(ps.lastRate().github?.remaining).toBe(0);
  });

  it("resumes github once the clock passes resetAt (TC-040)", async () => {
    let t = 0;
    let ghCalls = 0;
    const http: HttpFetcher = async (url) => {
      if (url.includes("/search/repositories")) {
        ghCalls++;
        return ghCalls === 1
          ? res({}, { status: 403, headers: RL("60", "0", "100") })
          : res(ghBody(), { headers: RL("60", "59", "100") });
      }
      return res(npmBody(npmPkg({ links: {} })));
    };
    const ps = createPluginSearch({ http, clock: { now: () => t } });
    await ps.search({ tag: "t" });
    t = 200_000;
    await ps.search({ tag: "y" });
    expect(ghCalls).toBe(2);
  });

  it("does not short-circuit on the first call (TC-053)", async () => {
    let ghCalls = 0;
    const http: HttpFetcher = async (url) => {
      if (url.includes("/search/repositories")) {
        ghCalls++;
        return res(ghBody());
      }
      return res(npmBody());
    };
    const ps = createPluginSearch({ http, clock: { now: () => 0 } });
    expect(ps.lastRate()).toEqual({});
    await ps.search({ tag: "t" });
    expect(ghCalls).toBe(1);
  });
});

// ── FR-012 + defaults ────────────────────────────────────────────────────────

describe("sourceToInstallInput (FR-012)", () => {
  it("renders npm and github sources (TC-041)", () => {
    expect(sourceToInstallInput({ type: "npm", package: "@s/p" })).toBe("@s/p");
    expect(sourceToInstallInput({ type: "github", repo: "o/r" })).toBe("o/r");
  });

  it("renders git, url, git-subdir and path sources (TC-042)", () => {
    expect(sourceToInstallInput({ type: "git", url: "https://g/x.git" })).toBe(
      "https://g/x.git",
    );
    expect(sourceToInstallInput({ type: "url", url: "https://u" })).toBe(
      "https://u",
    );
    expect(
      sourceToInstallInput({
        type: "git-subdir",
        url: "https://g/x.git",
        path: "sub",
      }),
    ).toBe("https://g/x.git");
    expect(sourceToInstallInput({ type: "path", path: "/abs" })).toBe("/abs");
  });
});

describe("default global fetch (NFR-005)", () => {
  it("uses the global fetch when no HttpFetcher is injected", async () => {
    const orig = globalThis.fetch;
    const calls: unknown[][] = [];
    globalThis.fetch = (async (url: string, init: unknown) => {
      calls.push([url, init]);
      return res(
        url.includes("/-/v1/search")
          ? npmBody(npmPkg({ links: {} }))
          : ghBody(),
      );
    }) as unknown as typeof fetch;
    try {
      const direct = await defaultHttpFetcher("http://x", {
        headers: { A: "b" },
      });
      expect(await direct.json()).toBeDefined();
      const r = await searchPlugins({ tag: "t" });
      expect(r.results.length).toBeGreaterThan(0);
      const ps = createPluginSearch();
      const r2 = await ps.search({ tag: "z" });
      expect(r2.errors).toEqual([]);
      expect(calls.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
