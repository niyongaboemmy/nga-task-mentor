// CodingQuestion.tsx — the code workspace while answering (web pages keep the
// CodeSpace editor and its live preview); a read-only code view on results pages.
import React from "react";
import type { CodingData, QuestionComponentProps } from "../../../types/quiz.types";
import { CodeSpaceEditor } from "./CodeSpaceEditor";
import { CodeAnswerView } from "./CodeAnswerView";
import QuizCodeAnswer from "./QuizCodeAnswer";

const WEB = new Set(["html", "css", "react", "vue", "angular", "nextjs"]);

/** Web-page answers need the live preview of the CodeSpace editor. */
const isWebCodingQuestion = (data: Partial<CodingData> | undefined) => {
  const langs = [data?.language, ...(data?.allowed_languages ?? [])].map((l) => String(l ?? "").toLowerCase());
  return langs.some((l) => WEB.has(l));
};

export const CodingQuestion: React.FC<QuestionComponentProps> = (props) =>
  props.readOnlyReview ? (
    <CodeAnswerView answer={props.answer} />
  ) : isWebCodingQuestion(props.question.question_data as CodingData) ? (
    <CodeSpaceEditor {...props} />
  ) : (
    <QuizCodeAnswer {...props} />
  );

export default CodingQuestion;
