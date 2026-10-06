import React, { useMemo } from "react";
import type {
  QuestionComponentProps,
  AlgorithmicData,
  CodingData,
} from "../../../types/quiz.types";
import RichTextDisplay from "../../Common/RichTextDisplay";
import { CodeSpaceEditor } from "./CodeSpaceEditor";
import { CodeAnswerView } from "./CodeAnswerView";

/**
 * An algorithmic question is an I/O programming problem: the student writes
 * code that reads the input format and prints the output format, and it is
 * graded on the judge against the question's test cases — exactly like a
 * coding question. The answer is {code, language}.
 *
 * This replaces the old trace/predict widget, whose steps were hardcoded
 * placeholders and whose score was computed in the browser (TM-FIX-2).
 */

/** The editor's view of an algorithmic question. */
function algorithmicAsCoding(data: AlgorithmicData): CodingData {
  const allowed = (data.allowed_languages ?? []).filter(Boolean);
  return {
    language: data.language || allowed[0] || "python",
    allowed_languages: allowed,
    starter_code: data.starter_code ?? "",
    test_cases: (data.test_cases ?? []).map((tc) => ({ ...tc })),
    constraints: data.constraints,
  };
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark mb-1">
      {title}
    </div>
    <div className="text-sm text-text-primary-light dark:text-text-primary-dark whitespace-pre-wrap">
      {children}
    </div>
  </div>
);

export const AlgorithmicQuestion: React.FC<QuestionComponentProps> = (props) => {
  const { question, answer } = props;
  const raw = question.question_data as AlgorithmicData | undefined;
  const data = useMemo(() => raw ?? ({} as AlgorithmicData), [raw]);
  const codingData = useMemo(() => algorithmicAsCoding(data), [data]);

  // Answers from the retired widget have no code: start from the starter.
  const codeAnswer =
    answer && typeof (answer as { code?: unknown }).code === "string" ? answer : undefined;

  const header = (
    <div
      className="mb-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-3"
      data-testid="algorithmic-header"
    >
      {data.algorithm_description && (
        <Section title="Problem">
          <RichTextDisplay content={data.algorithm_description} />
        </Section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data.input_format && <Section title="Input format">{data.input_format}</Section>}
        {data.output_format && <Section title="Output format">{data.output_format}</Section>}
      </div>
      {data.constraints && <Section title="Constraints">{data.constraints}</Section>}
    </div>
  );

  if (props.readOnlyReview) {
    return <CodeAnswerView answer={codeAnswer} />;
  }

  return (
    <div className="flex flex-col h-full">
      {header}
      <div className="flex-1 min-h-[420px]">
        <CodeSpaceEditor
          {...props}
          answer={codeAnswer}
          question={{ ...question, question_data: codingData }}
        />
      </div>
    </div>
  );
};

export default AlgorithmicQuestion;
