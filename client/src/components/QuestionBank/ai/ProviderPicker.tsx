import React from "react";
import { Cpu, Sparkles, Zap } from "lucide-react";
import type { AIProviderInfo, AIProviderName } from "../../../services/aiQuestionGenerationApi";

interface Props {
  providers: AIProviderInfo[] | null;
  value: AIProviderName | null;
  onChange: (p: AIProviderName | null) => void;
}

/**
 * "Auto" follows the server's AI_PROVIDER_ORDER. Picking a provider only puts
 * it first — the others still take over if it's busy or fails.
 */
const ProviderPicker: React.FC<Props> = ({ providers, value, onChange }) => {
  const usable = (providers ?? []).filter((p) => p.configured);
  const first = usable.find((p) => !p.cooling_down);

  if (providers && !usable.length) {
    return (
      <p className="text-xs rounded-xl px-3 py-2 bg-rose-50 dark:bg-rose-900/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
        No AI provider is configured on the server. Ask an administrator to add an API key (Gemini, Groq, GLM or OpenAI).
      </p>
    );
  }

  const card = (active: boolean, disabled = false) =>
    `text-left rounded-xl border px-3 py-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      disabled
        ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-800"
        : active
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/25"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-blue-300"
    }`;

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-1.5">
        <Cpu className="w-4 h-4 text-blue-500" /> AI engine
      </h4>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2" role="radiogroup" aria-label="AI engine">
        <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={card(value === null)}>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Auto
          </span>
          <span className="block text-[11px] text-gray-500 truncate">{first ? `Starts with ${first.label}` : "Best available"}</span>
        </button>
        {(providers ?? []).map((p) => {
          const disabled = !p.configured;
          return (
            <button
              key={p.name}
              type="button"
              role="radio"
              aria-checked={value === p.name}
              disabled={disabled}
              onClick={() => onChange(p.name)}
              className={card(value === p.name, disabled)}
              title={disabled ? "Not configured on the server" : p.cooling_down ? "Recently rate-limited — others will step in if it's still busy" : p.model}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                <span
                  className={`w-2 h-2 rounded-full ${disabled ? "bg-gray-400" : p.cooling_down ? "bg-amber-500" : "bg-emerald-500"}`}
                  aria-hidden
                />
                {p.label}
              </span>
              <span className="block text-[11px] text-gray-500 truncate">
                {disabled ? "Not configured" : p.cooling_down ? "Busy — cooling down" : p.model}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 flex items-center gap-1">
        <Zap className="w-3 h-3" /> If the chosen engine is busy, the next available one answers automatically — you'll be told.
      </p>
    </section>
  );
};

export default ProviderPicker;
