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

interface QuestionRendererProps extends QuestionComponentProps {
  question: QuizQuestionType;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = (props) => {
  const { question, ...restProps } = props;

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

export default QuestionRenderer;
