import React from "react";
import { FileText } from "lucide-react";
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

interface QuestionRendererProps extends QuestionComponentProps {
  question: QuizQuestionType;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { question, ...restProps } = props;

  const renderQuestion = () => {
    switch (question.question_type) {
      case "single_choice":
        return <SingleChoiceQuestion {...restProps} question={question} />;

      case "multiple_choice":
        return <MultipleChoiceQuestion {...restProps} question={question} />;

      case "true_false":
        return <TrueFalseQuestion {...restProps} question={question} />;

      case "numerical":
        return <NumericalQuestion {...restProps} question={question} />;

      case "fill_blank":
        return <FillBlankQuestion {...restProps} question={question} />;

      case "matching":
        return <MatchingQuestion {...restProps} question={question} />;

      case "dropdown":
        return <DropdownQuestion {...restProps} question={question} />;

      case "algorithmic":
        return <AlgorithmicQuestion {...restProps} question={question} />;

      case "short_answer":
        return <ShortAnswerQuestion {...restProps} question={question} />;

      case "coding":
        return <CodingQuestion {...restProps} question={question} />;

      case "logical_expression":
        return <LogicalExpressionQuestion {...restProps} question={question} />;

      case "drag_drop":
        return <DragDropQuestion {...restProps} question={question} />;

      case "ordering":
        return <OrderingQuestion {...restProps} question={question} />;

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

  return (
    <div className="space-y-6">
      {renderQuestion()}

      {/* Attachments Section */}
      {question.attachments && question.attachments.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Question Attachments
          </h4>
          <div className="flex flex-wrap gap-3">
            {question.attachments.map((attachment: any, index: number) => (
              <a
                key={index}
                href={attachment.url}
                download={attachment.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors group text-sm"
              >
                <div className="p-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate max-w-[200px]">
                  {attachment.name}
                </span>
                <span className="text-xs text-gray-400">
                  ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionRenderer;
