import catalogJson from "../catalog/catalog.json";
import startersJson from "../catalog/starters.json";
import { getCodeRunner } from "./coderunner";

/**
 * The Runtime Catalog (CODE_RUNNER_PLAN.md §11, §14): languages, project
 * types and starter projects, copied from nga-tmcode's @nga/runtimes by
 * scripts/sync-runtimes-catalog.mjs. Read-only data; what can run right now
 * comes from the code runner.
 */

export interface CatalogLanguage {
  key: string;
  label: string;
  family: string;
  wave: string;
  enabled: boolean;
  extensions: string[];
  monaco_language?: string;
}

export interface CatalogKind {
  id: string;
  language: string;
  label: string;
  tier: string;
  interactive: string;
  enabled: boolean;
  starters?: string[];
}

export interface StarterFile {
  path: string;
  content: string;
}

export interface StarterManifest {
  id: string;
  language: string;
  kind: string;
  title: string;
  description?: string;
  level?: string;
  purpose?: string;
  entry?: string;
  open?: string[];
  tests?: { io?: string; unit?: { framework: string; command?: string } };
  tags?: string[];
  aliases?: string[];
  since?: string;
  files: StarterFile[];
}

const catalog = catalogJson as unknown as { version: string; languages: CatalogLanguage[]; kinds: CatalogKind[] };
const starters = (startersJson as unknown as { version: string; starters: StarterManifest[] }).starters;

/** Web pages run in the browser preview, not on the runner. */
const BROWSER_LANGUAGES = new Set(["web", "logic"]);

export const catalogVersion = () => catalog.version;

export function catalogLanguages() {
  const runner = getCodeRunner();
  return catalog.languages.map((l) => ({
    ...l,
    runnable: BROWSER_LANGUAGES.has(l.key) ? l.enabled : l.enabled && runner.supportsLanguage(l.key),
    kinds: catalog.kinds.filter((k) => k.language === l.key && k.enabled).map((k) => ({ id: k.id, label: k.label, tier: k.tier, interactive: k.interactive })),
  }));
}

/** The manifest a list shows: no file contents, but the file paths and counts. */
export function starterSummary(s: StarterManifest) {
  const { files, ...rest } = s;
  return {
    ...rest,
    file_count: files.filter((f) => !f.path.startsWith(".nga/") && !f.path.startsWith(".tmcode/")).length,
    paths: files.map((f) => f.path),
    has_io_tests: files.some((f) => f.path === ".nga/tests.json"),
    has_unit_tests: !!s.tests?.unit,
  };
}

export function listStarters(filter: { language?: string | null; purpose?: string | null; level?: string | null; q?: string | null } = {}) {
  const enabledLanguages = new Set(catalog.languages.filter((l) => l.enabled).map((l) => l.key));
  const q = filter.q?.trim().toLowerCase();
  return starters
    .filter((s) => enabledLanguages.has(s.language))
    .filter((s) => !filter.language || s.language === filter.language)
    .filter((s) => !filter.purpose || s.purpose === filter.purpose)
    .filter((s) => !filter.level || s.level === filter.level)
    .filter((s) => !q || `${s.title} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase().includes(q))
    .map(starterSummary);
}

export function getStarter(id: string): StarterManifest | null {
  return starters.find((s) => s.id === id || (s.aliases ?? []).includes(id)) ?? null;
}
