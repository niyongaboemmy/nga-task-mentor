import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Save,
  Loader2,
  Brain,
  Tag,
  BarChart2,
  Cpu,
  FileText,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  Clock,
  Search,
  BookOpen,
} from "lucide-react";
import { QuestionBankApiService, QuizApiService } from "../../services/quizApi";
import type {
  QuestionBankEntry,
  QuestionType,
  DifficultyLevel,
  BloomsTaxonomyLevel,
  CreateCourseQuestionRequest,
  QuestionDataType,
  SchemeOfWorkEntry,
} from "../../types/quiz.types";
import { CourseApiService } from "../../services/courseApi";
import type { Course } from "../../types/course.types";
import { toast } from "react-toastify";
import * as QuestionForms from "../Quizzes/QuestionForms";
import RichEditor from "../ui/RichEditor";

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: number;
  question?: QuestionBankEntry | null; // If provided, we are in Edit mode
  onSuccess: () => void;
  quizId?: number; // Optional: If provided, newly created questions will be assigned to this quiz
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
  dot: string;
}[] = [
  { value: "EASY", label: "Easy", dot: "bg-green-500" },
  { value: "MEDIUM", label: "Medium", dot: "bg-amber-500" },
  { value: "DIFFICULT", label: "Difficult", dot: "bg-red-500" },
];

const INITIAL_FORM_STATE: CreateCourseQuestionRequest = {
  question_type: "single_choice",
  question_text: "",
  question_data: { options: ["", ""], correct_option_index: 0 },
  difficulty_level: "MEDIUM",
  blooms_taxonomy_level_id: null,
  tags: [],
  explanation: "",
  attachments: null,
  time_limit_seconds: 60,
  scheme_of_work_entry_id: null,
  scheme_of_work_entry_title: null,
};

const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  courseId,
  question,
  onSuccess,
  quizId,
}) => {
  const [formData, setFormData] =
    useState<CreateCourseQuestionRequest>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bloomsLevels, setBloomsLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [activeTab, setActiveTab] = useState<
    "general" | "content" | "advanced"
  >("general");
  const [tagInput, setTagInput] = useState("");
  const [schemeEntries, setSchemeEntries] = useState<SchemeOfWorkEntry[]>([]);
  const [schemeSearch, setSchemeSearch] = useState("");
  const [isLoadingScheme, setIsLoadingScheme] = useState(false);
  const [courseData, setCourseData] = useState<Course | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      QuizApiService.getBloomsTaxonomyLevels()
        .then((res) => setBloomsLevels(res.data))
        .catch(() => {});

      if (question) {
        setFormData({
          question_type: question.question_type,
          question_text: question.question_text,
          question_data: question.question_data,
          difficulty_level: question.difficulty_level || "MEDIUM",
          blooms_taxonomy_level_id: question.blooms_taxonomy_level_id || null,
          tags: question.tags || [],
          explanation: question.explanation || "",
          attachments: question.attachments || null,
          time_limit_seconds: question.time_limit_seconds || 60,
          scheme_of_work_entry_id: question.scheme_of_work_entry_id || null,
          scheme_of_work_entry_title:
            question.scheme_of_work_entry_title || null,
        });
      } else {
        setFormData(INITIAL_FORM_STATE);
      }
      setActiveTab("general");

      // Fetch course details
      CourseApiService.getCourse(courseId)
        .then((res) => {
          if (res.success) {
            setCourseData(res.data);
          }
          console.log({ courseDetails: res.data });
        })
        .catch(() => {});
    }
  }, [isOpen, question, courseId]);

  useEffect(() => {
    if (isOpen && courseData?.class_group_id && courseData?.academic_term_id) {
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
  }, [isOpen, courseId, courseData]);

  const handleTypeChange = (type: QuestionType) => {
    let defaultData: any = {};
    switch (type) {
      case "single_choice":
        defaultData = { options: ["", ""], correct_option_index: 0 };
        break;
      case "multiple_choice":
        defaultData = { options: ["", ""], correct_option_indices: [0] };
        break;
      case "true_false":
        defaultData = { correct_answer: true };
        break;
      case "short_answer":
        defaultData = { keywords: [] };
        break;
      case "coding":
        defaultData = { language: "javascript", test_cases: [] };
        break;
      case "algorithmic":
        defaultData = { algorithm_description: "", test_cases: [] };
        break;
      case "fill_blank":
        defaultData = { text_with_blanks: "", acceptable_answers: [] };
        break;
      case "matching":
        defaultData = { left_items: [], right_items: [], correct_matches: {} };
        break;
      case "ordering":
        defaultData = { items: [] };
        break;
      case "dropdown":
        defaultData = { text_with_dropdowns: "", dropdown_options: [] };
        break;
      case "numerical":
        defaultData = { correct_answer: 0 };
        break;
      case "logical_expression":
        defaultData = { correct_expression: "", variables: [] };
        break;
      case "drag_drop":
        defaultData = { drop_zones: [], draggable_items: [] };
        break;
    }
    setFormData((prev) => ({
      ...prev,
      question_type: type,
      question_data: defaultData,
    }));
  };

  const handleSave = async () => {
    if (!formData.question_text.trim()) {
      toast.error("Question text is required");
      setActiveTab("general");
      return;
    }

    setIsSubmitting(true);
    try {
      if (question) {
        await QuestionBankApiService.updateCourseQuestion(
          courseId,
          question.id,
          formData,
        );
        toast.success("Question updated successfully");
      } else {
        const res = await QuestionBankApiService.createCourseQuestion(
          courseId,
          formData,
        );

        if (quizId) {
          await QuestionBankApiService.addQuestionToQuiz(quizId, res.data.id, {
            points: 1,
            time_limit_seconds: formData.time_limit_seconds || 60,
            is_required: true,
          });
          toast.success("Question created and added to quiz");
        } else {
          toast.success("Question created successfully");
        }
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0] ||
        "Failed to save question";
      toast.error(errorMsg);
      console.error("Save question error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), tag] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((t) => t !== tag),
    }));
  };

  if (!isOpen) return null;

  const renderQuestionForm = () => {
    const props = {
      data: formData.question_data,
      onChange: (data: QuestionDataType) =>
        setFormData((prev) => ({ ...prev, question_data: data })),
    };

    switch (formData.question_type) {
      case "single_choice":
        return <QuestionForms.SingleChoiceQuestionForm {...(props as any)} />;
      case "multiple_choice":
        return <QuestionForms.MultipleChoiceQuestionForm {...(props as any)} />;
      case "true_false":
        return <QuestionForms.TrueFalseQuestionForm {...(props as any)} />;
      case "short_answer":
        return <QuestionForms.ShortAnswerQuestionForm {...(props as any)} />;
      case "fill_blank":
        return <QuestionForms.FillBlankQuestionForm {...(props as any)} />;
      case "coding":
        return <QuestionForms.CodingQuestionForm {...(props as any)} />;
      case "algorithmic":
        return <QuestionForms.AlgorithmicQuestionForm {...(props as any)} />;
      case "matching":
        return <QuestionForms.MatchingQuestionForm {...(props as any)} />;
      case "ordering":
        return <QuestionForms.OrderingQuestionForm {...(props as any)} />;
      case "dropdown":
        return <QuestionForms.DropdownQuestionForm {...(props as any)} />;
      case "numerical":
        return <QuestionForms.NumericalQuestionForm {...(props as any)} />;
      case "logical_expression":
        return (
          <QuestionForms.LogicalExpressionQuestionForm {...(props as any)} />
        );
      case "drag_drop":
        return <QuestionForms.DragDropQuestionForm {...(props as any)} />;
      default:
        return (
          <div className="p-4 text-center text-gray-500 italic">
            Form for {formData.question_type} is under development
          </div>
        );
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          ref={modalRef}
          className="relative z-10 w-full max-w-7xl max-h-[95vh] bg-white dark:bg-gray-950 rounded-3xl shadow-2xl border border-gray-200/80 dark:border-gray-800/50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                {question ? (
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                  {question ? "Edit Question" : "Create Question"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {question
                    ? `ID: ${question.id}`
                    : "Add a new question to the course bank"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 flex px-6 border-b border-gray-100 dark:border-gray-800/50">
            {[
              { id: "general", label: "General Information", icon: FileText },
              { id: "content", label: "Question Content", icon: CheckCircle2 },
              { id: "advanced", label: "Advanced Options", icon: SlidersIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
            {activeTab === "general" ? (
              <div className="space-y-6 animate-in slide-in-from-left-2 duration-300">
                {/* Course Context Banner */}
                {courseData && (
                  <div className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 rounded-2xl">
                    <div className="flex items-center gap-3">
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
                            Class Group:{" "}
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                              {courseData.class_group_id || "Not assigned"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    {courseData.academic_term_id && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
                          Academic Term
                        </span>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                          ID: {courseData.academic_term_id}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Question Text */}
                <RichEditor
                  label="Question Prompt"
                  value={formData.question_text}
                  onChange={(value: string) =>
                    setFormData((prev) => ({
                      ...prev,
                      question_text: value,
                    }))
                  }
                  placeholder="Enter the main question text here..."
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Type Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <Cpu className="w-3.5 h-3.5 inline mr-1" /> Question Type
                    </label>
                    <select
                      value={formData.question_type}
                      onChange={(e) =>
                        handleTypeChange(e.target.value as QuestionType)
                      }
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <BarChart2 className="w-3.5 h-3.5 inline mr-1" />{" "}
                      Difficulty Level
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DIFFICULTY_LEVELS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              difficulty_level: d.value,
                            }))
                          }
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            formData.difficulty_level === d.value
                              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900"
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Limit */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="w-3.5 h-3.5 inline mr-1" /> Time Limit
                      (secs)
                    </label>
                    <input
                      type="number"
                      value={formData.time_limit_seconds || 60}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          time_limit_seconds: parseInt(e.target.value) || 60,
                        }))
                      }
                      min="10"
                      max="3600"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "content" ? (
              <div className="animate-in slide-in-from-right-2 duration-300">
                <div className="bg-gray-50/50 dark:bg-gray-900/40 rounded-3xl border border-gray-100 dark:border-gray-800/50 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {
                        QUESTION_TYPES.find(
                          (t) => t.value === formData.question_type,
                        )?.label
                      }{" "}
                      Data
                    </h3>
                  </div>
                  {renderQuestionForm()}
                </div>
              </div>
            ) : null}

            {activeTab === "advanced" ? (
              <div className="space-y-8 animate-in slide-in-from-right-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bloom's Taxonomy */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Brain className="w-3.5 h-3.5 inline mr-1" /> Bloom's
                      Taxonomy Level
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {bloomsLevels.map((bl) => (
                        <button
                          key={bl.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              blooms_taxonomy_level_id: bl.id,
                            }))
                          }
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all duration-200 ${
                            formData.blooms_taxonomy_level_id === bl.id
                              ? "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-900/30 dark:border-violet-800 dark:text-violet-400 ring-1 ring-violet-100 dark:ring-violet-900"
                              : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-violet-200 dark:hover:border-violet-900"
                          }`}
                        >
                          <span className="font-medium">{bl.name}</span>
                          <span className="text-[10px] font-mono opacity-60">
                            L{bl.level_order}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            blooms_taxonomy_level_id: null,
                          }))
                        }
                        className={`flex items-center justify-center px-4 py-2 rounded-xl border text-xs transition-all duration-200 ${
                          formData.blooms_taxonomy_level_id === null
                            ? "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                            : "bg-transparent border-gray-200 dark:border-gray-800 text-gray-500"
                        }`}
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>

                  {/* Scheme of Work Selection */}
                  <div>
                    <div className="space-y-4">
                      {/* Scheme Of Work Entry */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          <Brain className="w-3.5 h-3.5 inline mr-1" /> Scheme
                          of Work Topic
                        </label>
                        {isLoadingScheme ? (
                          <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                            <Loader2 className="w-3 h-3 animate-spin" />{" "}
                            Fetching entries...
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search entries..."
                                value={schemeSearch}
                                onChange={(e) =>
                                  setSchemeSearch(e.target.value)
                                }
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                              {schemeEntries
                                .filter((se) =>
                                  se.topic
                                    .toLowerCase()
                                    .includes(schemeSearch.toLowerCase()),
                                )
                                .map((se) => (
                                  <button
                                    key={se.entry_id}
                                    type="button"
                                    onClick={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        scheme_of_work_entry_id: se.entry_id,
                                        scheme_of_work_entry_title: se.topic,
                                      }));
                                    }}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 group ${
                                      formData.scheme_of_work_entry_id ===
                                      se.entry_id
                                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900"
                                        : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                                    }`}
                                  >
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                        formData.scheme_of_work_entry_id ===
                                        se.entry_id
                                          ? "bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300"
                                          : "bg-gray-50 dark:bg-gray-800 text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-500"
                                      }`}
                                    >
                                      <BookOpen className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">
                                        {se.topic}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5 opacity-60">
                                        <span className="text-[10px] font-mono">
                                          ID: {se.entry_id}
                                        </span>
                                      </div>
                                    </div>
                                    {formData.scheme_of_work_entry_id ===
                                      se.entry_id && (
                                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center animate-in zoom-in-50 duration-200">
                                        <CheckCircle2 className="w-3 h-3" />
                                      </div>
                                    )}
                                  </button>
                                ))}

                              {schemeEntries.filter((se) =>
                                se.topic
                                  .toLowerCase()
                                  .includes(schemeSearch.toLowerCase()),
                              ).length === 0 && (
                                <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                  <p className="text-sm text-gray-400">
                                    No matching topics found
                                  </p>
                                </div>
                              )}
                            </div>

                            {formData.scheme_of_work_entry_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    scheme_of_work_entry_id: null,
                                    scheme_of_work_entry_title: null,
                                  }))
                                }
                                className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center justify-center gap-1.5 transition-colors uppercase tracking-wider"
                              >
                                <X className="w-3 h-3" /> Clear Topic Selection
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {formData.scheme_of_work_entry_title && (
                        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                          <p className="text-[10px] text-blue-500 font-bold uppercase mb-0.5">
                            Currently Selected
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            {formData.scheme_of_work_entry_title}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <Tag className="w-3.5 h-3.5 inline mr-1" /> Categorization
                      Tags
                    </label>
                    <div className="space-y-4">
                      <div className="relative">
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
                          placeholder="Add a tag..."
                          className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={addTag}
                          className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(formData.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-100 dark:border-blue-800 shadow-sm"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <RichEditor
                    label="Explanation (Displayed after student completes attempt)"
                    value={formData.explanation || ""}
                    onChange={(value: string) =>
                      setFormData((prev) => ({
                        ...prev,
                        explanation: value,
                      }))
                    }
                    placeholder="Provide an explanation for the correct answer..."
                  />
                </div>

                {/* Attachments Placeholder */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Attachments
                  </label>
                  <div className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center justify-center text-gray-400">
                    <Paperclip className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      Attachment uploading is coming soon
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
            <div className="hidden sm:block">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                * Required fields. All changes will be saved to the course bank.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-blue-200 dark:shadow-none transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {question ? "Update Question" : "Create Question"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

const SlidersIcon = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </svg>
);

export default QuestionBankModal;
