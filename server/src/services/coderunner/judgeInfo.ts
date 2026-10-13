/**
 * What our tm-judge can do right now (CODE_RUNNER_PLAN.md §8): its features
 * (GET /v1/health) and the catalog kinds it runs (GET /v1/catalog). Read in
 * the background and kept for five minutes, so pickers and routing stay
 * synchronous; an older tm-judge (no "projects") keeps the six fixed
 * language profiles.
 */

export interface JudgeKind {
  id: string;
  language: string;
  label: string;
  actions: string[];
}

interface Snapshot {
  at: number;
  features: Set<string>;
  kinds: Map<string, JudgeKind>;
  languages: Set<string>;
}

const EMPTY: Snapshot = { at: 0, features: new Set(), kinds: new Map(), languages: new Set() };
let snap: Snapshot = EMPTY;
let pending: Promise<Snapshot> | null = null;
let timer: NodeJS.Timeout | null = null;
const TTL_MS = 5 * 60_000;

const baseUrl = () => (process.env.TMJUDGE_URL || "http://127.0.0.1:5010").replace(/\/+$/, "");
const headers = (): Record<string, string> => (process.env.TMJUDGE_TOKEN ? { Authorization: `Bearer ${process.env.TMJUDGE_TOKEN}` } : {});

async function getJson(path: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${baseUrl()}${path}`, { headers: headers(), signal: ctrl.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Reads tm-judge's health and catalog now (deduplicated). */
export function refreshJudgeInfo(): Promise<Snapshot> {
  if (process.env.CODERUNNER_ENGINE !== "tmjudge") return Promise.resolve((snap = EMPTY));
  pending ??= (async () => {
    const health = await getJson("/v1/health");
    const features = new Set<string>(Array.isArray(health?.features) ? health.features.map(String) : []);
    const kinds = new Map<string, JudgeKind>();
    if (features.has("projects") && features.has("catalog")) {
      const catalog = await getJson("/v1/catalog");
      for (const k of Array.isArray(catalog?.kinds) ? catalog.kinds : []) {
        if (!k?.id || !k?.language) continue;
        kinds.set(String(k.id), { id: String(k.id), language: String(k.language), label: String(k.label ?? k.id), actions: Array.isArray(k.actions) ? k.actions.map(String) : [] });
      }
    }
    // Keep the last good answer when tm-judge is briefly unreachable.
    if (!health && snap.at) return snap;
    snap = { at: Date.now(), features, kinds, languages: new Set([...kinds.values()].map((k) => k.language)) };
    return snap;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** The current answer; starts a refresh when it is old. */
export function judgeInfo(): Snapshot {
  if (process.env.CODERUNNER_ENGINE !== "tmjudge") return EMPTY;
  if (Date.now() - snap.at > TTL_MS) void refreshJudgeInfo();
  return snap;
}

export const judgeHas = (feature: string) => judgeInfo().features.has(feature);

/** Whether tm-judge runs projects of this catalog language. */
export const judgeRunsLanguage = (language: string) => judgeHas("projects") && judgeInfo().languages.has(language);

/** Whether a kind of this language has unit tests here. */
export const judgeTestsLanguage = (language: string) =>
  judgeHas("projects") && [...judgeInfo().kinds.values()].some((k) => k.language === language && k.actions.includes("test"));

/** Refreshes in the background every few minutes (call once at start-up). */
export function startJudgeInfo() {
  if (timer || process.env.CODERUNNER_ENGINE !== "tmjudge") return;
  void refreshJudgeInfo();
  timer = setInterval(() => void refreshJudgeInfo(), TTL_MS);
  timer.unref();
}

/** Tests only. */
export function resetJudgeInfo() {
  snap = EMPTY;
  pending = null;
  if (timer) clearInterval(timer);
  timer = null;
}
