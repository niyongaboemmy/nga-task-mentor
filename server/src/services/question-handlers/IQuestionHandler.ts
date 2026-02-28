import { QuestionType } from "../../types/quiz.types";

export interface IQuestionHandler {
  supports(type: QuestionType): boolean;
  handle(
    lines: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any };
}
