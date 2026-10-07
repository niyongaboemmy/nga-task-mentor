import React, { useMemo, useState } from "react";
import { TerminalSquare } from "lucide-react";
import TmcodePracticalSection from "../../Assignments/form/TmcodePracticalSection";
import RubricBuilder from "../../Assignments/form/RubricBuilder";
import type { TmcodePracticalData } from "../../../types/quiz.types";
import type { RubricCriterion } from "../../Assignments/AssignmentCard";

/**
 * A TMCode practical question: students answer it with a TMCode project
 * (started from the starter files when there are some) and the teacher grades
 * it with these criteria in the grading workspace.
 */

export const DEFAULT_PRACTICAL_DATA: TmcodePracticalData = {
  kind: "practical",
  language: null,
  instructions: "",
  starter_project_id: null,
  starter_revision_id: null,
  rubric: [],
};

export const TmcodePracticalQuestionForm: React.FC<{
  data: Partial<TmcodePracticalData>;
  onChange: (data: TmcodePracticalData) => void;
}> = ({ data, onChange }) => {
  const value: TmcodePracticalData = { ...DEFAULT_PRACTICAL_DATA, ...data, rubric: data.rubric ?? [] };
  const total = useMemo(() => value.rubric.reduce((n, c) => n + (Number(c.max_score) || 0), 0), [value.rubric]);
  // Marks to split across the criteria; the question's points in the quiz should match.
  const [marks, setMarks] = useState<number>(total || 10);

  return (
    <div className="space-y-5" data-testid="tmcode-practical-form">
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5 text-sm text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-200">
        <TerminalSquare className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          Students open this question in TMCode, work in their own project (from your starter files if you add
          some) and submit it from the quiz. You grade it with the criteria below; until then the quiz shows the
          answer as pending.
        </p>
      </div>

      <TmcodePracticalSection
        alwaysOn
        value={{
          kind: value.kind,
          language: value.language,
          starter_project_id: value.starter_project_id,
          starter_revision_id: value.starter_revision_id,
          instructions: value.instructions,
        }}
        onChange={(next) =>
          onChange({
            ...value,
            kind: next.kind === "case_study" ? "case_study" : "practical",
            language: next.language,
            starter_project_id: next.starter_project_id,
            starter_revision_id: next.starter_revision_id,
            instructions: next.instructions ?? "",
          })
        }
      />

      <div>
        <h3 className="mb-1 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Grading criteria</h3>
        <p className="mb-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          What you'll mark in the grading workspace. Set the question's points in the quiz to the total
          {total ? ` (${total})` : ""}.
        </p>
        <RubricBuilder
          rubric={value.rubric as RubricCriterion[]}
          onChange={(rubric) => onChange({ ...value, rubric: rubric.map((c) => ({ criteria: c.criteria, description: c.description ?? null, max_score: c.max_score })) })}
          maxScore={marks}
          onMaxScoreChange={setMarks}
          title="TMCode practical"
          description={value.instructions}
        />
      </div>
    </div>
  );
};

export default TmcodePracticalQuestionForm;
