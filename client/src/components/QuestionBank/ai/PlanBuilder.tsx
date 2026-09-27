import React from "react";
import { Check, Info, Minus, Plus } from "lucide-react";
import type { QuestionType, DifficultyLevel } from "../../../types/quiz.types";
import type { AIPlanItem } from "../../../services/aiQuestionGenerationApi";
import { getQuestionTypeIcon } from "../questionTypeIcons";
import {
  DIFFICULTIES,
  MAX_PER_CELL,
  MAX_TOTAL,
  MIX_PRESETS,
  QUESTION_TYPES,
  clampCell,
  mixTotal,
  planByDifficulty,
  planTotal,
  type Mix,
} from "./aiGeneratorModel";

interface Props {
  types: QuestionType[];
  onTypesChange: (types: QuestionType[]) => void;
  mode: "uniform" | "custom";
  onModeChange: (m: "uniform" | "custom") => void;
  uniform: Mix;
  onUniformChange: (m: Mix) => void;
  perType: Partial<Record<QuestionType, Mix>>;
  onPerTypeChange: (t: QuestionType, m: Mix) => void;
  plan: AIPlanItem[];
}

export const Stepper: React.FC<{
  value: number;
  onChange: (n: number) => void;
  label: string;
  size?: "sm" | "md";
}> = ({ value, onChange, label, size = "md" }) => {
  const btn =
    "flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors";
  const dim = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" aria-label={`Fewer ${label}`} className={`${btn} ${dim}`} disabled={value <= 0} onClick={() => onChange(clampCell(value - 1))}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(clampCell(Number(e.target.value.replace(/\D/g, "") || 0)))}
        onFocus={(e) => e.target.select()}
        className={`${size === "sm" ? "w-8 h-6 text-xs" : "w-10 h-8 text-sm"} text-center font-semibold tabular-nums rounded-lg border border-transparent bg-transparent text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:border-blue-400`}
      />
      <button type="button" aria-label={`More ${label}`} className={`${btn} ${dim}`} disabled={value >= MAX_PER_CELL} onClick={() => onChange(clampCell(value + 1))}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const PlanBuilder: React.FC<Props> = ({
  types,
  onTypesChange,
  mode,
  onModeChange,
  uniform,
  onUniformChange,
  perType,
  onPerTypeChange,
  plan,
}) => {
  const toggleType = (t: QuestionType) =>
    onTypesChange(types.includes(t) ? types.filter((x) => x !== t) : [...types, t]);
  const total = planTotal(plan);
  const byLevel = planByDifficulty(plan);
  const over = total > MAX_TOTAL;
  const hasComplex = types.some((t) => QUESTION_TYPES.find((q) => q.value === t)?.complex);
  const activePreset = MIX_PRESETS.find(
    (p) => mode === "uniform" && p.mix.EASY === uniform.EASY && p.mix.MEDIUM === uniform.MEDIUM && p.mix.DIFFICULT === uniform.DIFFICULT,
  );

  return (
    <div className="space-y-5">
      {/* Types */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            Question types <span className="font-normal text-gray-400">({types.length} selected)</span>
          </h4>
          {types.length > 0 && (
            <button type="button" onClick={() => onTypesChange([])} className="text-xs text-gray-500 hover:text-blue-600">
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_TYPES.map((qt) => {
            const on = types.includes(qt.value);
            const Icon = getQuestionTypeIcon(qt.value);
            return (
              <button
                key={qt.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(qt.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  on
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30"
                    : "bg-white dark:bg-gray-800/60 text-text-secondary-light dark:text-text-secondary-dark border-gray-200 dark:border-gray-700 hover:border-blue-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {qt.label}
                {on && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
        {hasComplex && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Coding, Algorithmic, Drag & Drop and Logical Expression are harder for AI — review those carefully.
          </p>
        )}
      </section>

      {/* Difficulty mix */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">How many, at which difficulty</h4>
          <div className="inline-flex p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs" role="radiogroup" aria-label="Count mode">
            {(["uniform", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onModeChange(m)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  mode === m ? "bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-200 shadow-sm" : "text-gray-500"
                }`}
              >
                {m === "uniform" ? "Same for every type" : "Per type"}
              </button>
            ))}
          </div>
        </div>

        {mode === "uniform" ? (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-thin">
              {MIX_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onUniformChange({ ...p.mix })}
                  title={p.description}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    activePreset?.id === p.id
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-300"
                  }`}
                >
                  {p.label} <span className="text-gray-400">· {p.description}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <div
                  key={d.value}
                  className={`rounded-xl border p-3 flex sm:flex-col items-center sm:items-start justify-between gap-2 ${
                    uniform[d.value] > 0 ? d.chip : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${d.dot}`} /> {d.label}
                    </p>
                    <p className="text-[11px] opacity-75">{d.hint}</p>
                  </div>
                  <Stepper
                    label={`${d.label} questions per type`}
                    value={uniform[d.value]}
                    onChange={(n) => onUniformChange({ ...uniform, [d.value]: n })}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Per type: {mixTotal(uniform)} question{mixTotal(uniform) === 1 ? "" : "s"} × {types.length} type{types.length === 1 ? "" : "s"}
            </p>
          </>
        ) : types.length === 0 ? (
          <p className="text-xs text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center">
            Pick question types first.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="text-left font-semibold px-3 py-2">Type</th>
                  {DIFFICULTIES.map((d) => (
                    <th key={d.value} className="font-semibold px-2 py-2">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} /> {d.label}
                      </span>
                    </th>
                  ))}
                  <th className="font-semibold px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const m = perType[t] ?? uniform;
                  const Icon = getQuestionTypeIcon(t);
                  return (
                    <tr key={t} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary-light dark:text-text-primary-dark">
                          <Icon className="w-3.5 h-3.5 text-blue-500" />
                          {QUESTION_TYPES.find((q) => q.value === t)?.label}
                        </span>
                      </td>
                      {DIFFICULTIES.map((d) => (
                        <td key={d.value} className="px-2 py-1.5 text-center">
                          <Stepper
                            size="sm"
                            label={`${d.label} ${t}`}
                            value={m[d.value as DifficultyLevel]}
                            onChange={(n) => onPerTypeChange(t, { ...m, [d.value]: n })}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                        {mixTotal(m)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Distribution */}
        <div className="mt-3">
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800" aria-hidden>
            {DIFFICULTIES.map((d) =>
              byLevel[d.value] ? (
                <div key={d.value} className={`${d.dot} transition-all`} style={{ width: `${(byLevel[d.value] / Math.max(total, 1)) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500" aria-live="polite">
            {DIFFICULTIES.map((d) => (
              <span key={d.value} className="inline-flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${d.dot}`} /> {d.label} <b className="tabular-nums text-text-primary-light dark:text-text-primary-dark">{byLevel[d.value]}</b>
              </span>
            ))}
            <span className="ml-auto font-semibold text-text-primary-light dark:text-text-primary-dark">
              {total} question{total === 1 ? "" : "s"}
            </span>
          </div>
          {over && (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5" role="alert">
              <Info className="w-3.5 h-3.5" /> At most {MAX_TOTAL} questions per run — lower some counts.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default PlanBuilder;
