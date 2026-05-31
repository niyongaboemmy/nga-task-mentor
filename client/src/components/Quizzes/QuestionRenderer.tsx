import React from "react";
import type {
  QuizQuestion as QuizQuestionType,
  QuestionComponentProps,
} from "../../types/quiz.types";
import SingleChoiceQuestion from "./QuestionTypes/SingleChoiceQuestion";
import MultipleChoiceQuestion from "./QuestionTypes/MultipleChoiceQuestion";
import TrueFalseQuestion from "./QuestionTypes/TrueFalseQuestion";
import NumericalQuestion from "./QuestionTypes/NumericalQuestion";
import FillBlankQuestion from "./QuestionTypes/FillBlankQuestion";
import MatchingQuestion from "./QuestionTypes/MatchingQuestion";
import DropdownQuestion from "./QuestionTypes/DropdownQuestion";
import AlgorithmicQuestion from "./QuestionTypes/AlgorithmicQuestion";
import ShortAnswerQuestion from "./QuestionTypes/ShortAnswerQuestion";
import CodingQuestion from "./QuestionTypes/CodingQuestion";
import LogicalExpressionQuestion from "./QuestionTypes/LogicalExpressionQuestion";
import DragDropQuestion from "./QuestionTypes/DragDropQuestion";
import OrderingQuestion from "./QuestionTypes/OrderingQuestion";
import type { ProjectFile } from "./QuestionTypes/FileExplorer";

interface QuestionRendererProps extends QuestionComponentProps {
  question: QuizQuestionType;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { question: originalQuestion, ...restProps } = props;

  // Create a safe copy of the question with parsed data if needed
  const questionType =
    originalQuestion.question_type ||
    originalQuestion.questionBank?.question_type;
  const questionText =
    originalQuestion.question_text ||
    originalQuestion.questionBank?.question_text;
  let questionData =
    originalQuestion.question_data ||
    originalQuestion.questionBank?.question_data;

  if (typeof questionData === "string") {
    try {
      questionData = JSON.parse(questionData);
    } catch (error) {
      console.error(
        "Failed to parse question_data for question ID:",
        originalQuestion.id,
      );
      questionData = {}; // Fallback to empty object
    }
  }

  // Handle potential stringified answer
  let answer = (restProps as any).answer;
  if (typeof answer === "string" && answer.trim()) {
    try {
      // Only try to parse if it looks like JSON (starts with { or [)
      const trimmed = answer.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        answer = JSON.parse(trimmed);
      } else if (!isNaN(Number(trimmed)) && trimmed !== "") {
        // If it's a numeric string, we might need to decide how to handle it.
        // For now, let's just parse it as a number.
        answer = JSON.parse(trimmed);
      }
    } catch (e) {
      // Not JSON, keep as string
    }
  }

  const question = {
    ...originalQuestion,
    question_type: questionType,
    question_text: questionText,
    question_data: questionData,
    explanation:
      originalQuestion.explanation ||
      originalQuestion.questionBank?.explanation,
    correct_answer:
      originalQuestion.correct_answer ||
      originalQuestion.questionBank?.correct_answer,
    attachments:
      originalQuestion.attachments ||
      originalQuestion.questionBank?.attachments,
  };

  const finalProps = { ...restProps, answer, question };

  switch (question.question_type) {
    case "single_choice":
      return <SingleChoiceQuestion {...finalProps} />;

    case "multiple_choice":
      return <MultipleChoiceQuestion {...finalProps} />;

    case "true_false":
      return <TrueFalseQuestion {...finalProps} />;

    case "numerical":
      return <NumericalQuestion {...finalProps} />;

    case "fill_blank":
      return <FillBlankQuestion {...finalProps} />;

    case "matching":
      return <MatchingQuestion {...finalProps} />;

    case "dropdown":
      return <DropdownQuestion {...finalProps} />;

    case "algorithmic":
      return <AlgorithmicQuestion {...finalProps} />;

    case "short_answer":
      return <ShortAnswerQuestion {...finalProps} />;

    case "coding":
      return (
        <CodingQuestion
          {...(finalProps as any)}
          isProjectMode={
            Boolean((question as any)?.question_data?.project_mode) ||
            Boolean(
              (question as any)?.questionBank?.question_data?.project_mode,
            )
          }
          files={[] as ProjectFile[]}
          language={
            (question as any)?.question_data?.language ||
            (question as any)?.questionBank?.question_data?.language ||
            "javascript"
          }
          isRunning={false}
          isTesting={false}
          isWebLang={false}
          isStarted={false}
          onSetIsStarted={() => {}}
        />
      );

    case "logical_expression":
      return <LogicalExpressionQuestion {...finalProps} />;

    case "drag_drop":
      return <DragDropQuestion {...finalProps} />;

    case "ordering":
      return <OrderingQuestion {...finalProps} />;

    default:
      return (
        <div className="p-8 bg-red-50 dark:bg-red-900 border-2 border-dashed border-red-300 dark:border-red-700 rounded-lg text-center">
          <div className="text-red-500 dark:text-red-400">
            <div className="text-lg font-medium mb-2">
              Unknown Question Type
            </div>
            <div className="text-sm">
              Question type "{question.question_type}" is not supported yet.
            </div>
          </div>
        </div>
      );
  }
};

export default QuestionRenderer;
