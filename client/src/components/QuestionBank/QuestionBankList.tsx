import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Cpu,
  BarChart2,
  Brain,
  Tag,
  Loader2,
  FileText,
  Eye,
  Clock,
  BookOpen,
  Sparkles,
  Lock,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { QuestionBankApiService, QuizApiService } from "../../services/quizApi";
import QuestionBankModal from "./QuestionBankModal";
import DocxUploadModal from "./DocxUploadModal";
import AIGenerateModal from "./AIGenerateModal";
import QuestionPreviewModal from "../Quizzes/QuestionPreviewModal";
import RichTextDisplay from "../Common/RichTextDisplay";
import ConfirmDialog from "../ui/ConfirmDialog";
import type { Course } from "../../types/course.types";
import { useSchemeOfWork } from "../../contexts/SchemeOfWorkContext";
import { useCourseCache } from "../../contexts/CourseCacheContext";

import type {
  QuestionBankEntry,
  QuestionType,
  DifficultyLevel,
  BloomsTaxonomyLevel,
  SchemeOfWorkEntry,
} from "../../types/quiz.types";
import { toast } from "react-toastify";
import { getQuestionTypeIcon } from "./questionTypeIcons";
import { Skeleton, TopProgressBar, LoadingAnnouncer } from "../ui/Skeleton";
import { QuestionRowsSkeleton } from "./hub/QuestionBankHubSkeleton";
import Pagination from "../ui/Pagination";

const PAGE_SIZE_KEY = "tm.questionBank.pageSize";
const PAGE_SIZES = [10, 20, 50];
// Per-viewer convenience only; storage can be unavailable (private mode).
const loadPageSize = (): number => {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(n) ? n : 10;
  } catch {
    return 10;
  }
};

// Question Types Map
const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "single_choice", label: "Single Choice" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "fill_blank", label: "Fill in the Blank" },
  { value: "matching", label: "Matching" },
  { value: "numerical", label: "Numerical" },
  { value: "short_answer", label: "Short Answer" },
  { value: "coding", label: "Coding" },
  { value: "algorithmic", label: "Algorithmic" },
  { value: "logical_expression", label: "Logical Expression" },
  { value: "drag_drop", label: "Drag & Drop" },
  { value: "ordering", label: "Ordering" },
  { value: "dropdown", label: "Dropdown" },
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
      "bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/20",
    dot: "bg-green-500",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    color:
      "bg-amber-100 text-amber-700 dark:text-amber-400 dark:bg-amber-900/20",
    dot: "bg-amber-500",
  },
  {
    value: "DIFFICULT",
    label: "Difficult",
    color: "bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/20",
    dot: "bg-red-500",
  },
];

// Pill toggle button
const PillToggle: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeClass?: string;
}> = ({
  active,
  onClick,
  children,
  activeClass = "bg-blue-600 text-white border-blue-600 ",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 h-max rounded-2xl text-xs font-medium border transition-all duration-200 ${
      active
        ? activeClass
        : "bg-white dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark border-gray-200 dark:border-gray-700 hover:border-gray-300"
    }`}
  >
    {children}
    {active && <Check className="w-3 h-3 ml-0.5" />}
  </button>
);

interface QuestionBankListProps {
  courseId: number;
  /** Hide the subject card in the header (the host page already names it). */
  hideCourseCard?: boolean;
  /** Also drop the "Questions List" heading (the host page has its own). */
  hideHeading?: boolean;
  /** Called after a question is created, imported, edited or deleted. */
  onChanged?: () => void;
}

const QuestionBankList: React.FC<QuestionBankListProps> = ({
  courseId,
  hideCourseCard = false,
  hideHeading = false,
  onChanged,
}) => {
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  // First page not in yet -> skeleton rows; afterwards a refetch keeps the
  // current rows (dimmed, with a progress bar) so the table doesn't flash.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fetchSeq = useRef(0);
  const [bloomsLevels, setBloomsLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Use the scheme of work context for caching
  const { getEntries } = useSchemeOfWork();
  const { getCourse } = useCourseCache();

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<
    DifficultyLevel[]
  >([]);
  const [selectedBlooms, setSelectedBlooms] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocxModalOpen, setIsDocxModalOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] =
    useState<QuestionBankEntry | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] =
    useState<QuestionBankEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuestionBankEntry | null>(
    null,
  );

  // Scheme of Work Filter State
  const [schemeEntries, setSchemeEntries] = useState<SchemeOfWorkEntry[]>([]);
  const [selectedSchemeEntryIds, setSelectedSchemeEntryIds] = useState<
    number[]
  >([]);
  const [isLoadingScheme, setIsLoadingScheme] = useState(false);
  const [schemeSearch, setSchemeSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(loadPageSize);
  const cardRef = useRef<HTMLDivElement>(null);

  const changePageSize = (size: number) => {
    setLimit(size);
    setPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(size));
    } catch {
      /* not persisted -- fine */
    }
  };

  const goToPage = (next: number) => {
    setPage(next);
    // Bring the top of the list back into view when paging from the bottom.
    const top = cardRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [courseData, setCourseData] = useState<Course | null>(null);

  useEffect(() => {
    QuizApiService.getBloomsTaxonomyLevels()
      .then((res) => setBloomsLevels(res.data))
      .catch(() => {});

    // Fetch course details using cache
    getCourse(courseId)
      .then((data) => {
        if (data) {
          setCourseData(data);
        }
      })
      .catch((error) => {
        console.log({ error });
      });
  }, [courseId, getCourse]);

  useEffect(() => {
    if (courseData?.class_group_id && courseData?.academic_term_id) {
      // Use context to get cached scheme entries
      setIsLoadingScheme(true);
      getEntries(
        courseId,
        courseData.class_group_id,
        courseData.academic_term_id,
      )
        .then((entries) => {
          setSchemeEntries(entries);
        })
        .finally(() => setIsLoadingScheme(false));
    }
  }, [courseId, courseData, getEntries]);

  const fetchQuestions = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const filters: any = { page, limit };
      if (search.trim()) filters.search = search.trim();
      if (selectedTypes.length > 0)
        filters.question_type = selectedTypes.join(",");
      if (selectedDifficulties.length > 0)
        filters.difficulty_level = selectedDifficulties.join(",");
      if (selectedBlooms.length > 0)
        filters.blooms_taxonomy_level_id = selectedBlooms.join(",");
      if (selectedTags.length > 0) filters.tags = selectedTags.join(",");
      if (selectedSchemeEntryIds.length > 0)
        filters.scheme_of_work_entry_id = selectedSchemeEntryIds.join(",");

      const response = await QuestionBankApiService.getCourseQuestions(
        courseId,
        filters,
      );
      if (seq !== fetchSeq.current) return;
      setQuestions(response.data);
      setTotalQuestions(response.count);
      setTotalPages(response.total_pages);
      setHasLoaded(true);
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      console.error("Failed to load questions", err);
      toast.error("Failed to load question bank");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [
    courseId,
    page,
    search,
    selectedTypes,
    selectedDifficulties,
    selectedBlooms,
    selectedTags,
    selectedSchemeEntryIds,
  ]);

  // Fetch when filters or page change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Show the loading state straight away, not only after the debounce.
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchQuestions();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuestions]);

  const handleChanged = () => {
    fetchQuestions();
    onChanged?.();
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    setDeletingId(target.id);
    try {
      await QuestionBankApiService.deleteCourseQuestion(courseId, target.id);
      toast.success("Question deleted");
      // Stepping back keeps the user on a non-empty page after deleting the last row.
      if (questions.length === 1 && page > 1) setPage(page - 1);
      handleChanged();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Cannot delete question. It might be assigned to a quiz.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const activeFilterCount =
    selectedTypes.length +
    selectedDifficulties.length +
    selectedBlooms.length +
    selectedTags.length +
    selectedSchemeEntryIds.length;

  const clearFilters = () => {
    setSearch("");
    setSelectedTypes([]);
    setSelectedDifficulties([]);
    setSelectedBlooms([]);
    setSelectedTags([]);
    setSelectedSchemeEntryIds([]);
    setPage(1);
  };

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...selectedTypes.map((t) => ({
      key: `type-${t}`,
      label: QUESTION_TYPES.find((q) => q.value === t)?.label ?? t,
      onRemove: () => {
        setSelectedTypes(selectedTypes.filter((x) => x !== t));
        setPage(1);
      },
    })),
    ...selectedDifficulties.map((d) => ({
      key: `diff-${d}`,
      label: DIFFICULTY_LEVELS.find((x) => x.value === d)?.label ?? d,
      onRemove: () => {
        setSelectedDifficulties(selectedDifficulties.filter((x) => x !== d));
        setPage(1);
      },
    })),
    ...selectedBlooms.map((id) => {
      const bl = bloomsLevels.find((b) => b.id === id);
      return {
        key: `blooms-${id}`,
        label: bl ? `L${bl.level_order} ${bl.name}` : `Bloom's #${id}`,
        onRemove: () => {
          setSelectedBlooms(selectedBlooms.filter((x) => x !== id));
          setPage(1);
        },
      };
    }),
    ...selectedSchemeEntryIds.map((id) => ({
      key: `sow-${id}`,
      label: schemeEntries.find((e) => e.entry_id === id)?.topic ?? `Topic #${id}`,
      onRemove: () => {
        setSelectedSchemeEntryIds(selectedSchemeEntryIds.filter((x) => x !== id));
        setPage(1);
      },
    })),
    ...selectedTags.map((t) => ({
      key: `tag-${t}`,
      label: `#${t}`,
      onRemove: () => {
        setSelectedTags(selectedTags.filter((x) => x !== t));
        setPage(1);
      },
    })),
  ];

  const toggleInArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setTagInput("");
  };

  const handleEdit = (question: QuestionBankEntry) => {
    setSelectedQuestion(question);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedQuestion(null);
    setIsModalOpen(true);
  };
  const handlePreview = (question: QuestionBankEntry) => {
    setPreviewQuestion(question);
    setIsPreviewOpen(true);
  };

  return (
    <>
      <div
        ref={cardRef}
        className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 overflow-hidden scroll-mt-4"
      >
        {/* Header & Controls */}
        <div className="p-5 border-b border-gray-200/60 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {!courseData && !hideCourseCard && (
              <div className="flex items-center gap-3 rounded-2xl border border-blue-100/50 p-3 dark:border-blue-800/30">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-44" />
                  <Skeleton className="h-2.5 w-28" />
                </div>
              </div>
            )}
            {courseData && !hideCourseCard && (
              <div className="flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark leading-tight">
                    {courseData.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-100/50 dark:bg-blue-900/50 rounded-md">
                      {courseData.code}
                    </span>
                    <span className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark/70">
                      Group:{" "}
                      <span className="font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                        {courseData.class_group_id || "N/A"}
                      </span>
                    </span>
                    {courseData.academic_term_id && (
                      <span className="text-[11px] text-gray-400">
                        Term:{" "}
                        <span className="font-semibold">
                          {courseData.academic_term_id}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div>
              {!hideHeading && (
                <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">
                  Questions List
                </h2>
              )}
              <div
                className={`text-slate-600 dark:text-slate-300 ${hideHeading ? "text-sm font-medium" : "text-sm"}`}
                aria-live="polite"
              >
                {loading && !hasLoaded ? (
                  <Skeleton className="mt-1 h-3.5 w-36" />
                ) : loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" /> Updating…
                  </span>
                ) : `${totalQuestions} question${totalQuestions === 1 ? "" : "s"}${
                      activeFilterCount > 0 || search.trim() ? " match your filters" : " in this bank"
                    }`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search questions or tags…"
                aria-label="Search questions"
                className="w-64 max-w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-text-primary-light placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700/50 dark:bg-gray-800/50 dark:text-text-primary-dark dark:placeholder-slate-400"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                showFilters
                  ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800"
                  : "bg-white text-gray-700 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50"
              }`}
            >
              <Filter className="w-4 h-4" /> Filters{" "}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 bg-surface-light hover:bg-gray-200 dark:bg-surface-dark dark:hover:bg-gray-700 text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium rounded-xl transition-colors border border-transparent"
              onClick={() => setIsDocxModalOpen(true)}
              title="Import questions from a Word or Excel file"
            >
              <FileText className="w-4 h-4" /> Import
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
              onClick={() => setIsAIGenerateOpen(true)}
              data-track="tm.ai_generator.open"
            >
              <Sparkles className="w-4 h-4" /> AI Generate
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors "
              onClick={handleAdd}
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="p-5 bg-surface-light dark:bg-surface-dark/30 border-b border-border-light dark:border-border-dark/30 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Question Types */}
              <div>
                <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Types
                </label>
                <div className="flex flex-wrap gap-1.5 h-[110px] overflow-y-auto pr-2 scrollbar-thin">
                  {QUESTION_TYPES.map((qt) => {
                    const TypeIcon = getQuestionTypeIcon(qt.value);
                    return (
                      <PillToggle
                        key={qt.value}
                        active={selectedTypes.includes(qt.value)}
                        onClick={() => {
                          setSelectedTypes(
                            toggleInArray(selectedTypes, qt.value),
                          );
                          setPage(1);
                        }}
                      >
                        <TypeIcon className="w-3.5 h-3.5" /> {qt.label}
                      </PillToggle>
                    );
                  })}
                </div>
              </div>

              {/* Bloom's & Difficulty */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" /> Difficulty
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTY_LEVELS.map((d) => (
                      <PillToggle
                        key={d.value}
                        active={selectedDifficulties.includes(d.value)}
                        activeClass={`${d.color} border  dark:bg-opacity-20`}
                        onClick={() => {
                          setSelectedDifficulties(
                            toggleInArray(selectedDifficulties, d.value),
                          );
                          setPage(1);
                        }}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${d.dot} flex-shrink-0`}
                        />
                        {d.label}
                      </PillToggle>
                    ))}
                  </div>
                </div>

                {bloomsLevels.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Bloom's Level
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {bloomsLevels.map((bl) => (
                        <PillToggle
                          key={bl.id}
                          active={selectedBlooms.includes(bl.id)}
                          activeClass="bg-blue-600 text-white border-blue-600 "
                          onClick={() => {
                            setSelectedBlooms(
                              toggleInArray(selectedBlooms, bl.id),
                            );
                            setPage(1);
                          }}
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
              </div>

              {/* Scheme of Work Filter */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Scheme of Work Topics
                  </label>
                  {isLoadingScheme ? (
                    <div className="space-y-3" aria-busy="true" aria-label="Loading scheme of work topics">
                      <Skeleton className="h-7 w-full rounded-lg" />
                      <div className="flex flex-wrap gap-1.5">
                        {[64, 96, 80, 120, 72, 104].map((w, i) => (
                          <Skeleton key={i} className="h-7 rounded-2xl" style={{ width: w }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter scheme..."
                          value={schemeSearch}
                          onChange={(e) => setSchemeSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-transparent bg-surface-light dark:bg-surface-dark/50 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-text-secondary-light dark:placeholder:text-text-secondary-dark/50"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-2 scrollbar-thin">
                        {schemeEntries
                          .filter((se) =>
                            se.topic
                              .toLowerCase()
                              .includes(schemeSearch.toLowerCase()),
                          )
                          .map((se) => (
                            <PillToggle
                              key={se.entry_id}
                              active={selectedSchemeEntryIds.includes(
                                se.entry_id,
                              )}
                              onClick={() => {
                                setSelectedSchemeEntryIds(
                                  toggleInArray(
                                    selectedSchemeEntryIds,
                                    se.entry_id,
                                  ),
                                );
                                setPage(1);
                              }}
                            >
                              {se.topic}
                            </PillToggle>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Tags Filter
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
                  className="w-full max-w-xs px-3 py-2 text-sm rounded-xl border border-transparent bg-surface-light dark:bg-surface-dark/50 text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs border border-blue-100 dark:border-blue-800"
                    >
                      #{tag}
                      <button
                        onClick={() => {
                          setSelectedTags(
                            selectedTags.filter((t) => t !== tag),
                          );
                          setPage(1);
                        }}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active filters */}
        {(activeChips.length > 0 || search.trim()) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border-light px-5 py-3 dark:border-border-dark/30">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Filtered by:</span>
            {search.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                “{search.trim()}”
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {activeChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                <span className="truncate">{c.label}</span>
                <button onClick={c.onRemove} aria-label={`Remove filter ${c.label}`} className="hover:text-red-500">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
            >
              <RotateCcw className="h-3 w-3" /> Clear all
            </button>
          </div>
        )}

        {/* Table */}
        <TopProgressBar active={loading && hasLoaded} label="Loading questions" />
        <LoadingAnnouncer loading={loading} message="Loading questions…" />
        <div
          className={`overflow-x-auto min-h-[300px] transition-opacity duration-200 ${
            loading && hasLoaded ? "opacity-60 pointer-events-none" : ""
          }`}
          aria-busy={loading}
        >
          {loading && !hasLoaded ? (
            <QuestionRowsSkeleton rows={limit > 8 ? 8 : limit} />
          ) : questions.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-surface-light dark:bg-surface-dark rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-text-primary-light dark:text-text-primary-dark mb-1">
                {activeFilterCount > 0 || search.trim()
                  ? "No questions match"
                  : "This bank is empty"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                {activeFilterCount > 0 || search.trim()
                  ? "Try removing a filter or searching for something else."
                  : "Add your first question, import a Word/Excel file, or let AI draft some from your notes."}
              </p>
              {activeFilterCount > 0 || search.trim() ? (
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-4 w-4" /> Clear filters
                </button>
              ) : (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={handleAdd}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" /> Add question
                  </button>
                  <button
                    onClick={() => setIsAIGenerateOpen(true)}
                    data-track="tm.ai_generator.open"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    <Sparkles className="h-4 w-4" /> AI Generate
                  </button>
                </div>
              )}
            </div>
          ) : questions.length === 0 ? (
            <QuestionRowsSkeleton rows={4} />
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-light dark:bg-surface-dark/50 text-text-secondary-light dark:text-text-secondary-dark font-medium border-b border-border-light dark:border-border-dark/30">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap lg:w-3/5">
                    Question Text
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">Type / Tags</th>
                  <th className="px-6 py-4 whitespace-nowrap text-center">
                    Duration
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">Taxonomy</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {questions.map((question) => {
                  const TypeIcon = getQuestionTypeIcon(question.question_type);
                  const diffObj = DIFFICULTY_LEVELS.find(
                    (d) => d.value === question.difficulty_level,
                  );

                  return (
                    <tr
                      key={question.id}
                      aria-busy={deletingId === question.id}
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-all duration-300 group ${
                        deletingId === question.id
                          ? "opacity-40 pointer-events-none bg-red-50/40 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div
                          className="text-text-primary-light dark:text-text-primary-dark line-clamp-2 max-w-xl"
                          title={question.question_text}
                        >
                          <RichTextDisplay
                            content={question.question_text || ""}
                          />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {question.explanation && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Has explanation
                            </span>
                          )}
                          {question.is_own && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <UserCheck className="w-3 h-3" /> Yours
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark truncate">
                            <TypeIcon className="w-3.5 h-3.5 shrink-0" />{" "}
                            {question.question_type.replace(/_/g, " ")}
                          </span>
                          {question.tags && question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {question.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2 py-0.5 bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark rounded-xl truncate"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {question.tags.length > 2 && (
                                <span className="text-[10px] text-gray-400">
                                  +{question.tags.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                          {question.scheme_of_work_entry_title && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-xl border border-blue-100 dark:border-blue-800">
                              <Brain className="w-2.5 h-2.5" />
                              <span
                                className="truncate max-w-[150px]"
                                title={question.scheme_of_work_entry_title}
                              >
                                {question.scheme_of_work_entry_title}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark text-xs font-medium border border-transparent">
                          <div>
                            <Clock className="w-3 h-3" />
                          </div>
                          <span className="truncate">
                            {(question.time_limit_seconds ?? 60) >= 60
                              ? `${Math.floor((question.time_limit_seconds ?? 60) / 60)}m ${(question.time_limit_seconds ?? 60) % 60}s`
                              : `${question.time_limit_seconds ?? 60}s`}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {diffObj ? (
                            <span
                              className={`inline-flex items-center w-max px-2 py-0.5 rounded-full text-xs font-medium ${diffObj.color}`}
                            >
                              {diffObj.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}

                          {question.bloomsLevel && (
                            <span className="inline-flex items-center w-max px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium border border-blue-100 dark:border-blue-800">
                              L{question.bloomsLevel.level_order}:{" "}
                              {question.bloomsLevel.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {deletingId === question.id ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
                          </span>
                        ) : (
                        <div className="flex items-center justify-end gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            onClick={() => handlePreview(question)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Preview question"
                            aria-label="Preview question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {question.can_manage === false ? (
                            <span
                              className="p-1.5 text-gray-400"
                              title="Added by a colleague: only they can edit or delete it"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(question)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                                title="Edit question"
                                aria-label="Edit question"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setPendingDelete(question)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Delete question"
                                aria-label="Delete question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalQuestions}
          pageSize={limit}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          pageSizeOptions={PAGE_SIZES}
          itemLabel={totalQuestions === 1 ? "question" : "questions"}
          busy={loading}
        />
      </div>

      {/* Question CRUD Modal */}
      <QuestionBankModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        courseId={courseId}
        question={selectedQuestion}
        onSuccess={handleChanged}
      />

      <DocxUploadModal
        isOpen={isDocxModalOpen}
        onClose={() => setIsDocxModalOpen(false)}
        courseId={courseId}
        onSuccess={handleChanged}
      />

      <AIGenerateModal
        isOpen={isAIGenerateOpen}
        onClose={() => setIsAIGenerateOpen(false)}
        courseId={courseId}
        onSuccess={handleChanged}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="Delete this question?"
        description="It will be removed from the bank for good. Questions already used in a quiz can't be deleted."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {isPreviewOpen && previewQuestion && (
        <QuestionPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          question={previewQuestion as any}
          questionNumber={1}
        />
      )}
    </>
  );
};

export default QuestionBankList;
