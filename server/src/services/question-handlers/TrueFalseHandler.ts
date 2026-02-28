import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class TrueFalseHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "true_false";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    let correctAnswer = true;
    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();

      const match = textOnly.match(
        /^(?:correct|answer)\s*:\s*(true|false|yes|no|t|f|1|0)/i,
      );
      if (match) {
        const val = match[1].toLowerCase();
        correctAnswer = ["true", "yes", "t", "1"].includes(val);
      }
    }

    return {
      question_data: { correct_answer: correctAnswer },
      correct_answer: { correct_answer: correctAnswer },
    };
  }
}
