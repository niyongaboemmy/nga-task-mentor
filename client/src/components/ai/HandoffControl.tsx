import React, { useId, useState } from "react";
import { ClipboardPaste, ExternalLink, Loader2 } from "lucide-react";
import Select from "../ui/Select";
import { useAiPolicy } from "../../hooks/useAiAccess";
import type { AiPolicySummary } from "../../services/aiApi";
import {
  TARGET_LABELS,
  copyText,
  handoffErrorMessage,
  handoffPlan,
  openExternal,
  type AiHandoffRequest,
  type HandoffPayload,
  type HandoffTarget,
} from "../../services/aiHandoffApi";

/**
 * "Open in my AI ▾" + "Paste the answer" (EXTERNAL_AI_CONTRACT.md §1), next to an AI button.
 *
 *  1. Choosing Claude / ChatGPT / Gemini / Copy calls `request({ mode:"prompt" })`: the
 *     server answers with the exact prompt instead of calling an AI.
 *  2. Claude and ChatGPT open in a new tab with the prompt filled in (≤ 6000 characters;
 *     longer prompts are copied and the site opens). Gemini: copied, then opened. Nothing
 *     is ever submitted for the person.
 *  3. "Paste the answer" sends `request({ mode:"import", text })`; the panel shows the
 *     result as usual (`onImported` gets the normal response body, `ai.route` "handoff").
 *
 * Shown only when the school allows it and the person may (GET /api/ai/policy external.handoff).
 * `pupilData`: the prompt carries a pupil's work or record: an "Include pupil details"
 * checkbox (unticked) sends `pupilConsent`.
 */

const NONE = "";

export const HandoffControl: React.FC<{
  /** Calls the AI endpoint with the usual body plus `aiHandoff`; resolves to the response body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each AI endpoint answers its own shape
  request: (aiHandoff: AiHandoffRequest) => Promise<any>;
  /** The import answer (same body as a normal call). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each AI endpoint answers its own shape
  onImported: (body: any) => void;
  pupilData?: boolean;
  disabled?: boolean;
  idPrefix?: string;
  className?: string;
  /** Tests: skip the policy fetch. */
  policy?: AiPolicySummary | null;
}> = ({ request, onImported, pupilData = false, disabled, idPrefix, className = "", policy: given }) => {
  const auto = useId().replace(/:/g, "");
  const id = idPrefix ?? `handoff-${auto}`;
  const { policy: fetched } = useAiPolicy(given === undefined);
  const policy = given !== undefined ? given : fetched;
  const [busy, setBusy] = useState<"prompt" | "import" | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [consent, setConsent] = useState(false);
  const [prompt, setPrompt] = useState<HandoffPayload | null>(null);

  if (!policy?.external?.handoff) return null;
  const pupilsAllowed = policy.external.pupilNames === "with_consent";

  const takeTo = async (target: HandoffTarget) => {
    setBusy("prompt");
    setError("");
    setNote("");
    try {
      const body = await request({ mode: "prompt", ...(pupilData ? { pupilConsent: consent } : {}) });
      const payload: HandoffPayload | undefined = body?.handoff;
      if (!payload?.prompt) throw new Error("Task Mentor did not return a prompt. Try again.");
      setPrompt(payload);
      const plan = handoffPlan(target, payload.prompt);
      let copied = false;
      if (plan.copy) copied = await copyText(payload.prompt);
      if (plan.url) openExternal(plan.url);
      const where = TARGET_LABELS[target];
      setNote(
        target === "copy"
          ? copied
            ? "Prompt copied. Paste it into your own AI, then paste its answer below."
            : "Copy the prompt below into your own AI, then paste its answer here."
          : plan.prefilled
            ? `${where} opened with the prompt filled in. Send it there, then paste the answer below.`
            : copied
              ? `Prompt copied and ${where} opened. Paste the prompt there, then paste the answer below.`
              : `${where} opened. Copy the prompt below into it, then paste the answer here.`,
      );
      setPasteOpen(true);
    } catch (err) {
      setError(handoffErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const importAnswer = async () => {
    if (!pasted.trim()) {
      setError("Paste the answer from your AI first.");
      return;
    }
    setBusy("import");
    setError("");
    try {
      const body = await request({ mode: "import", text: pasted });
      onImported(body);
      setPasted("");
      setPasteOpen(false);
      setNote("");
      setPrompt(null);
    } catch (err) {
      setError(handoffErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`space-y-2 text-sm ${className}`} data-testid={`${id}-handoff`}>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          id={`${id}-open`}
          size="sm"
          variant="outline"
          className="min-w-[11rem]"
          value={NONE}
          disabled={disabled || busy !== null}
          aria-label="Open in my AI"
          icon={busy === "prompt" ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <ExternalLink className="w-3.5 h-3.5" aria-hidden />}
          onValueChange={(v) => {
            if (v) void takeTo(v as HandoffTarget);
          }}
        >
          <option value={NONE}>Open in my AI</option>
          <option value="claude">{TARGET_LABELS.claude}</option>
          <option value="chatgpt">{TARGET_LABELS.chatgpt}</option>
          <option value="gemini">{TARGET_LABELS.gemini}</option>
          <option value="copy">{TARGET_LABELS.copy}</option>
        </Select>
        <button
          type="button"
          onClick={() => setPasteOpen((o) => !o)}
          disabled={disabled || busy !== null}
          aria-expanded={pasteOpen}
          aria-controls={`${id}-paste`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50"
        >
          <ClipboardPaste className="w-3.5 h-3.5" aria-hidden />
          Paste the answer
        </button>
        {pupilData && pupilsAllowed && (
          <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={disabled || busy !== null}
              data-testid={`${id}-consent`}
            />
            Include pupil details
          </label>
        )}
      </div>
      {note && (
        <p role="status" className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          {note}
        </p>
      )}
      {pasteOpen && (
        <div id={`${id}-paste`} className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          {prompt && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-secondary-light dark:text-text-secondary-dark">Show the prompt</summary>
              <textarea
                readOnly
                value={prompt.prompt}
                aria-label="The prompt for your AI"
                className="mt-2 w-full h-28 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 font-mono text-[11px]"
              />
            </details>
          )}
          <label htmlFor={`${id}-answer`} className="block text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
            Paste the answer from your AI
          </label>
          <textarea
            id={`${id}-answer`}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the whole reply, including the ```json block"
            className="w-full h-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={importAnswer}
              disabled={disabled || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {busy === "import" && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
              Use this answer
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default HandoffControl;
