/**
 * "What students will see" for a quiz's TMCode policy (UX gap review E12):
 * plain sentences, in the order a student meets them. Mirrors the server's
 * normalisation (tmcode/policy.ts): a full terminal exists in practice mode
 * only, and "restricted" is off for now.
 */

export interface TmcodePolicyLike {
  mode: "practice" | "monitored" | "secure";
  intelligence: "none" | "basic" | "diagnostics" | "full";
  paste: "allow" | "internal_only" | "block";
  terminal: "off" | "restricted" | "full";
  internet_in_preview: boolean;
  allow_offline_grace_minutes: number;
  debugger?: boolean;
}

export function tmcodePolicySummary(p: TmcodePolicyLike, delivery: "tmcode_optional" | "tmcode_required" | string): string[] {
  const out: string[] = [];
  out.push(
    delivery === "tmcode_required"
      ? "Coding questions open in the TMCode desktop app only (a computer is needed)."
      : "Students can answer coding questions in TMCode or in the browser.",
  );
  out.push(
    p.mode === "practice"
      ? "No exam rules: TMCode works as it does at home."
      : "TMCode records the session (saves, focus, timing) for you to review.",
  );
  out.push(
    {
      none: "A plain editor: no suggestions, hover tips or error markers.",
      basic: "Syntax colours and bracket matching; no suggestions.",
      diagnostics: "Errors are underlined as they type; no code completion.",
      full: "Code completion and hover tips (never AI).",
    }[p.intelligence],
  );
  out.push(
    {
      allow: "They can paste anything.",
      internal_only: "They can paste only text they copied inside this exam.",
      block: "Pasting is blocked.",
    }[p.paste],
  );
  const terminal = p.terminal === "full" && p.mode === "practice";
  out.push(terminal ? "They get a full terminal on their computer." : "There is no terminal.");
  out.push(p.debugger ? "They can run and debug (breakpoints, stepping)." : "The debugger is off; they can still run their code.");
  out.push(p.internet_in_preview ? "The web preview can load files from the internet." : "The web preview stays offline.");
  out.push(
    p.allow_offline_grace_minutes > 0
      ? `If their connection drops, work saved before the deadline uploads up to ${p.allow_offline_grace_minutes} min after it.`
      : "Work must reach Task Mentor before the deadline; there is no offline grace.",
  );
  return out;
}
