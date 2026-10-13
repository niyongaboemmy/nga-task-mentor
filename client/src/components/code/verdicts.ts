import type { RunVerdict } from "../../services/codeApi";

/** What each run verdict means to a person (icon + words, never colour alone). */
export const VERDICT: Record<RunVerdict, { label: string; tone: "ok" | "warn" | "bad" }> = {
  ok: { label: "Ran", tone: "ok" },
  accepted: { label: "Passed", tone: "ok" },
  "wrong-answer": { label: "Different output", tone: "warn" },
  "runtime-error": { label: "Crashed", tone: "bad" },
  "time-limit": { label: "Too slow (time limit)", tone: "bad" },
  "memory-limit": { label: "Out of memory", tone: "bad" },
  "output-limit": { label: "Too much output", tone: "bad" },
  "compile-error": { label: "Doesn't compile", tone: "bad" },
  "package-not-available": { label: "Package not available", tone: "bad" },
  "internal-error": { label: "Runner error", tone: "bad" },
};
