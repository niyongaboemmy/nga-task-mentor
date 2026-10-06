// CodingQuestion.tsx — the full CodeSpace IDE while answering; a read-only
// code view on results pages.
import React from "react";
import type { QuestionComponentProps } from "../../../types/quiz.types";
import { CodeSpaceEditor } from "./CodeSpaceEditor";
import { CodeAnswerView } from "./CodeAnswerView";

export const CodingQuestion: React.FC<QuestionComponentProps> = (props) =>
  props.readOnlyReview ? (
    <CodeAnswerView answer={props.answer} />
  ) : (
    <CodeSpaceEditor {...props} />
  );

export default CodingQuestion;
