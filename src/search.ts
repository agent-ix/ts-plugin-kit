/**
 * Plugin discovery: search npm and GitHub for publishable plugins carrying a
 * host-chosen discriminator `tag`, optionally verify each candidate against a
 * host-supplied manifest predicate, cache results with an injectable-clock TTL,
 * and surface GitHub rate limits. This is the library's only asynchronous,
 * networked surface; all network access flows through the injectable
 * {@link HttpFetcher} (default: the Node global `fetch`), so it adds no runtime
 * dependency and is fully offline-testable (NFR-005).
 */
import { Source } from "./sources.js";

// ── Injectable HTTP seam (a structural subset of the DOM `Response`) ─────────

export interface HttpRequestInit {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface HttpFetcher {
  (url: string, init?: HttpRequestInit): Promise<HttpResponse>;
}

/** Default fetcher: delegates to the Node 18+ global `fetch`. Keeps zero-dep. */
export const defaultHttpFetcher: HttpFetcher = (url, init) => fetch(url, init);

// ── Result / option / response types ────────────────────────────────────────

export type SearchBackend = "npm" | "github";

export interface PluginSearchResult {
  /** Stable id: `${origin}:${fullName}`. */
  id: string;
  origin: SearchBackend;
  /** Package or repository name. */
  name: string;
  /** `scope/name` (npm) or `owner/repo` (github). */
  fullName: string;
  description?: string;
  author?: string;
  version?: string;
  stars?: number;
  updatedAt?: string;
  /** A human-facing link for the result. */
  url?: string;
  /** The discriminator tag that matched. */
  matchedTag: string;
  /** Ready for the host install/resolve path. */
  source: Source;
  /** True once a {@link CandidateVerifier} has accepted it. */
  verified?: boolean;
  /** Host-supplied capabilities from {@link CandidateVerifier.verify}. */
  capabilities?: unknown;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  /** Epoch **seconds** (from `x-ratelimit-reset`). */
  resetAt: number;
}

export interface SearchBackendError {
  backend: SearchBackend;
  message: string;
  status?: number;
  /** True when the backend's request window is exhausted. */
  rateLimited?: boolean;
  /** True when the failure is transient (network/5xx), not a definitive answer. */
  transient?: boolean;
  resetAt?: number;
}

export interface SearchResponse {
  results: PluginSearchResult[];
  rate: Partial<Record<SearchBackend, RateLimit>>;
  /** One entry per failed backend; a search never throws on a backend failure. */
  errors: SearchBackendError[];
}

/**
 * Host plug-in for compatibility verification. The kit fetches the raw manifest
 * text and hands it to {@link verify}; it never parses the manifest itself.
 */
export interface CandidateVerifier {
  manifestPath: string;
  /** Return `null` to reject a candidate, or capabilities to accept it. */
  verify(rawManifest: string): { capabilities?: unknown } | null;
}

export interface SearchOptions {
  /** Required discriminator (npm keyword / GitHub topic). */
  tag: string;
  query?: string;
  sources?: SearchBackend[];
  /** Per-backend result cap (default 20; clamped to each backend's max). */
  limit?: number;
  http?: HttpFetcher;
  githubToken?: string;
  npmRegistry?: string;
  githubApi?: string;
  verifier?: CandidateVerifier;
  signal?: AbortSignal;
}

const NPM_REGISTRY = "https://registry.npmjs.org";
const GITHUB_API = "https://api.github.com";
const NPM_SIZE_MAX = 250;
const GITHUB_PER_PAGE_MAX = 100;
const VERIFY_CONCURRENCY = 6;
const DEFAULT_SOURCES: SearchBackend[] = ["npm", "github"];

interface BackendOutcome {
  results: PluginSearchResult[];
  rate?: RateLimit;
  error?: SearchBackendError;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function composeText(
  prefix: string,
  tag: string,
  query: string | undefined,
): string {
  return prefix + tag + (query ? ` ${query}` : "");
}

// ── Candidate search (FR-008) ───────────────────────────────────────────────

/**
 * Search the selected backends for candidates matching `tag` and return a
 * normalized, deduped, ranked {@link SearchResponse}. Backends run independently
 * (a rejecting backend still returns the other's results plus an error). When a
 * {@link CandidateVerifier} is supplied, incompatible candidates are dropped.
 */
export async function searchPlugins(
  opts: SearchOptions,
): Promise<SearchResponse> {
  const http = opts.http ?? defaultHttpFetcher;
  const sources = opts.sources ?? DEFAULT_SOURCES;
  const limit = opts.limit ?? 20;

  const settled = await Promise.allSettled(
    sources.map((backend) =>
      backend === "npm"
        ? searchNpm(opts, http, limit)
        : searchGithub(opts, http, limit),
    ),
  );

  const rate: Partial<Record<SearchBackend, RateLimit>> = {};
  const errors: SearchBackendError[] = [];
  let candidates: PluginSearchResult[] = [];

  settled.forEach((res, i) => {
    const backend = sources[i];
    if (res.status === "fulfilled") {
      candidates.push(...res.value.results);
      if (res.value.rate) rate[backend] = res.value.rate;
      if (res.value.error) errors.push(res.value.error);
    } else {
      errors.push({ backend, message: errMsg(res.reason) });
    }
  });

  if (opts.verifier) {
    candidates = await verifyCandidates(
      candidates,
      opts.verifier,
      opts,
      http,
      errors,
    );
  }

  return { results: rank(dedupe(candidates)), rate, errors };
}

async function searchNpm(
  opts: SearchOptions,
  http: HttpFetcher,
  limit: number,
): Promise<BackendOutcome> {
  const registry = opts.npmRegistry ?? NPM_REGISTRY;
  const size = Math.min(limit, NPM_SIZE_MAX);
  const text = composeText("keywords:", opts.tag, opts.query);
  const url = `${registry}/-/v1/search?text=${encodeURIComponent(text)}&size=${size}`;
  const res = await http(url, { signal: opts.signal });
  if (!res.ok) {
    return {
      results: [],
      error: {
        backend: "npm",
        message: `npm search failed (${res.status})`,
        status: res.status,
      },
    };
  }
  const body = (await res.json()) as { objects?: unknown };
  if (!Array.isArray(body.objects)) {
    return {
      results: [],
      error: {
        backend: "npm",
        message: "npm search returned a malformed body",
      },
    };
  }
  const results: PluginSearchResult[] = [];
  for (const obj of body.objects) {
    const r = npmResult((obj as { package?: unknown }).package, opts.tag);
    if (r) results.push(r);
  }
  return { results };
}

function npmResult(pkg: unknown, tag: string): PluginSearchResult | null {
  const p = pkg as {
    name?: unknown;
    version?: unknown;
    description?: unknown;
    date?: unknown;
    links?: { repository?: string; npm?: string; homepage?: string };
    author?: { name?: string };
  } | null;
  if (!p || typeof p.name !== "string") return null;
  return {
    id: `npm:${p.name}`,
    origin: "npm",
    name: p.name,
    fullName: p.name,
    description: typeof p.description === "string" ? p.description : undefined,
    author: p.author?.name,
    version: typeof p.version === "string" ? p.version : undefined,
    updatedAt: typeof p.date === "string" ? p.date : undefined,
    url: p.links?.repository ?? p.links?.homepage ?? p.links?.npm,
    matchedTag: tag,
    source: { type: "npm", package: p.name },
  };
}

async function searchGithub(
  opts: SearchOptions,
  http: HttpFetcher,
  limit: number,
): Promise<BackendOutcome> {
  const api = opts.githubApi ?? GITHUB_API;
  const perPage = Math.min(limit, GITHUB_PER_PAGE_MAX);
  const q = composeText("topic:", opts.tag, opts.query);
  const url = `${api}/search/repositories?q=${encodeURIComponent(q)}&per_page=${perPage}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.githubToken) headers.Authorization = `Bearer ${opts.githubToken}`;
  const res = await http(url, { headers, signal: opts.signal });
  const rate = parseRate(res);
  if (!res.ok) {
    const exhausted =
      (res.status === 403 || res.status === 429) && rate?.remaining === 0;
    return {
      results: [],
      rate,
      error: {
        backend: "github",
        message: exhausted
          ? "github rate limit exhausted"
          : `github search failed (${res.status})`,
        status: res.status,
        rateLimited: exhausted ? true : undefined,
        resetAt: exhausted ? rate?.resetAt : undefined,
      },
    };
  }
  const body = (await res.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) {
    return {
      results: [],
      rate,
      error: {
        backend: "github",
        message: "github search returned a malformed body",
      },
    };
  }
  const results: PluginSearchResult[] = [];
  for (const item of body.items) {
    const r = githubResult(item, opts.tag);
    if (r) results.push(r);
  }
  return { results, rate };
}

function githubResult(item: unknown, tag: string): PluginSearchResult | null {
  const r = item as {
    full_name?: unknown;
    name?: unknown;
    description?: unknown;
    stargazers_count?: unknown;
    owner?: { login?: string };
    html_url?: unknown;
    pushed_at?: unknown;
  } | null;
  if (!r || typeof r.full_name !== "string") return null;
  return {
    id: `github:${r.full_name}`,
    origin: "github",
    name: typeof r.name === "string" ? r.name : r.full_name,
    fullName: r.full_name,
    description: typeof r.description === "string" ? r.description : undefined,
    author: r.owner?.login,
    stars:
      typeof r.stargazers_count === "number" ? r.stargazers_count : undefined,
    updatedAt: typeof r.pushed_at === "string" ? r.pushed_at : undefined,
    url: typeof r.html_url === "string" ? r.html_url : undefined,
    matchedTag: tag,
    source: { type: "github", repo: r.full_name },
  };
}

function parseRate(res: HttpResponse): RateLimit | undefined {
  const limit = res.headers.get("x-ratelimit-limit");
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");
  if (limit === null || remaining === null || reset === null) return undefined;
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    resetAt: Number(reset),
  };
}

// ── Dedupe + rank (FR-008) ──────────────────────────────────────────────────

/** Normalize a repository reference to a `owner/repo` key, or null if not GitHub. */
function repoKey(result: PluginSearchResult): string | null {
  const raw =
    result.origin === "github" ? `github.com/${result.fullName}` : result.url;
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  s = s.replace(/^git\+/, "").replace(/^git@github\.com:/, "github.com/");
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.replace(/\.git$/, "").replace(/\/$/, "");
  const m = s.match(/github\.com\/([^/]+\/[^/]+)/);
  return m ? m[1] : null;
}

function mergePreferNpm(
  a: PluginSearchResult,
  b: PluginSearchResult,
): PluginSearchResult {
  const npm = a.origin === "npm" ? a : b;
  const other = npm === a ? b : a;
  npm.stars = npm.stars ?? other.stars;
  npm.updatedAt = npm.updatedAt ?? other.updatedAt;
  return npm;
}

function dedupe(results: PluginSearchResult[]): PluginSearchResult[] {
  const byKey = new Map<string, PluginSearchResult>();
  const unkeyed: PluginSearchResult[] = [];
  for (const r of results) {
    const key = repoKey(r);
    if (key === null) {
      unkeyed.push(r);
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergePreferNpm(existing, r) : r);
  }
  return [...byKey.values(), ...unkeyed];
}

/** Total order: stars desc, then updatedAt desc, then fullName asc. */
function rank(results: PluginSearchResult[]): PluginSearchResult[] {
  return [...results].sort((a, b) => {
    const byStars = (b.stars ?? -1) - (a.stars ?? -1);
    if (byStars !== 0) return byStars;
    const byDate = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    if (byDate !== 0) return byDate;
    return a.fullName.localeCompare(b.fullName);
  });
}

// ── Compatibility verification (FR-009) ─────────────────────────────────────

async function verifyCandidates(
  candidates: PluginSearchResult[],
  verifier: CandidateVerifier,
  opts: SearchOptions,
  http: HttpFetcher,
  errors: SearchBackendError[],
): Promise<PluginSearchResult[]> {
  const kept: PluginSearchResult[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < candidates.length) {
      const candidate = candidates[next++];
      const result = await verifyOne(candidate, verifier, opts, http, errors);
      if (result) kept.push(result);
    }
  }
  const pool = Array.from(
    { length: Math.min(VERIFY_CONCURRENCY, candidates.length) },
    () => worker(),
  );
  await Promise.all(pool);
  return kept;
}

function manifestUrl(
  candidate: PluginSearchResult,
  manifestPath: string,
): string {
  return candidate.origin === "npm"
    ? `https://unpkg.com/${candidate.name}/${manifestPath}`
    : `https://raw.githubusercontent.com/${candidate.fullName}/HEAD/${manifestPath}`;
}

async function verifyOne(
  candidate: PluginSearchResult,
  verifier: CandidateVerifier,
  opts: SearchOptions,
  http: HttpFetcher,
  errors: SearchBackendError[],
): Promise<PluginSearchResult | null> {
  const url = manifestUrl(candidate, verifier.manifestPath);
  let res: HttpResponse;
  try {
    res = await http(url, { signal: opts.signal });
  } catch (e) {
    errors.push({
      backend: candidate.origin,
      message: errMsg(e),
      transient: true,
    });
    return null;
  }
  if (res.status === 404) return null; // absent manifest → incompatible, not an error
  if (!res.ok) {
    errors.push({
      backend: candidate.origin,
      message: `manifest fetch failed (${res.status})`,
      status: res.status,
      transient: true,
    });
    return null;
  }
  const text = await res.text();
  let verdict: { capabilities?: unknown } | null;
  try {
    verdict = verifier.verify(text);
  } catch {
    return null; // a throwing predicate drops only this candidate
  }
  if (verdict === null) return null;
  return { ...candidate, verified: true, capabilities: verdict.capabilities };
}

// ── TTL cache with injectable clock (FR-010) ────────────────────────────────

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface TtlCacheOptions {
  ttlMs: number;
  clock?: Clock;
  max?: number;
}

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export function createTtlCache<V>(opts: TtlCacheOptions): TtlCache<V> {
  const clock = opts.clock ?? systemClock;
  const store = new Map<string, { value: V; expiresAt: number }>();
  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (clock.now() >= entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: clock.now() + opts.ttlMs });
      if (opts.max !== undefined && store.size > opts.max) {
        store.delete(store.keys().next().value as string);
      }
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}

// ── Composed factory: cache + rate state across calls (FR-010, FR-011) ──────

export interface PluginSearchDeps {
  http?: HttpFetcher;
  clock?: Clock;
  ttlMs?: number;
  cacheMax?: number;
  /** A value, or a late-bound resolver invoked per call. */
  githubToken?: string | (() => string | undefined);
  npmRegistry?: string;
  githubApi?: string;
  verifier?: CandidateVerifier;
}

export interface PluginSearch {
  search(opts: SearchOptions): Promise<SearchResponse>;
  invalidate(): void;
  lastRate(): Partial<Record<SearchBackend, RateLimit>>;
}

export function createPluginSearch(deps: PluginSearchDeps = {}): PluginSearch {
  const clock = deps.clock ?? systemClock;
  const http = deps.http ?? defaultHttpFetcher;
  const ttlMs = deps.ttlMs ?? 600_000;
  const cache = createTtlCache<SearchResponse>({
    ttlMs,
    clock,
    max: deps.cacheMax,
  });
  let rate: Partial<Record<SearchBackend, RateLimit>> = {};

  function resolveToken(): string | undefined {
    return typeof deps.githubToken === "function"
      ? deps.githubToken()
      : deps.githubToken;
  }

  function cacheKey(opts: SearchOptions, token: string | undefined): string {
    const sources = (opts.sources ?? DEFAULT_SOURCES).join(",");
    return [
      opts.tag,
      opts.query ?? "",
      sources,
      opts.limit ?? 20,
      (opts.verifier ?? deps.verifier) ? "v" : "",
      token ? "auth" : "anon",
    ].join("|");
  }

  return {
    async search(opts) {
      const token = resolveToken();
      const key = cacheKey(opts, token);
      const hit = cache.get(key);
      if (hit) return hit;

      const requested = opts.sources ?? DEFAULT_SOURCES;
      const gh = rate.github;
      const exhausted =
        gh !== undefined &&
        gh.remaining === 0 &&
        clock.now() / 1000 < gh.resetAt;
      const skipGithub = exhausted && requested.includes("github");
      const runSources = skipGithub
        ? requested.filter((s) => s !== "github")
        : requested;

      const response = await searchPlugins({
        ...opts,
        sources: runSources,
        http,
        githubToken: token,
        npmRegistry: opts.npmRegistry ?? deps.npmRegistry,
        githubApi: opts.githubApi ?? deps.githubApi,
        verifier: opts.verifier ?? deps.verifier,
      });

      if (skipGithub) {
        response.errors.push({
          backend: "github",
          message: "github rate limit exhausted",
          rateLimited: true,
          resetAt: gh.resetAt,
        });
        response.rate.github = gh;
      }

      rate = { ...rate, ...response.rate };
      if (response.errors.length === 0) cache.set(key, response);
      return response;
    },
    invalidate() {
      cache.clear();
    },
    lastRate() {
      return rate;
    },
  };
}

// ── Source → install-input string (FR-012) ──────────────────────────────────

/** Render a {@link Source} as the canonical install token a host field accepts. */
export function sourceToInstallInput(source: Source): string {
  switch (source.type) {
    case "npm":
      return source.package;
    case "github":
      return source.repo;
    case "git":
    case "url":
    case "git-subdir":
      return source.url;
    case "path":
      return source.path;
  }
}
