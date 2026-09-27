import React, { useState } from "react";
import { Check, Lightbulb, Plus } from "lucide-react";
import { toggleSuggestion, type PromptSuggestion } from "./aiGeneratorModel";

export const INSTRUCTIONS_MAX = 2000;

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: PromptSuggestion[];
}

const CATEGORIES: PromptSuggestion["category"][] = ["Focus", "Level", "Style", "Quality"];

const PromptComposer: React.FC<Props> = ({ value, onChange, suggestions }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? suggestions : suggestions.slice(0, 8);
  const byCat = CATEGORIES.map((c) => ({ c, items: shown.filter((s) => s.category === c) })).filter((g) => g.items.length);
  const left = INSTRUCTIONS_MAX - value.length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="ai-instructions" className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          Instructions for the AI <span className="font-normal text-gray-400">(optional)</span>
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-gray-500 hover:text-blue-600">
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <textarea
          id="ai-instructions"
          value={value}
          maxLength={INSTRUCTIONS_MAX}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="e.g. Focus on how browsers talk to servers; use real-world scenarios; avoid trick questions…"
          className="w-full px-3 py-2.5 pb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 resize-y min-h-[84px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className={`absolute right-3 bottom-2 text-[10px] tabular-nums ${left < 100 ? "text-amber-500" : "text-gray-400"}`}>
          {value.length}/{INSTRUCTIONS_MAX}
        </span>
      </div>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-2.5 space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Suggested prompts — tap to add or remove
        </p>
        {byCat.map(({ c, items }) => (
          <div key={c} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 w-12 shrink-0">{c}</span>
            {items.map((s) => {
              const on = value.includes(s.text);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  title={s.text}
                  onClick={() => onChange(toggleSuggestion(value, s.text).slice(0, INSTRUCTIONS_MAX))}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    on
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
                  }`}
                >
                  {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        ))}
        {suggestions.length > 8 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] font-medium text-blue-600 dark:text-blue-300 hover:underline">
            {showAll ? "Show fewer" : `Show ${suggestions.length - 8} more`}
          </button>
        )}
      </div>
    </section>
  );
};

export default PromptComposer;
