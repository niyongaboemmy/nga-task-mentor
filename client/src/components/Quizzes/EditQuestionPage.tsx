import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import type { RootState, AppDispatch } from "../../store";
import { updateQuestion, fetchQuestion } from "../../store/slices/quizSlice";
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
  LogicalExpressionQuestionForm,
  DragDropQuestionForm,
} from "./QuestionForms";
import { 
  ArrowLeft, 
  Edit3, 
  MessageCircle, 
  Clock, 
  Trophy, 
  FileText,
  Layers
} from "lucide-react";
import type {
  QuizQuestion,
  SingleChoiceData,
  MultipleChoiceData,
  TrueFalseData,
  NumericalData,
  MatchingData,
  OrderingData,
  DropdownData,
  AlgorithmicData,
  CodingData,
  FillBlankData,
  ShortAnswerData,
  LogicalExpressionData,
  DragDropData,
} from "../../types/quiz.types";

interface EditQuestionPageProps {
  quizId: number;
  questionId: number;
}

export const EditQuestionPage: React.FC<EditQuestionPageProps> = ({
  quizId,
  questionId,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { currentQuestion, loading } = useSelector(
    (state: RootState) => state.quiz
  );
  const [formData, setFormData] = useState<Partial<QuizQuestion>>({});

  // Helper functions for type-safe data access
  const handleQuestionDataChange = (data: typeof formData.question_data) => {
    setFormData((prev) => ({ ...prev, question_data: data }));
  };

  const getSingleChoiceData = () => formData.question_data as SingleChoiceData;
  const getMultipleChoiceData = () =>
    formData.question_data as MultipleChoiceData;
  const getTrueFalseData = () => formData.question_data as TrueFalseData;
  const getNumericalData = () => formData.question_data as NumericalData;
  const getMatchingData = () => formData.question_data as MatchingData;
  const getOrderingData = () => formData.question_data as OrderingData;
  const getDropdownData = () => formData.question_data as DropdownData;
  const getAlgorithmicData = () => formData.question_data as AlgorithmicData;
  const getCodingData = () => formData.question_data as CodingData;
  const getFillBlankData = () => formData.question_data as FillBlankData;
  const getShortAnswerData = () => formData.question_data as ShortAnswerData;
  const getLogicalExpressionData = () =>
    formData.question_data as LogicalExpressionData;
  const getDragDropData = () => formData.question_data as DragDropData;

  useEffect(() => {
    if (questionId) {
      dispatch(fetchQuestion(questionId));
    }
  }, [questionId, dispatch]);

  useEffect(() => {
    if (currentQuestion) {
      setFormData(currentQuestion);
    }
  }, [currentQuestion]);

  const renderQuestionTypeFields = () => {
    if (!formData.question_type) return null;

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
      case "logical_expression":
        return (
          <LogicalExpressionQuestionForm
            data={getLogicalExpressionData()}
            onChange={handleQuestionDataChange}
          />
        );
      case "drag_drop":
        return (
          <DragDropQuestionForm
            data={getDragDropData()}
            onChange={handleQuestionDataChange}
          />
        );
      default:
        return (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              Question type "{formData.question_type}" is not supported.
            </p>
          </div>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question_text?.trim()) return;

    try {
      await dispatch(
        updateQuestion({
          questionId: questionId,
          questionData: formData,
        })
      ).unwrap();

      toast.success("Question updated successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      navigate(`/quizzes/${quizId}`);
    } catch (error: any) {
      console.error("Failed to update question:", error);

      // Extract backend error message clearly
      let errorMessage = "Failed to update question. Please try again.";

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
    }
  };

  if (loading.quiz) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <span className="block mt-4 text-gray-600 dark:text-gray-300 text-lg">
            Loading question...
          </span>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
            Question not found.
          </div>
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-2xl transition-colors duration-200 font-medium"
          >
            Back to Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100 dark:border-gray-800">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
                 <Edit3 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
               </div>
               <div>
                 <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Question</h1>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Modify question properties and content</p>
               </div>
             </div>
             <button
               onClick={() => navigate(`/quizzes/${quizId}`)}
               className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
             >
               <ArrowLeft className="w-4 h-4" />
               Back to Quiz
             </button>
           </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Primary Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-3xl border border-gray-100 dark:border-gray-800">
               {/* Question Type (Read-only) */}
               <div className="space-y-2">
                 <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                   <Layers className="w-4 h-4 text-gray-400" />
                   Question Type
                 </label>
                 <div className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 text-sm font-medium">
                   {formData.question_type?.replace("_", " ").toUpperCase() || "Unknown"}
                 </div>
                 <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Type cannot be changed</p>
               </div>

               {/* Points & Time */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <Trophy className="w-4 h-4 text-gray-400" />
                      Points
                    </label>
                    <input
                      type="number"
                      value={formData.points || 1}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          points: parseInt(e.target.value),
                        }))
                      }
                      min="1"
                      max="100"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
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
                      value={formData.time_limit_seconds || 60}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          time_limit_seconds: parseInt(e.target.value),
                        }))
                      }
                      min="10"
                      max="3600"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
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
                value={formData.question_text || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    question_text: e.target.value,
                  }))
                }
                placeholder="Edit your question prompt..."
                rows={4}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm resize-none"
                required
              />
            </div>

            {/* Question-specific fields */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-2 border border-gray-100 dark:border-gray-800 shadow-sm">
              {renderQuestionTypeFields()}
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Points
              </label>
              <input
                type="number"
                value={formData.points || 1}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    points: parseInt(e.target.value),
                  }))
                }
                min="1"
                max="100"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
                required
              />
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
                placeholder="Provide a helpful explanation..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-8 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => navigate(`/quizzes/${quizId}`)}
                className="px-8 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full transition-colors duration-200 font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditQuestionPage;
