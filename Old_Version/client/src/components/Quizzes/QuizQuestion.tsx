import React from "react";
import type {
  QuizQuestion as QuizQuestionType,
  QuestionComponentProps,
} from "../../types/quiz.types";
import QuestionRenderer from "./QuestionRenderer";
import BaseQuestion from "./BaseQuestion";

interface QuizQuestionProps extends QuestionComponentProps {
  question: QuizQuestionType;
  showQuestionNumber?: boolean;
  questionNumber?: number;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
  showCorrectAnswer = false,
  timeRemaining,
  showQuestionNumber = true,
  questionNumber,
}) => {
  return (
    <div className={`quiz-question`}>
      <BaseQuestion
        questionId={question.id}
        questionType={question.question_type}
        questionText={question.question_text}
        points={question.points}
        timeLimit={question.time_limit}
        isRequired={question.is_required}
        explanation={question.explanation}
        showCorrectAnswer={showCorrectAnswer}
        className=""
      >
        <>
          {/* Question number indicator */}
          {showQuestionNumber && questionNumber && (
            <div className="mb-4 flex items-center">
              <div className="bg-blue-500 dark:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                Question {questionNumber}
              </div>
            </div>
          )}

          {/* Render the appropriate question component */}
          <QuestionRenderer
            question={question}
            answer={answer}
            onAnswerChange={onAnswerChange}
            disabled={disabled}
            showCorrectAnswer={showCorrectAnswer}
            timeRemaining={timeRemaining}
          />
        </>
      </BaseQuestion>
    </div>
  );
};

export default QuizQuestion;
