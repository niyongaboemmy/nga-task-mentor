import { useEffect, useState } from "react";
import axios from "../utils/axiosConfig";

/**
 * Languages a coding/algorithmic question can use, from the server
 * (GET /api/quizzes/code-languages): the judge's runtimes, with the version
 * the judge actually runs when known, plus browser-preview web languages.
 * Question forms only offer these; the server rejects anything else on save.
 */
export interface JudgeLanguage {
  key: string;
  label: string;
  judge_language_id: number;
  /** e.g. "Python (3.8.1)" */
  runtime: string | null;
}

export interface CodeLanguages {
  judge: JudgeLanguage[];
  web_preview: string[];
}

/** Used until the server answers (and if it can't). */
export const FALLBACK_CODE_LANGUAGES: CodeLanguages = {
  judge: [
    ["javascript", "JavaScript"],
    ["typescript", "TypeScript"],
    ["python", "Python"],
    ["java", "Java"],
    ["cpp", "C++"],
    ["c", "C"],
    ["go", "Go"],
    ["rust", "Rust"],
    ["ruby", "Ruby"],
    ["csharp", "C#"],
    ["php", "PHP"],
  ].map(([key, label]) => ({ key, label, judge_language_id: 0, runtime: null })),
  web_preview: ["html", "css", "react", "vue", "angular", "nextjs"],
};

let cache: CodeLanguages | null = null;
let inFlight: Promise<CodeLanguages> | null = null;

export function fetchCodeLanguages(): Promise<CodeLanguages> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = axios
      .get("/quizzes/code-languages")
      .then((res) => {
        const data = res.data?.data;
        if (!data || !Array.isArray(data.judge)) throw new Error("bad response");
        cache = { judge: data.judge, web_preview: data.web_preview || [] };
        return cache;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** "Python 3.8.1" from the judge's "Python (3.8.1)", else the plain label. */
export function languageDisplayName(lang: JudgeLanguage): string {
  const m = lang.runtime?.match(/\(([^)]*)\)/);
  if (!m) return lang.label;
  const inner = m[1];
  return /^\d/.test(inner) ? `${lang.label} ${inner}` : `${lang.label} (${inner})`;
}

export function useCodeLanguages(): CodeLanguages & { loaded: boolean } {
  const [langs, setLangs] = useState<CodeLanguages | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetchCodeLanguages()
      .then((l) => alive && setLangs(l))
      .catch(() => alive && setLangs(FALLBACK_CODE_LANGUAGES));
    return () => {
      alive = false;
    };
  }, []);
  return { ...(langs ?? FALLBACK_CODE_LANGUAGES), loaded: langs !== null };
}

/** Test hook: forget the cached list. */
export function resetCodeLanguagesCache() {
  cache = null;
  inFlight = null;
}
