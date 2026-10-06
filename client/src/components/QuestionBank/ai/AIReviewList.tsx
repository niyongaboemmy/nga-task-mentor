import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Clock, Link2, Tag, Trash2 } from "lucide-react";
import QuizQuestion from "../../Quizzes/QuizQuestion";
import { QuestionServiceFactory } from "../../../services/questions/QuestionServiceFactory";
import type { DifficultyLevel, QuestionType, QuizQuestion as QuizQuestionType } from "../../../types/quiz.types";
import { getQuestionTypeIcon } from "../questionTypeIcons";
import {
  BLOOM_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_BLOOM_BANDS,
  isBloomAligned,
  nearestBloomInBand,
  typeLabel,
} from "./aiGeneratorModel";
import type { AIBloomLevel } from "../../../services/aiQuestionGenerationApi";
import Select from "../../ui/Select";

export interface ReviewQuestion {
  uid: string;
  question_type: QuestionType;
  question_text: string;
  question_data: Record<string, unknown>;
  correct_answer?: unknown;
  explanation?: string;
  difficulty_level: DifficultyLevel;
  tags?: string[];
  time_limit_seconds?: number;
  blooms_level?: number | null;
  blooms_taxonomy_level_id?: number | null;
  blooms_level_name?: string | null;
  blooms_adjusted?: boolean;
  selected: boolean;
  provider?: string;
}

interface Props {
  questions: ReviewQuestion[];
  onChange: (qs: ReviewQuestion[]) => void;
  /** The school's Bloom levels (id per level_order), from the generation meta. */
  bloomLevels?: AIBloomLevel[];
}

const AIReviewList: React.FC<Props> = ({ questions, onChange, bloomLevels = [] }) => {
  const [level, setLevel] = useState<DifficultyLevel | "ALL">("ALL");
  const [type, setType] = useState<QuestionType | "ALL">("ALL");
  const [bloom, setBloom] = useState<number | "ALL">("ALL");

  /** Level fields for a 1-6 order, using the school's own row when there is one. */
  const bloomFields = (order: number) => {
    const row = bloomLevels.find((l) => l.level_order === order);
    return {
      blooms_level: order,
      blooms_taxonomy_level_id: row?.id ?? null,
      blooms_level_name: row?.name ?? BLOOM_LEVELS[order - 1]?.name ?? null,
      blooms_adjusted: false,
    };
  };
  const bloomCounts = BLOOM_LEVELS.map((l) => ({ ...l, count: questions.filter((q) => q.blooms_level === l.order).length }));
  const [open, setOpen] = useState<Set<string>>(() => new Set(questions.slice(0, 2).map((q) => q.uid)));

  const types = useMemo(() => [...new Set(questions.map((q) => q.question_type))], [questions]);
  const visible = questions.filter(
    (q) =>
      (level === "ALL" || q.difficulty_level === level) &&
      (type === "ALL" || q.question_type === type) &&
      (bloom === "ALL" || q.blooms_level === bloom),
  );
  const selectedVisible = visible.filter((q) => q.selected).length;
  const update = (uid: string, patch: Partial<ReviewQuestion>) =>
    onChange(questions.map((q) => (q.uid === uid ? { ...q, ...patch } : q)));
  const setVisibleSelected = (on: boolean) => {
    const ids = new Set(visible.map((q) => q.uid));
    onChange(questions.map((q) => (ids.has(q.uid) ? { ...q, selected: on } : q)));
  };
  const toggleOpen = (uid: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Filter by difficulty">
          <LevelChip active={level === "ALL"} onClick={() => setLevel("ALL")} label="All" count={questions.length} />
          {DIFFICULTIES.map((d) => (
            <LevelChip
              key={d.value}
              active={level === d.value}
              onClick={() => setLevel(d.value)}
              label={d.label}
              dot={d.dot}
              count={questions.filter((q) => q.difficulty_level === d.value).length}
            />
          ))}
        </div>
        {types.length > 1 && (
          <Select size="sm" variant="outline"
            aria-label="Filter by type"
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType | "ALL")}
          >
            <option value="ALL">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </Select>
        )}
        <Select size="sm" variant="outline"
          aria-label="Filter by Bloom's level"
          value={bloom}
          onChange={(e) => setBloom(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
        >
          <option value="ALL">All Bloom's levels</option>
          {bloomCounts.filter((l) => l.count).map((l) => (
            <option key={l.order} value={l.order}>
              L{l.order} · {l.name} ({l.count})
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <button type="button" onClick={() => setVisibleSelected(selectedVisible < visible.length)} className="font-medium text-blue-600 dark:text-blue-300 hover:underline">
            {selectedVisible < visible.length ? "Select all" : "Select none"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((s) => (s.size >= visible.length ? new Set() : new Set(visible.map((q) => q.uid))))}
            className="font-medium text-gray-500 hover:underline"
          >
            {open.size >= visible.length ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {/* Bloom's spread */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="Bloom's taxonomy spread">
        <span className="font-semibold text-gray-500 mr-1">Bloom's:</span>
        {bloomCounts.map((l) => (
          <span
            key={l.order}
            title={l.name}
            className={`px-1.5 py-0.5 rounded-md border ${l.count ? l.chip : "border-gray-200 dark:border-gray-700 text-gray-400"}`}
          >
            L{l.order} {l.short} <b className="tabular-nums">{l.count}</b>
          </span>
        ))}
      </div>

      {/* Cards */}
      <ul className="space-y-2" aria-label="Generated questions">
        {visible.map((q) => {
          const idx = questions.indexOf(q);
          const Icon = getQuestionTypeIcon(q.question_type);
          const v = QuestionServiceFactory.validate(q.question_type, q.question_data);
          const isOpen = open.has(q.uid);
          return (
            <li
              key={q.uid}
              className={`rounded-2xl border transition-colors ${
                q.selected ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" : "border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 opacity-70"
              }`}
            >
              <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-2 p-3">
                <button
                  type="button"
                  aria-label={q.selected ? "Exclude question" : "Include question"}
                  aria-pressed={q.selected}
                  onClick={() => update(q.uid, { selected: !q.selected })}
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${
                    q.selected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {q.selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                </button>
                <button type="button" onClick={() => toggleOpen(q.uid)} className="flex-1 min-w-0 text-left" aria-expanded={isOpen}>
                  <span className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-mono text-gray-400">#{idx + 1}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <Icon className="w-3 h-3" /> {typeLabel(q.question_type)}
                    </span>
                    {q.time_limit_seconds && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                        <Clock className="w-3 h-3" /> {q.time_limit_seconds}s
                      </span>
                    )}
                    {(q.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-300">
                        <Tag className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    ))}
                    {q.blooms_level && !isBloomAligned(q.blooms_level, q.difficulty_level) && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600" title={`${DIFFICULTIES.find((d) => d.value === q.difficulty_level)?.label} usually means L${DIFFICULTY_BLOOM_BANDS[q.difficulty_level].join("–L")}`}>
                        <AlertTriangle className="w-3 h-3" /> L{q.blooms_level} is unusual for {q.difficulty_level.toLowerCase()}
                      </span>
                    )}
                    {v.errors.length + v.warnings.length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                        <AlertTriangle className="w-3 h-3" /> check
                      </span>
                    )}
                  </span>
                  <span className={`block text-sm text-text-primary-light dark:text-text-primary-dark ${isOpen ? "" : "line-clamp-2"}`}>
                    {q.question_text}
                  </span>
                </button>
                {/* Phones: controls get their own line under the text instead of squeezing it. */}
                <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto pl-8 sm:pl-0 sm:justify-end">
                  <Select size="sm" variant="bare"
                    aria-label="Bloom's level"
                    title={q.blooms_level ? BLOOM_LEVELS[q.blooms_level - 1]?.name : "Not classified"}
                    value={q.blooms_level ?? ""}
                    onChange={(e) => update(q.uid, bloomFields(Number(e.target.value)))}
                    triggerClassName={`!h-7 text-[11px] font-semibold ${
                      q.blooms_level ? BLOOM_LEVELS[q.blooms_level - 1]?.chip : "border-gray-200 text-gray-400"
                    }`}
                  >
                    {!q.blooms_level && <option value="">Bloom's…</option>}
                    {BLOOM_LEVELS.map((l) => (
                      <option key={l.order} value={l.order}>
                        L{l.order} · {l.short}
                      </option>
                    ))}
                  </Select>
                  <Select size="sm" variant="bare"
                    aria-label="Difficulty"
                    value={q.difficulty_level}
                    onChange={(e) => {
                      const d = e.target.value as DifficultyLevel;
                      // Keep the pair consistent: pull the Bloom's level into the new difficulty's band.
                      const patch: Partial<ReviewQuestion> = { difficulty_level: d };
                      if (!isBloomAligned(q.blooms_level, d)) Object.assign(patch, bloomFields(nearestBloomInBand(q.blooms_level, d)));
                      update(q.uid, patch);
                    }}
                    triggerClassName={`!h-7 text-[11px] font-semibold ${DIFFICULTIES.find((d) => d.value === q.difficulty_level)?.chip ?? ""}`}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    aria-label="Remove question"
                    onClick={() => onChange(questions.filter((x) => x.uid !== q.uid))}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label={isOpen ? "Collapse" : "Expand"} onClick={() => toggleOpen(q.uid)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600">
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 pl-11 space-y-2">
                  {[...v.errors, ...v.warnings].map((m, i) => (
                    <p key={i} className="text-xs flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/15 rounded-lg px-2 py-1">
                      <AlertTriangle className="w-3 h-3" /> {m}
                    </p>
                  ))}
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3">
                    <QuizQuestion
                      question={
                        {
                          id: idx,
                          question_type: q.question_type,
                          question_text: q.question_text,
                          question_data: q.question_data,
                          explanation: q.explanation,
                          difficulty_level: q.difficulty_level,
                          points: 1,
                          tags: q.tags || [],
                          questionBank: { time_limit_seconds: q.time_limit_seconds },
                        } as unknown as QuizQuestionType
                      }
                      answer={q.correct_answer as never}
                      onAnswerChange={() => {}}
                      disabled
                      showCorrectAnswer
                      showQuestionNumber={false}
                    />
                  </div>
                  {q.explanation && (
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                      <b>Why:</b> {q.explanation}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {!visible.length && <li className="text-center text-sm text-gray-400 py-8">No questions match these filters.</li>}
      </ul>
    </div>
  );
};

const LevelChip: React.FC<{ active: boolean; onClick: () => void; label: string; count: number; dot?: string }> = ({
  active,
  onClick,
  label,
  count,
  dot,
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      active ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
    }`}
  >
    {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
    {label} <span className="tabular-nums opacity-70">{count}</span>
  </button>
);

export const LinkToggle: React.FC<{ title: string; on: boolean; onChange: (v: boolean) => void }> = ({ title, on, onChange }) => (
  <label className="inline-flex items-center gap-2 text-xs text-text-secondary-light dark:text-text-secondary-dark cursor-pointer">
    <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
    <Link2 className="w-3.5 h-3.5" /> Link to scheme-of-work topic <b className="truncate max-w-[220px]">{title}</b>
  </label>
);

export default AIReviewList;
