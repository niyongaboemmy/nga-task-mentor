import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  Filter,
  Zap,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  Plus,
  BookOpen,
  Cpu,
  Tag,
  BarChart2,
  Brain,
  RefreshCw,
  CheckSquare,
  Square,
  Sliders,
  FlaskConical,
  ListChecks,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import RichTextDisplay from "../Common/RichTextDisplay";
import { QuestionBankApiService } from "../../services/quizApi";

import QuestionBankModal from "../QuestionBank/QuestionBankModal";
import type {
  QuestionBankEntry,
  QuestionType,
  DifficultyLevel,
  BloomsTaxonomyLevel,
} from "../../types/quiz.types";
import { QuizApiService } from "../../services/quizApi";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AlgorithmConfig {
  question_types: QuestionType[];
  difficulty_levels: DifficultyLevel[];
  blooms_taxonomy_level_ids: number[];
  tags: string[];
  count: number; // how many questions to pull
  points_per_question: number;
  time_limit_seconds: number;
  is_required: boolean;
}

interface QuestionBankSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  quizId: number;
  /** Callback after all selected questions are assigned. */
  onQuestionsAssigned: () => void;
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: string }[] = [
  { value: "single_choice", label: "Single Choice", icon: "🔘" },
  { value: "multiple_choice", label: "Multiple Choice", icon: "☑️" },
  { value: "true_false", label: "True / False", icon: "✅" },
  { value: "fill_blank", label: "Fill in the Blank", icon: "📝" },
  { value: "matching", label: "Matching", icon: "🔗" },
  { value: "numerical", label: "Numerical", icon: "🔢" },
  { value: "short_answer", label: "Short Answer", icon: "💬" },
  { value: "coding", label: "Coding", icon: "💻" },
  { value: "algorithmic", label: "Algorithmic", icon: "⚙️" },
  { value: "logical_expression", label: "Logical Expression", icon: "🧩" },
  { value: "drag_drop", label: "Drag & Drop", icon: "🖐️" },
  { value: "ordering", label: "Ordering", icon: "🔡" },
  { value: "dropdown", label: "Dropdown", icon: "📋" },
];

const DIFFICULTY_LEVELS: {
  value: DifficultyLevel;
  label: string;
  color: string;
  dot: string;
}[] = [
  {
    value: "EASY",
    label: "Easy",
    color:
      "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    dot: "bg-green-500",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    color:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  {
    value: "DIFFICULT",
    label: "Difficult",
    color:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
    dot: "bg-red-500",
  },
];

const DEFAULT_CONFIG: AlgorithmConfig = {
  question_types: [],
  difficulty_levels: [],
  blooms_taxonomy_level_ids: [],
  tags: [],
  count: 10,
  points_per_question: 1,
  time_limit_seconds: 60,
  is_required: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Pill toggle button
// ─────────────────────────────────────────────────────────────────────────────
const PillToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}> = ({
  active,
  onClick,
  children,
  activeClass = "bg-blue-600 text-white border-blue-600 shadow-sm",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
      active
        ? activeClass
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
    }`}
  >
    {children}
    {active && <Check className="w-3 h-3 ml-0.5" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Question result card
// ─────────────────────────────────────────────────────────────────────────────
const QuestionResultCard: React.FC<{
  question: QuestionBankEntry;
  selected: boolean;
  onToggle: () => void;
  index: number;
}> = ({ question, selected, onToggle, index }) => {
  const diffBadge =
    question.difficulty_level === "EASY"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : question.difficulty_level === "MEDIUM"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : question.difficulty_level === "DIFFICULT"
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  const typeIcon =
    QUESTION_TYPES.find((t) => t.value === question.question_type)?.icon ||
    "❓";

  return (
    <div
      onClick={onToggle}
      className={`group relative flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
        selected
          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800"
          : "bg-white dark:bg-gray-900/60 border-gray-200 dark:border-gray-800/50 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
      }`}
    >
      {/* Checkbox */}
      <div
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
          selected
            ? "bg-blue-600 border-blue-600"
            : "border-gray-300 dark:border-gray-600 group-hover:border-blue-400"
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
            #{index + 1}
          </span>
          <span className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <span>{typeIcon}</span>
            {question.question_type.replace(/_/g, " ")}
          </span>
          {question.difficulty_level && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${diffBadge}`}
            >
              {question.difficulty_level.charAt(0) +
                question.difficulty_level.slice(1).toLowerCase()}
            </span>
          )}
          {question.bloomsLevel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              L{question.bloomsLevel.level_order} · {question.bloomsLevel.name}
            </span>
          )}
        </div>

        <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed">
          <RichTextDisplay content={question.question_text || ""} />
        </p>

        {question.tags && question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {question.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900"
              >
                #{tag}
              </span>
            ))}
            {question.tags.length > 4 && (
              <span className="text-xs text-gray-400 dark:text-gray-500 self-center">
                +{question.tags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export const QuestionBankSelectorModal: React.FC<
  QuestionBankSelectorModalProps
> = ({ isOpen, onClose, courseId, quizId, onQuestionsAssigned }) => {
  const [config, setConfig] = useState<AlgorithmConfig>(DEFAULT_CONFIG);
  const [tagInput, setTagInput] = useState("");
  const [bloomsLevels, setBloomsLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [results, setResults] = useState<QuestionBankEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load Bloom's taxonomy levels once
  useEffect(() => {
    if (!isOpen) return;
    QuizApiService.getBloomsTaxonomyLevels()
      .then((res) => setBloomsLevels(res.data))
      .catch(() => {});
  }, [isOpen]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setConfig(DEFAULT_CONFIG);
      setResults([]);
      setSelectedIds(new Set());
      setHasSearched(false);
      setAssignError(null);
      setSearchText("");
      setTagInput("");
    }
  }, [isOpen]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const updateConfig = useCallback(
    <K extends keyof AlgorithmConfig>(key: K, value: AlgorithmConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ── Search ────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async () => {
    setIsSearching(true);
    setHasSearched(true);
    setAssignError(null);
    try {
      const filters: any = {
        limit: Math.max(config.count * 2, 50), // fetch more than needed to allow manual selection
        page: 1,
      };
      if (config.question_types.length > 0)
        filters.question_type = config.question_types.join(",");
      if (config.difficulty_levels.length > 0)
        filters.difficulty_level = config.difficulty_levels.join(",");
      if (config.blooms_taxonomy_level_ids.length > 0)
        filters.blooms_taxonomy_level_id =
          config.blooms_taxonomy_level_ids.join(",");
      if (searchText.trim()) filters.search = searchText.trim();
      if (config.tags.length > 0) filters.tags = config.tags.join(",");

      const res = await QuestionBankApiService.getCourseQuestions(
        courseId,
        filters,
      );
      setResults(res.data);
      setTotalCount(res.count);

      // Auto-select top `count` if none selected yet
      if (selectedIds.size === 0 && res.data.length > 0) {
        const autoSelect = new Set(
          res.data.slice(0, config.count).map((q) => q.id),
        );
        setSelectedIds(autoSelect);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, [config, courseId, searchText, selectedIds.size]);

  // Debounced auto-search when search text changes
  useEffect(() => {
    if (!isOpen || !hasSearched) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleQuestion = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(results.map((q) => q.id)));

  const selectNone = () => setSelectedIds(new Set());

  const selectTopN = (n: number) => {
    const top = results.slice(0, n).map((q) => q.id);
    setSelectedIds(new Set(top));
  };

  const allSelected = results.length > 0 && selectedIds.size === results.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  // ── Assign ────────────────────────────────────────────────────────────────

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setIsAssigning(true);
    setAssignError(null);

    const selectedQuestions = results.filter((q) => selectedIds.has(q.id));
    let failed = 0;

    for (const q of selectedQuestions) {
      try {
        await QuestionBankApiService.addQuestionToQuiz(quizId, q.id, {
          points: config.points_per_question,
          time_limit_seconds: config.time_limit_seconds,
          is_required: config.is_required,
        });
      } catch (err: any) {
        failed++;
        console.error(`Failed to assign question ${q.id}:`, err);
      }
    }

    setIsAssigning(false);

    if (failed === 0) {
      onQuestionsAssigned();
      onClose();
    } else {
      setAssignError(
        `${failed} question${failed === 1 ? "" : "s"} failed to assign. The rest were added successfully.`,
      );
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !config.tags.includes(tag)) {
      updateConfig("tags", [...config.tags, tag]);
    }
    setTagInput("");
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-7xl h-[95vh] bg-white dark:bg-gray-950 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-800/50 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                Question Algorithm Selector
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pull questions from the course bank using smart criteria or
                manual selection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 rounded-full text-sm font-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create New
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body: two-column layout ─────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: Algorithm Settings */}
          <div className="w-full sm:w-80 lg:w-96 flex-shrink-0 border-r border-gray-200 dark:border-gray-800/50 flex flex-col bg-gray-50/60 dark:bg-gray-900/60 overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Algorithm Settings
                  </span>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  {showFilters ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Collapse
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> Expand
                    </>
                  )}
                </button>
              </div>

              {showFilters && (
                <>
                  {/* ── Keyword Search ──────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      <Search className="inline w-3 h-3 mr-1" />
                      Keyword Search
                    </label>
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Search question text..."
                      className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* ── Question Types ──────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      <Cpu className="inline w-3 h-3 mr-1" />
                      Question Types{" "}
                      <span className="normal-case font-normal text-gray-400">
                        (any if none selected)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {QUESTION_TYPES.map((qt) => (
                        <PillToggle
                          key={qt.value}
                          active={config.question_types.includes(qt.value)}
                          onClick={() =>
                            updateConfig(
                              "question_types",
                              toggleInArray(config.question_types, qt.value),
                            )
                          }
                        >
                          <span>{qt.icon}</span> {qt.label}
                        </PillToggle>
                      ))}
                    </div>
                  </div>

                  {/* ── Difficulty ──────────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      <BarChart2 className="inline w-3 h-3 mr-1" />
                      Difficulty Level
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DIFFICULTY_LEVELS.map((d) => (
                        <PillToggle
                          key={d.value}
                          active={config.difficulty_levels.includes(d.value)}
                          activeClass={`${d.color} border shadow-sm`}
                          onClick={() =>
                            updateConfig(
                              "difficulty_levels",
                              toggleInArray(config.difficulty_levels, d.value),
                            )
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${d.dot} flex-shrink-0`}
                          />
                          {d.label}
                        </PillToggle>
                      ))}
                    </div>
                  </div>

                  {/* ── Bloom's Taxonomy ────────────────────────────── */}
                  {bloomsLevels.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                        <Brain className="inline w-3 h-3 mr-1" />
                        Bloom's Taxonomy Level
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {bloomsLevels.map((bl) => (
                          <PillToggle
                            key={bl.id}
                            active={config.blooms_taxonomy_level_ids.includes(
                              bl.id,
                            )}
                            activeClass="bg-violet-600 text-white border-violet-600 shadow-sm"
                            onClick={() =>
                              updateConfig(
                                "blooms_taxonomy_level_ids",
                                toggleInArray(
                                  config.blooms_taxonomy_level_ids,
                                  bl.id,
                                ),
                              )
                            }
                          >
                            <span className="font-mono text-xs">
                              L{bl.level_order}
                            </span>{" "}
                            {bl.name}
                          </PillToggle>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Tags ────────────────────────────────────────── */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      <Tag className="inline w-3 h-3 mr-1" />
                      Tags Filter
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Type tag and press Enter..."
                        className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {config.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {config.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-xs border border-blue-100 dark:border-blue-900"
                          >
                            #{tag}
                            <button
                              onClick={() =>
                                updateConfig(
                                  "tags",
                                  config.tags.filter((t) => t !== tag),
                                )
                              }
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Assignment Settings ─────────────────────────────────── */}
              <div className="pt-1 border-t border-gray-200 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Assignment Settings
                  </span>
                </div>

                {/* Count */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Target question count
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateConfig("count", Math.max(1, config.count - 1))
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={config.count}
                      onChange={(e) =>
                        updateConfig(
                          "count",
                          Math.max(1, parseInt(e.target.value) || 1),
                        )
                      }
                      className="w-16 text-center px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => updateConfig("count", config.count + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-gray-400">questions</span>
                  </div>
                </div>

                {/* Points per question */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Points per question
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={config.points_per_question}
                    onChange={(e) =>
                      updateConfig(
                        "points_per_question",
                        parseFloat(e.target.value) || 1,
                      )
                    }
                    className="w-24 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Time limit */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Time limit per question (seconds)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={config.time_limit_seconds}
                    onChange={(e) =>
                      updateConfig(
                        "time_limit_seconds",
                        parseInt(e.target.value) || 60,
                      )
                    }
                    className="w-28 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Required */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig("is_required", !config.is_required)
                    }
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                      config.is_required
                        ? "bg-blue-600 border-blue-600"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {config.is_required && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Mark questions as required
                  </span>
                </div>
              </div>

              {/* Run Search Button */}
              <button
                onClick={runSearch}
                disabled={isSearching}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Run Algorithm Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: Search Results */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Results toolbar */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-800/50 bg-white dark:bg-gray-900/80">
              {hasSearched && !isSearching && (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <BookOpen className="w-4 h-4" />
                    <span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {results.length}
                      </span>{" "}
                      results
                      {totalCount > results.length && (
                        <span className="ml-1 text-xs">
                          of {totalCount} total
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />

                  {/* Select controls */}
                  <button
                    onClick={allSelected ? selectNone : selectAll}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : someSelected ? (
                      <Minus className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    {allSelected ? "Deselect all" : "Select all"}
                  </button>

                  {config.count > 0 && results.length > 0 && (
                    <button
                      onClick={() => selectTopN(config.count)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Top {Math.min(config.count, results.length)}
                    </button>
                  )}

                  <button
                    onClick={runSearch}
                    className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </>
              )}

              {!hasSearched && !isSearching && (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Configure your algorithm settings and click "Run Algorithm
                  Search"
                </p>
              )}
              {isSearching && (
                <p className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching question bank...
                </p>
              )}
            </div>

            {/* Selected count badge */}
            {selectedIds.size > 0 && (
              <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  {selectedIds.size} question{selectedIds.size === 1 ? "" : "s"}{" "}
                  selected
                  {selectedIds.size > 0 && (
                    <span className="ml-1 font-normal text-blue-500 dark:text-blue-400">
                      ·{" "}
                      {(selectedIds.size * config.points_per_question).toFixed(
                        1,
                      )}{" "}
                      total points
                    </span>
                  )}
                </span>
                <button
                  onClick={selectNone}
                  className="ml-auto text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Results list */}
            <div className="flex-1 overflow-y-auto">
              {!hasSearched && !isSearching && (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-5 shadow-inner">
                    <FlaskConical className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Ready to search
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                    Set your algorithm filters on the left to retrieve matching
                    questions from the course bank, then review and select.
                  </p>
                  <button
                    onClick={runSearch}
                    className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                  >
                    <Zap className="w-4 h-4" />
                    Run Algorithm Now
                  </button>
                </div>
              )}

              {hasSearched && !isSearching && results.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    No questions found
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Try adjusting your filters or broadening the search
                    criteria.
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <div className="p-4 space-y-3">
                  {results.map((question, idx) => (
                    <QuestionResultCard
                      key={question.id}
                      question={question}
                      index={idx}
                      selected={selectedIds.has(question.id)}
                      onToggle={() => toggleQuestion(question.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.size === 0 ? (
              "Select questions from the results to assign"
            ) : (
              <span className="text-gray-900 dark:text-white">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {selectedIds.size}
                </span>{" "}
                question{selectedIds.size === 1 ? "" : "s"} ·{" "}
                {(selectedIds.size * config.points_per_question).toFixed(1)} pts
                total ·{" "}
                {Math.round(
                  (selectedIds.size * config.time_limit_seconds) / 60,
                )}{" "}
                min est.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {assignError && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 max-w-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{assignError}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || isAssigning}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Assigning…
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4" /> Assign{" "}
                  {selectedIds.size > 0 ? selectedIds.size : ""} to Quiz
                </>
              )}
            </button>
          </div>
        </div>

        {createModalOpen && (
          <QuestionBankModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            courseId={courseId}
            quizId={quizId}
            onSuccess={() => {
              runSearch();
              onQuestionsAssigned();
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default QuestionBankSelectorModal;
