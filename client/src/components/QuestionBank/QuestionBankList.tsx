import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import { QuestionBankApiService, QuizApiService } from "../../services/quizApi";
import QuestionBankModal from "./QuestionBankModal";
import DocxUploadModal from "./DocxUploadModal";
import QuestionPreviewModal from "../Quizzes/QuestionPreviewModal";
import RichTextDisplay from "../Common/RichTextDisplay";
import { CourseApiService } from "../../services/courseApi";
import type { Course } from "../../types/course.types";

import type {
  QuestionBankEntry,
  QuestionType,
  DifficultyLevel,
  BloomsTaxonomyLevel,
  SchemeOfWorkEntry,
} from "../../types/quiz.types";
import { toast } from "react-toastify";

// Question Types Map
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
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300"
    }`}
  >
    {children}
    {active && <Check className="w-3 h-3 ml-0.5" />}
  </button>
);

interface QuestionBankListProps {
  courseId: number;
}

const QuestionBankList: React.FC<QuestionBankListProps> = ({ courseId }) => {
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bloomsLevels, setBloomsLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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
  const [selectedQuestion, setSelectedQuestion] =
    useState<QuestionBankEntry | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] =
    useState<QuestionBankEntry | null>(null);

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
  const limit = 10;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [courseData, setCourseData] = useState<Course | null>(null);

  useEffect(() => {
    QuizApiService.getBloomsTaxonomyLevels()
      .then((res) => setBloomsLevels(res.data))
      .catch(() => {});

    // Fetch course details first to get required IDs
    CourseApiService.getCourse(courseId)
      .then((res) => {
        if (res.success) {
          setCourseData(res.data);
        }
        console.log({ courseDetails: res.data });
      })
      .catch((error) => {
        console.log({ error });
      });
  }, [courseId]);

  useEffect(() => {
    if (courseData?.class_group_id && courseData?.academic_term_id) {
      // Fetch scheme entries for the course
      setIsLoadingScheme(true);
      QuestionBankApiService.getSchemeOfWorkEntries(
        courseId,
        courseData.class_group_id,
        courseData.academic_term_id,
      )
        .then((res) => {
          if (res.success) {
            setSchemeEntries(res.data);
          }
        })
        .finally(() => setIsLoadingScheme(false));
    }
  }, [courseId, courseData]);

  const fetchQuestions = useCallback(async () => {
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
      setQuestions(response.data);
      setTotalQuestions(response.count);
      setTotalPages(response.total_pages);
    } catch (err) {
      console.error("Failed to load questions", err);
      toast.error("Failed to load question bank");
    } finally {
      setLoading(false);
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
    debounceRef.current = setTimeout(() => {
      fetchQuestions();
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuestions]);

  const handleDelete = async (id: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this question? It cannot be deleted if it is assigned to any quizzes.",
      )
    ) {
      try {
        await QuestionBankApiService.deleteCourseQuestion(courseId, id);
        toast.success("Question deleted successfully");
        fetchQuestions();
      } catch (err: any) {
        toast.error(
          err.response?.data?.message ||
            "Cannot delete question. It might be assigned to a quiz.",
        );
      }
    }
  };

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
    setIsModalOpen(true);
  };
  const handlePreview = (question: QuestionBankEntry) => {
    setPreviewQuestion(question);
    setIsPreviewOpen(true);
  };

  return (
    <>
      <div className="bg-white/90 dark:bg-gray-900/50 backdrop-blur-xl rounded-[1.6rem] border border-gray-200/60 dark:border-gray-800/30 overflow-hidden ">
        {/* Header & Controls */}
        <div className="p-5 border-b border-gray-200/60 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {courseData && (
              <div className="flex items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {courseData.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 px-1.5 py-0.5 bg-blue-100/50 dark:bg-blue-900/50 rounded-md">
                      {courseData.code}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Group:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Questions List
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-400/60 font-light">
                Manage all questions in the bank for this course.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${
                showFilters
                  ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800"
                  : "bg-white text-gray-700 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50"
              }`}
            >
              <Filter className="w-4 h-4" /> Filters{" "}
              {showFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            <button
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors border border-gray-200 dark:border-gray-700"
              onClick={() => setIsDocxModalOpen(true)}
            >
              <FileText className="w-4 h-4" /> Import from Word
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
          <div className="p-5 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 space-y-5">
            {/* Keyword Search */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Search className="w-3 h-3" /> Keyword Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search question text..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Question Types */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Types
                </label>
                <div className="flex flex-wrap gap-1.5 h-[110px] overflow-y-auto pr-2 scrollbar-thin">
                  {QUESTION_TYPES.map((qt) => (
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
                      <span>{qt.icon}</span> {qt.label}
                    </PillToggle>
                  ))}
                </div>
              </div>

              {/* Bloom's & Difficulty */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
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
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
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
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Scheme of Work Topics
                  </label>
                  {isLoadingScheme ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching
                      entries...
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
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400"
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
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
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
                  className="w-full max-w-xs px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Loading questions...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                No questions found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                We couldn't find any questions matching your current filters.
                Try adjusting your search criteria or adding a new question.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-800">
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
                  const typeIcon =
                    QUESTION_TYPES.find(
                      (t) => t.value === question.question_type,
                    )?.icon || "❓";
                  const diffObj = DIFFICULTY_LEVELS.find(
                    (d) => d.value === question.difficulty_level,
                  );

                  return (
                    <tr
                      key={question.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div
                          className="text-gray-900 dark:text-gray-100 line-clamp-2 max-w-xl"
                          title={question.question_text}
                        >
                          <RichTextDisplay
                            content={question.question_text || ""}
                          />
                        </div>
                        {question.explanation && (
                          <div className="mt-1 text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500"></span>{" "}
                            Has Explanation
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
                            {typeIcon}{" "}
                            {question.question_type.replace(/_/g, " ")}
                          </span>
                          {question.tags && question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {question.tags.slice(0, 1).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
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
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-800">
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 text-xs font-medium border border-gray-200 dark:border-gray-700/40">
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
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handlePreview(question)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Preview Question"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(question)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
                            title="Edit Question"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/30">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {(page - 1) * limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {Math.min(page * limit, totalQuestions)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-900 dark:text-white">
                {totalQuestions}
              </span>{" "}
              questions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Question CRUD Modal */}
      <QuestionBankModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        courseId={courseId}
        question={selectedQuestion}
        onSuccess={fetchQuestions}
      />

      <DocxUploadModal
        isOpen={isDocxModalOpen}
        onClose={() => setIsDocxModalOpen(false)}
        courseId={courseId}
        onSuccess={fetchQuestions}
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
