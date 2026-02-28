import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class ShortAnswerHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "short_answer";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    let keywords: string[] = [];
    let sampleAnswer = "";
    for (const p of paragraphs) {
      const textOnly = p
        .replace(/<[^>]*>/g, "")
        .trim()
        .toLowerCase();
      if (textOnly.startsWith("keywords:")) {
        keywords = textOnly
          .replace(/^keywords:/i, "")
          .split(",")
          .map((k) => k.trim());
      } else if (textOnly.startsWith("sample answer:")) {
        sampleAnswer = p.replace(/^(<[^>]*>)?sample answer:/i, "").trim();
      }
    }
    return {
      question_data: { keywords, sample_answer: sampleAnswer },
      correct_answer: null,
    };
  }
}
