import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ChevronLeft, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { AppDispatch } from "../../store";
import {
  createQuestion,
  fetchQuizQuestions,
  clearQuizError,
} from "../../store/slices/quizSlice";
import {
  DropdownQuestionForm,
  AlgorithmicQuestionForm,
  CodingQuestionForm,
  SingleChoiceQuestionForm,
  MultipleChoiceQuestionForm,
  TrueFalseQuestionForm,
  NumericalQuestionForm,
  FillBlankQuestionForm,
  ShortAnswerQuestionForm,
  MatchingQuestionForm,
  OrderingQuestionForm,
} from "./QuestionForms";
import type {
  CreateQuestionRequest,
  QuestionType,
  SingleChoiceData,
  MultipleChoiceData,
  TrueFalseData,
  NumericalData,
  MatchingData,
  OrderingData,
  DropdownData,
  AlgorithmicData,
  CodingData,
  BloomsTaxonomyLevel,
} from "../../types/quiz.types";
import { QuizApiService } from "../../services/quizApi";
import RichEditor from "../ui/RichEditor";

// Helper function to create typed question data
const createQuestionData = (type: QuestionType) => {
  switch (type) {
    case "single_choice":
      return { options: ["", ""] } as SingleChoiceData;
    case "multiple_choice":
      return {
        options: ["", ""],
        correct_option_indices: [],
      } as MultipleChoiceData;
    case "true_false":
      return { correct_answer: true } as TrueFalseData;
    case "numerical":
      return { correct_answer: 0 } as NumericalData;
    case "fill_blank":
      return {
        text_with_blanks: "",
        acceptable_answers: [{ blank_index: 0, answers: [""] }],
      } as any;
    case "short_answer":
      return { max_length: 500 } as any;
    case "matching":
      return {
        left_items: [
          { id: "1", text: "" },
          { id: "2", text: "" },
        ],
        right_items: [
          { id: "1", text: "" },
          { id: "2", text: "" },
        ],
        correct_matches: {},
      } as MatchingData;
    case "ordering":
      return {
        items: [
          { id: "1", text: "", order: 1 },
          { id: "2", text: "", order: 2 },
        ],
      } as OrderingData;
    case "drag_drop":
      return {
        drop_zones: [
          { id: "1", x: 0, y: 0, width: 100, height: 100, correct_items: [] },
        ],
        draggable_items: [{ id: "1", text: "", value: "" }],
      } as any;
    case "dropdown":
      return {
        text_with_dropdowns: "",
        dropdown_options: [{ dropdown_index: 0, options: ["", ""] }],
      } as DropdownData;
    case "algorithmic":
      return {
        algorithm_description: "",
        input_format: "",
        output_format: "",
        test_cases: [
          {
            id: "1",
            input: "",
            expected_output: "",
            is_hidden: false,
            points: 10,
          },
        ],
      } as AlgorithmicData;
    case "coding":
      return {
        language: "javascript",
        starter_code: "",
        test_cases: [
          {
            id: "1",
            input: "",
            expected_output: "",
            is_hidden: false,
            points: 10,
          },
        ],
      } as CodingData;
  }
};

interface CreateQuestionPageProps {
  quizId: number;
}

export const CreateQuestionPage: React.FC<CreateQuestionPageProps> = ({
  quizId,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const [loading, setLoading] = useState(false);
  const [bloomsLevels, setBloomsLevels] = useState<BloomsTaxonomyLevel[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CreateQuestionRequest>({
    question_type: "single_choice",
    question_text: "",
    question_data: createQuestionData("single_choice"),
    points: 1,
    order: 1,
    time_limit_seconds: 60,
    is_required: true,
    blooms_taxonomy_level_id: null,
    tags: [],
    difficulty_level: null,
  });

  useEffect(() => {
    QuizApiService.getBloomsTaxonomyLevels()
      .then((res) => setBloomsLevels(res.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) return;

    // Validate coding questions
    if (formData.question_type === "coding") {
      const codingData = getCodingData();
      const hasInvalidTestCases = codingData.test_cases.some(
        (testCase) =>
          !testCase.input.trim() || !testCase.expected_output.trim(),
      );

      if (hasInvalidTestCases) {
        const invalidCount = codingData.test_cases.filter(
          (testCase) =>
            !testCase.input.trim() || !testCase.expected_output.trim(),
        ).length;

        toast.error(
          `Please complete all test cases before submitting. ${invalidCount} test case(s) are empty or incomplete.`,
          {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          },
        );
        return;
      }
    }

    setLoading(true);
    dispatch(clearQuizError("questions"));

    try {
      await dispatch(
        createQuestion({
          quizId: quizId,
          questionData: formData,
        }),
      ).unwrap();

      toast.success("Question created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Refresh questions and navigate back
      dispatch(fetchQuizQuestions(quizId));
      navigate(`/quizzes/${quizId}`);
    } catch (error: any) {
      console.error("Failed to create question:", error);

      // Extract backend error message clearly
      let errorMessage = "Failed to create question. Please try again.";

      if (error?.response?.data?.message) {
        // Show the exact backend error message
        errorMessage = `Error: ${error.response.data.message}`;
      } else if (error?.response?.data?.error) {
        errorMessage = `Error: ${error.response.data.error}`;
      } else if (error?.message) {
        errorMessage = `Error: ${error.message}`;
      }

      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 6000, // Slightly longer for error messages
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        // Make error toast more prominent
        style: {
          backgroundColor: "#fee2e2",
          border: "1px solid #fca5a5",
          color: "#dc2626",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionDataChange = (data: typeof formData.question_data) => {
    setFormData((prev) => ({ ...prev, question_data: data }));
  };

  const getSingleChoiceData = () => formData.question_data as SingleChoiceData;
  const getMultipleChoiceData = () =>
    formData.question_data as MultipleChoiceData;
  const getTrueFalseData = () => formData.question_data as TrueFalseData;
  const getNumericalData = () => formData.question_data as NumericalData;
  const getFillBlankData = () => formData.question_data as any;
  const getShortAnswerData = () => formData.question_data as any;
  const getMatchingData = () => formData.question_data as MatchingData;
  const getOrderingData = () => formData.question_data as OrderingData;
  const getDropdownData = () => formData.question_data as DropdownData;
  const getAlgorithmicData = () => formData.question_data as AlgorithmicData;
  const getCodingData = () => formData.question_data as CodingData;

  const isStep1Valid = () => {
    if (!formData.question_text?.trim()) return false;
    if (!formData.time_limit_seconds || formData.time_limit_seconds < 10)
      return false;
    if (!formData.points || formData.points < 1) return false;
    return true;
  };

  const isStep2Valid = () => {
    if (formData.question_type === "coding") {
      const codingData = getCodingData();
      const hasInvalidTestCases = codingData.test_cases.some(
        (testCase: any) =>
          !testCase.input.trim() || !testCase.expected_output.trim(),
      );
      if (hasInvalidTestCases) return false;
    }
    return true;
  };

  const isFormValid = () => isStep1Valid() && isStep2Valid();

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid()) setCurrentStep(2);
    else if (currentStep === 2 && isStep2Valid()) setCurrentStep(3);
  };
  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderQuestionTypeFields = () => {
    switch (formData.question_type) {
      case "single_choice":
        return (
          <SingleChoiceQuestionForm
            data={getSingleChoiceData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "multiple_choice":
        return (
          <MultipleChoiceQuestionForm
            data={getMultipleChoiceData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "true_false":
        return (
          <TrueFalseQuestionForm
            data={getTrueFalseData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "numerical":
        return (
          <NumericalQuestionForm
            data={getNumericalData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "fill_blank":
        return (
          <FillBlankQuestionForm
            data={getFillBlankData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "short_answer":
        return (
          <ShortAnswerQuestionForm
            data={getShortAnswerData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "ordering":
        return (
          <OrderingQuestionForm
            data={getOrderingData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "matching":
        return (
          <MatchingQuestionForm
            data={getMatchingData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "dropdown":
        return (
          <DropdownQuestionForm
            data={getDropdownData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "algorithmic":
        return (
          <AlgorithmicQuestionForm
            data={getAlgorithmicData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "coding":
        return (
          <CodingQuestionForm
            data={getCodingData()}
            onChange={handleQuestionDataChange}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 md:p-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
              Create Question
            </h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              Configure your new quiz question step-by-step.
            </p>
          </div>
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel & Return
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full" />
            <div
              className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />

            {[
              { num: 1, label: "Basic Details" },
              { num: 2, label: "Configuration" },
              { num: 3, label: "Metadata" },
            ].map((step) => (
              <div
                key={step.num}
                className="relative z-10 flex flex-col items-center gap-2"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${
                    currentStep > step.num
                      ? "bg-blue-600 border-blue-600 text-white"
                      : currentStep === step.num
                        ? "bg-white dark:bg-gray-900 border-blue-600 text-blue-600 dark:text-blue-400"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400"
                  }`}
                >
                  {currentStep > step.num ? <Check size={18} /> : step.num}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    currentStep >= step.num
                      ? "text-text-primary-light dark:text-text-primary-dark"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* STEP 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Question Type */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-3">
                  1. Choose Question Type
                </label>
                <select
                  value={formData.question_type}
                  onChange={(e) => {
                    const newType = e.target.value as QuestionType;
                    setFormData((prev) => ({
                      ...prev,
                      question_type: newType,
                      question_data: createQuestionData(newType),
                    }));
                  }}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="single_choice">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True/False</option>
                  <option value="numerical">Numerical</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="matching">Matching</option>
                  <option value="ordering">Ordering</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="algorithmic">Algorithmic</option>
                  <option value="coding">Coding Workflow Workspace</option>
                </select>
              </div>

              {/* Question Text */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                  2. Question Prompt *
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Enter the main text or instructions for the student.
                </p>
                <RichEditor
                  label=""
                  value={formData.question_text || ""}
                  onChange={(value: string) =>
                    setFormData((prev) => ({ ...prev, question_text: value }))
                  }
                  placeholder="Type your question here..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Points */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Points Awarded
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        points: parseInt(e.target.value),
                      }))
                    }
                    min="1"
                    max="100"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Time Limit */}
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Time Limit (seconds) *
                  </label>
                  <input
                    type="number"
                    value={formData.time_limit_seconds}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        time_limit_seconds: parseInt(e.target.value),
                      }))
                    }
                    min="10"
                    max="3600"
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Between 10s and 3600s (1hr)
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                  Post-Answer Explanation (optional)
                </label>
                <textarea
                  value={formData.explanation || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      explanation: e.target.value,
                    }))
                  }
                  placeholder="Explain why the answer is correct..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Configuration */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-white dark:bg-gray-900 rounded-2xl">
                <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                  Configure specific details
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Set up the correct answers, choices, or workspace editors for
                  your{" "}
                  {(formData.question_type || "single_choice").replace(
                    "_",
                    " ",
                  )}{" "}
                  question.
                </p>

                {renderQuestionTypeFields()}

                {formData.question_type === "coding" && !isStep2Valid() && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 dark:text-red-400">⚠️</span>
                      <div className="text-sm text-red-800 dark:text-red-200">
                        <p className="font-medium">
                          Complete Test Cases Required
                        </p>
                        <p>
                          Please provide input and expected output for all test
                          cases.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Metadata */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-6">
                  Categorization & Metadata
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                      Bloom's Taxonomy Level
                    </label>
                    <select
                      value={formData.blooms_taxonomy_level_id ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          blooms_taxonomy_level_id: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Uncategorized —</option>
                      {bloomsLevels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.level_order}. {level.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={formData.difficulty_level ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          difficulty_level: (e.target.value as any) || null,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Uncategorized —</option>
                      <option value="EASY">🟢 Easy</option>
                      <option value="MEDIUM">🟡 Medium</option>
                      <option value="DIFFICULT">🔴 Difficult</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-2">
                    Tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Enter" || e.key === ",") &&
                          tagInput.trim()
                        ) {
                          e.preventDefault();
                          const newTag = tagInput.trim().toLowerCase();
                          if (!formData.tags?.includes(newTag)) {
                            setFormData((prev) => ({
                              ...prev,
                              tags: [...(prev.tags ?? []), newTag],
                            }));
                          }
                          setTagInput("");
                        }
                      }}
                      placeholder="Type a tag and press Enter"
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newTag = tagInput.trim().toLowerCase();
                        if (newTag && !formData.tags?.includes(newTag)) {
                          setFormData((prev) => ({
                            ...prev,
                            tags: [...(prev.tags ?? []), newTag],
                          }));
                        }
                        setTagInput("");
                      }}
                      className="px-6 py-3 bg-gray-200 dark:bg-gray-600 text-text-primary-light dark:text-text-primary-dark font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {(formData.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(formData.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                tags: prev.tags?.filter((t) => t !== tag),
                              }))
                            }
                            className="ml-1 opacity-60 hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Footer Navigation */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-800 mt-8">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft size={18} /> Back
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={currentStep === 1 ? !isStep1Valid() : !isStep2Valid()}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Finish & Create Question"}
                {!loading && <Check size={18} />}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuestionPage;
