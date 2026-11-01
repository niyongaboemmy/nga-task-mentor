import { isAxiosError } from "../utils/axiosConfig";

/**
 * "Open in Claude / ChatGPT" + "Paste the answer" (nga_central_mis EXTERNAL_AI_CONTRACT.md §1).
 * People's own Claude / ChatGPT subscriptions are never called by Task Mentor: the server
 * builds the exact prompt (aiHandoff.mode "prompt"), the person runs it in their own chat,
 * and pastes the answer back (mode "import"). Nothing is ever submitted on their behalf.
 */

export type AiHandoffRequest = { mode: "prompt"; pupilConsent?: boolean } | { mode: "import"; text: string };

export interface HandoffPayload {
  prompt: string;
  expects: "json" | "text";
  schemaName?: string;
}

export type HandoffTarget = "claude" | "chatgpt" | "gemini" | "copy";

/** Longer prompts don't fit a link reliably: they are copied and the site opens empty. */
export const PREFILL_MAX = 6000;

const SITES: Record<Exclude<HandoffTarget, "copy">, { base: string; prefill?: (q: string) => string }> = {
  claude: { base: "https://claude.ai/new", prefill: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  chatgpt: { base: "https://chatgpt.com/", prefill: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  // Gemini has no prefill link: copy, then open.
  gemini: { base: "https://gemini.google.com/app" },
};

export const TARGET_LABELS: Record<HandoffTarget, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  copy: "Copy the prompt",
};

/**
 * Where to send the person for this prompt, and whether it must be copied first.
 * Pure (tests). `url` is null for "copy".
 */
export function handoffPlan(target: HandoffTarget, prompt: string): { url: string | null; copy: boolean; prefilled: boolean } {
  if (target === "copy") return { url: null, copy: true, prefilled: false };
  const site = SITES[target];
  if (site.prefill && prompt.length <= PREFILL_MAX) return { url: site.prefill(prompt), copy: false, prefilled: true };
  return { url: site.base, copy: true, prefilled: false };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Opens the person's own AI site in a new tab (noopener: it can't reach back into this app). */
export function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** A hand-off answer's error message for the person. */
export function handoffErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return String(msg);
    if (err.code === "ECONNABORTED") return "Task Mentor took too long to answer. Try again.";
  }
  return (err as Error)?.message || "Something went wrong. Try again.";
}
