import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { 
  ArrowLeft, 
  PlusCircle, 
  Clock, 
  Trophy, 
  MessageCircle, 
  Layers,
  FileText
} from "lucide-react";
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
} from "../../types/quiz.types";

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
  const [formData, setFormData] = useState<CreateQuestionRequest>({
    question_type: "single_choice",
    question_text: "",
    question_data: createQuestionData("single_choice"),
    points: 1,
    order: 1,
    time_limit_seconds: 60,
    is_required: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text.trim()) return;

    // Validate coding questions
    if (formData.question_type === "coding") {
      const codingData = getCodingData();
      const hasInvalidTestCases = codingData.test_cases.some(
        (testCase) => !testCase.input.trim() || !testCase.expected_output.trim()
      );

      if (hasInvalidTestCases) {
        const invalidCount = codingData.test_cases.filter(
          (testCase) =>
            !testCase.input.trim() || !testCase.expected_output.trim()
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
          }
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
        })
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

  const isFormValid = () => {
    if (!formData.question_text.trim()) return false;
    if (!formData.time_limit_seconds || formData.time_limit_seconds < 10)
      return false;

    // Additional validation for coding questions
    if (formData.question_type === "coding") {
      const codingData = getCodingData();
      const hasInvalidTestCases = codingData.test_cases.some(
        (testCase: any) =>
          !testCase.input.trim() || !testCase.expected_output.trim()
      );
      if (hasInvalidTestCases) return false;
    }

    return true;
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
    <div className="pb-8">
      <div className="">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-6 md:p-9">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl">
                <PlusCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Question</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Define your question and its metadata</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/quizzes/${quizId}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Quiz
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Primary Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-gray-100 dark:border-gray-800">
              {/* Question Type */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Layers className="w-4 h-4 text-gray-400" />
                  Question Type
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
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
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
                  <option value="coding">Coding</option>
                </select>
              </div>

              {/* Scoring & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Trophy className="w-4 h-4 text-gray-400" />
                    Points
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
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Time (sec)
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
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <FileText className="w-4 h-4 text-gray-400" />
                Question Text *
              </label>
              <textarea
                value={formData.question_text}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    question_text: e.target.value,
                  }))
                }
                placeholder="Enter your clear and concise question prompt here..."
                rows={4}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
                required
              />
            </div>

            {/* Question-specific fields */}
            {renderQuestionTypeFields()}

            {/* Validation Messages */}
            {formData.question_type === "coding" &&
              !isFormValid() &&
              formData.question_text.trim() && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 dark:text-red-400">⚠️</span>
                    <div className="text-sm text-red-800 dark:text-red-200">
                      <p className="font-medium">
                        Complete Test Cases Required
                      </p>
                      <p>
                        Please provide input and expected output for all test
                        cases before submitting.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Points */}
            <div>
              <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
                Points
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Time Limit */}
            <div>
              <label className="block text-sm font-normal text-gray-700 mb-2 dark:text-gray-300">
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 seconds, maximum 1 hour (3600 seconds)
              </p>
            </div>

            {/* Explanation */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <MessageCircle className="w-4 h-4 text-gray-400" />
                Explanation (optional)
              </label>
              <textarea
                value={formData.explanation || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    explanation: e.target.value,
                  }))
                }
                placeholder="Briefly explain the correct answer to help students learn..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => navigate(`/quizzes/${quizId}`)}
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-300 rounded-full hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateQuestionPage;
