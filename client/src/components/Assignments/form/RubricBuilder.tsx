import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Wand2,
  Scale,
  Equal,
  X,
  FileSearch,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import type { RubricCriterion } from "../AssignmentCard";
import { evenRubric, rubricTotal, scaleRubric } from "../../../utils/rubricMarks";
import { generateRubric, type GeneratedRubric } from "./assignmentAiApi";

interface RubricBuilderProps {
  rubric: RubricCriterion[];
  onChange: (rubric: RubricCriterion[]) => void;
  maxScore: number;
  onMaxScoreChange: (score: number) => void;
  title: string;
  /** HTML from the description editor — what the AI reads. */
  description: string;
  error?: string;
}

const wordCount = (html: string) =>
  (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const inputCls =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";

const RubricBuilder: React.FC<RubricBuilderProps> = ({
  rubric,
  onChange,
  maxScore,
  onMaxScoreChange,
  title,
  description,
  error,
}) => {
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMarks, setAiMarks] = useState<number>(maxScore || 10);
  const [aiCount, setAiCount] = useState<string>("auto");
  const [aiGuidance, setAiGuidance] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [preview, setPreview] = useState<GeneratedRubric | null>(null);

  const total = rubricTotal(rubric);
  const words = useMemo(() => wordCount(description), [description]);
  const status: "empty" | "match" | "under" | "over" =
    rubric.length === 0 ? "empty" : Math.abs(total - maxScore) < 0.01 ? "match" : total > maxScore ? "over" : "under";

  const openAi = () => {
    setAiMarks(maxScore > 0 ? maxScore : 10);
    setAiError("");
    setPreview(null);
    setAiOpen(true);
  };

  const runAi = async () => {
    if (!(aiMarks > 0)) {
      setAiError("Enter how many marks the assignment is out of.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setPreview(null);
    try {
      const result = await generateRubric({
        title,
        description,
        max_score: aiMarks,
        criteria_count: aiCount === "auto" ? null : Number(aiCount),
        instructions: aiGuidance.trim() || undefined,
      });
      setPreview(result);
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyPreview = () => {
    if (!preview) return;
    if (aiMarks !== maxScore) onMaxScoreChange(aiMarks);
    onChange(preview.criteria);
    setPreview(null);
    setAiOpen(false);
  };

  const update = (index: number, patch: Partial<RubricCriterion>) =>
    onChange(rubric.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...rubric];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    onChange(next);
  };
  const addCriterion = () => {
    const remaining = Math.max(0, Math.round((maxScore - total) * 100) / 100);
    onChange([...rubric, { criteria: "", description: "", max_score: remaining || 1 }]);
  };

  const meterPct = maxScore > 0 ? Math.min(100, (total / maxScore) * 100) : 0;
  const meterColor =
    status === "match" ? "bg-emerald-500" : status === "over" ? "bg-red-500" : "bg-amber-500";

  return (
    <div className="space-y-4" data-testid="rubric-builder">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={aiOpen ? () => setAiOpen(false) : openAi}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-indigo-500/20 transition"
        >
          <Sparkles className="w-4 h-4" />
          {rubric.length ? "Regenerate with AI" : "Generate with AI"}
        </button>
        <button
          type="button"
          onClick={addCriterion}
          className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold border border-dashed border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          <Plus className="w-4 h-4" /> Add criterion
        </button>
      </div>

      {/* AI panel */}
      <AnimatePresence initial={false}>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-[1.5px] bg-gradient-to-br from-violet-500 via-indigo-500 to-sky-500"
              data-testid="rubric-ai-panel"
            >
              <div className="rounded-[15px] bg-white dark:bg-gray-900 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                      <Wand2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                        Build the rubric from your description
                      </p>
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                        If the description already lists marking criteria, the AI picks them up;
                        otherwise it proposes criteria that fit the task.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close AI panel"
                    onClick={() => setAiOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                    words > 0
                      ? "bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {words > 0 ? <FileSearch className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {words > 0
                    ? `The AI will read your description (${words} words) and the title.`
                    : "The description is empty — write the task first for a rubric that fits it."}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                      Marks to distribute
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={Number.isFinite(aiMarks) ? aiMarks : ""}
                      onChange={(e) => setAiMarks(parseFloat(e.target.value))}
                      className={`${inputCls} font-semibold`}
                      aria-label="Marks to distribute"
                      autoFocus
                    />
                    <span className="block text-[11px] text-gray-400 mt-1">
                      Also becomes the assignment's max score
                    </span>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                      Number of criteria
                    </span>
                    <select value={aiCount} onChange={(e) => setAiCount(e.target.value)} className={inputCls}>
                      <option value="auto">Let the AI decide</option>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>
                          {n} criteria
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                      Focus (optional)
                    </span>
                    <input
                      type="text"
                      value={aiGuidance}
                      maxLength={1000}
                      onChange={(e) => setAiGuidance(e.target.value)}
                      placeholder="e.g. weigh responsiveness more"
                      className={inputCls}
                    />
                  </label>
                </div>

                {aiError && (
                  <p role="alert" className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" /> {aiError}
                  </p>
                )}

                {aiLoading && (
                  <div className="space-y-2" aria-busy="true" aria-label="Generating rubric">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-12 rounded-xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                )}

                {preview && !aiLoading && (
                  <div className="space-y-3" data-testid="rubric-ai-preview">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          preview.source === "description"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                        }`}
                      >
                        {preview.source === "description" ? (
                          <>
                            <FileSearch className="w-3.5 h-3.5" /> Found in your description
                          </>
                        ) : (
                          <>
                            <Lightbulb className="w-3.5 h-3.5" /> Suggested by AI
                          </>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {preview.criteria.length} criteria · {fmt(preview.total)} marks
                      </span>
                    </div>
                    {preview.note && (
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark italic">
                        {preview.note}
                      </p>
                    )}
                    <ol className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
                      {preview.criteria.map((c, i) => (
                        <li key={i} className="flex items-start gap-3 px-3 py-2.5">
                          <span className="mt-0.5 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold flex items-center justify-center text-gray-500">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                              {c.criteria}
                            </p>
                            {c.description && (
                              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5 line-clamp-2">
                                {c.description}
                              </p>
                            )}
                          </div>
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                            {fmt(c.max_score)} pts
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  {preview && !aiLoading ? (
                    <>
                      <button
                        type="button"
                        onClick={runAi}
                        className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <RefreshCw className="w-4 h-4" /> Try again
                      </button>
                      <button
                        type="button"
                        onClick={applyPreview}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {rubric.length ? "Replace current rubric" : "Use this rubric"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={runAi}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {aiLoading ? "Reading the description…" : "Generate rubric"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Total meter */}
      {rubric.length > 0 && (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark" data-testid="rubric-total">
              {fmt(total)} <span className="text-gray-400 font-normal">/ {fmt(maxScore || 0)} marks allocated</span>
            </p>
            {status !== "match" && maxScore > 0 && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange(scaleRubric(rubric, maxScore))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400"
                  title="Keep the proportions, make them add up to the max score"
                >
                  <Scale className="w-3.5 h-3.5" /> Scale to {fmt(maxScore)}
                </button>
                <button
                  type="button"
                  onClick={() => onChange(evenRubric(rubric, maxScore))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400"
                >
                  <Equal className="w-3.5 h-3.5" /> Split evenly
                </button>
              </div>
            )}
            {status === "match" && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Balanced
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${meterColor}`}
              animate={{ width: `${meterPct}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
            />
          </div>
          {status === "over" && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              The criteria add up to more than the max score — scale them down before saving.
            </p>
          )}
          {status === "under" && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              {fmt(Math.round((maxScore - total) * 100) / 100)} marks are not assigned to any criterion yet.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}

      {/* Criteria */}
      {rubric.length > 0 ? (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {rubric.map((item, index) => (
              <motion.li
                layout
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 w-7 h-7 flex-shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        aria-label={`Criterion ${index + 1} name`}
                        placeholder="Criterion (e.g. Layout & structure)"
                        value={item.criteria}
                        onChange={(e) => update(index, { criteria: e.target.value })}
                        className={`${inputCls} font-medium`}
                      />
                      <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sm:w-36 flex-shrink-0">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          aria-label={`Criterion ${index + 1} marks`}
                          value={Number.isFinite(item.max_score) ? item.max_score : ""}
                          onChange={(e) => update(index, { max_score: parseFloat(e.target.value) || 0 })}
                          className="w-full min-w-0 bg-transparent px-3 py-2 text-sm font-bold text-center outline-none dark:text-white"
                        />
                        <span className="pr-3 text-xs text-gray-400">pts</span>
                      </div>
                    </div>
                    <textarea
                      aria-label={`Criterion ${index + 1} description`}
                      placeholder="What earns full, partial and low marks…"
                      value={item.description || ""}
                      onChange={(e) => update(index, { description: e.target.value })}
                      rows={2}
                      className={`${inputCls} resize-y min-h-[2.75rem]`}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === rubric.length - 1}
                      onClick={() => move(index, 1)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove criterion ${index + 1}`}
                      onClick={() => onChange(rubric.filter((_, i) => i !== index))}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      ) : (
        !aiOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={openAi}
              className="text-left rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 p-4 transition"
            >
              <Sparkles className="w-5 h-5 text-violet-500 mb-2" />
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                Generate from the description
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                AI finds the rubric you wrote, or drafts one, and splits your marks.
              </p>
            </button>
            <button
              type="button"
              onClick={addCriterion}
              className="text-left rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 p-4 transition"
            >
              <Plus className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                Add criteria yourself
              </p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                Optional, but students see what they're graded on.
              </p>
            </button>
          </div>
        )
      )}
    </div>
  );
};

export default RubricBuilder;
