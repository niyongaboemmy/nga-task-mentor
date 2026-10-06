import { Judge0Service, SupportedLanguage } from "../services/Judge0Service";
import { getCodeRunner } from "../services/coderunner";
import { profileById, profileIdForLanguage } from "../tmcode/profiles";

/**
 * Which language a coding/algorithmic question (and an answer to it) runs
 * in. One place, so authoring validation, "Run" and grading agree — and so
 * nothing ever runs under a runtime the question didn't declare (D4).
 */

/** Rendered in the browser preview; never sent to the judge. */
export const WEB_PREVIEW_LANGUAGES = [
  "html",
  "css",
  "react",
  "vue",
  "angular",
  "nextjs",
] as const;

export const isWebLanguage = (language: unknown): boolean =>
  typeof language === "string" &&
  (WEB_PREVIEW_LANGUAGES as readonly string[]).includes(language.trim().toLowerCase());

const parseJson = (v: any) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
};

/**
 * Judge languages a student may answer in: the question's own language plus
 * `allowed_languages`, as canonical keys. Empty when the question names none
 * (old algorithmic questions): then any judge language is accepted.
 */
export function allowedAnswerLanguages(questionData: any): string[] {
  const qd = parseJson(questionData) || {};
  const out: string[] = [];
  const add = (l: unknown) => {
    const key = Judge0Service.normalizeLanguage(l);
    if (key && !out.includes(key)) out.push(key);
  };
  add(qd.language);
  if (Array.isArray(qd.allowed_languages)) qd.allowed_languages.forEach(add);
  return out;
}

/**
 * The judge language an answer is run in: the student's pick when the
 * question allows it, else the question's own language. null when neither is
 * a language the judge runs (a web project, or an unmapped language).
 */
export function resolveAnswerLanguage(
  questionData: any,
  answerLanguage: unknown,
): string | null {
  const qd = parseJson(questionData) || {};
  const allowed = allowedAnswerLanguages(qd);
  const picked = Judge0Service.normalizeLanguage(answerLanguage);
  if (picked && (allowed.length === 0 || allowed.includes(picked))) return picked;
  return Judge0Service.normalizeLanguage(qd.language);
}

/**
 * Authoring checks for `language` / `allowed_languages` (question save).
 * Coding questions may also be web projects (preview only). Algorithmic
 * answers always run on the judge; an old algorithmic question without a
 * language only gets a warning, so imports keep working.
 */
export function validateCodeLanguages(
  questionType: "coding" | "algorithmic",
  data: any,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const runner = getCodeRunner();
  const supported = runner.languages();
  const ok = (l: unknown) =>
    runner.supportsLanguage(l) ||
    (questionType === "coding" && isWebLanguage(l));

  if (data?.language !== undefined && data?.language !== null && data?.language !== "") {
    if (!ok(data.language)) {
      errors.push(
        `Unsupported language "${String(data.language)}". Supported: ${supported.join(", ")}`,
      );
    }
  } else if (questionType === "algorithmic") {
    warnings.push(
      "No language set: students may answer in any supported language. Set one so the editor opens in it.",
    );
  }

  if (Array.isArray(data?.allowed_languages)) {
    const bad = data.allowed_languages.filter((l: unknown) => !ok(l));
    if (bad.length) {
      errors.push(`Unsupported allowed_languages: ${bad.map(String).join(", ")}`);
    }
  }
  return { errors, warnings };
}

/**
 * Languages the configured code runner can run, for authors
 * (GET /api/quizzes/code-languages). With tm-judge the runtime is the TMCode
 * profile's; judge_language_id is 0 (tm-judge takes profile ids).
 */
export function codeRunnerLanguages(): SupportedLanguage[] {
  const runner = getCodeRunner();
  if (runner.name === "judge0") return Judge0Service.supportedLanguages();
  const labels = new Map(Judge0Service.supportedLanguages().map((l) => [l.key, l.label]));
  return runner.languages().map((key) => {
    const profile = profileById(profileIdForLanguage(key) ?? "");
    return {
      key,
      label: labels.get(key) ?? profile?.label ?? key,
      judge_language_id: 0,
      runtime: profile ? `${profile.label} (${profile.judge?.version ?? ""})` : null,
    };
  });
}
