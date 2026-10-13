import api from "../utils/axiosConfig";
import type { CodeFile } from "./codeApi";

/** Languages, project types and starter projects (GET /api/code/catalog, /starters). */

export interface CatalogLanguage {
  key: string;
  label: string;
  family: string;
  wave: string;
  enabled: boolean;
  runnable: boolean;
  extensions: string[];
  kinds: { id: string; label: string; tier: string; interactive: string }[];
}

export interface StarterSummary {
  id: string;
  language: string;
  kind: string;
  title: string;
  description?: string;
  level?: "beginner" | "intermediate" | "advanced" | string;
  purpose?: string;
  entry?: string;
  open?: string[];
  tags?: string[];
  file_count: number;
  paths: string[];
  has_io_tests: boolean;
  has_unit_tests: boolean;
}

export interface Starter extends StarterSummary {
  files: CodeFile[];
}

let catalogCache: Promise<{ version: string; languages: CatalogLanguage[] }> | null = null;
const starterCache = new Map<string, Promise<Starter>>();

export const catalogApi = {
  catalog() {
    catalogCache ??= api.get("/code/catalog").then((r) => r.data.data);
    catalogCache.catch(() => (catalogCache = null));
    return catalogCache;
  },
  async starters(filter: { language?: string; purpose?: string; level?: string; q?: string } = {}): Promise<StarterSummary[]> {
    const res = await api.get("/code/starters", { params: Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) });
    return res.data.data;
  },
  starter(id: string): Promise<Starter> {
    let p = starterCache.get(id);
    if (!p) {
      p = api.get(`/code/starters/${encodeURIComponent(id)}`).then((r) => r.data.data as Starter);
      p.catch(() => starterCache.delete(id));
      starterCache.set(id, p);
    }
    return p;
  },
};

export const PURPOSE_LABEL: Record<string, string> = {
  hello: "Hello",
  "io-exercise": "Exercise",
  project: "Project",
  api: "API",
  data: "Data",
  algorithms: "Algorithms",
  web: "Website",
};

export const LEVEL_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
