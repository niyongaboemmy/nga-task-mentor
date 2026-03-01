import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class NumericalHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "numerical";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    let result: any = {
      correct_answer: 0,
      tolerance: 0,
      precision: 2,
      units: "",
    };

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();

      const correctMatch = textOnly.match(
        /^(?:correct|answer)\s*:\s*(-?\d+\.?\d*)/i,
      );
      const toleranceMatch = textOnly.match(/^tolerance\s*:\s*(\d+\.?\d*)/i);
      const precisionMatch = textOnly.match(/^precision\s*:\s*(\d+)/i);
      const unitsMatch = textOnly.match(/^units\s*:\s*(.*)/i);

      if (correctMatch) {
        result.correct_answer = parseFloat(correctMatch[1]);
      } else if (toleranceMatch) {
        result.tolerance = parseFloat(toleranceMatch[1]);
      } else if (precisionMatch) {
        result.precision = parseInt(precisionMatch[1]);
      } else if (unitsMatch) {
        result.units = unitsMatch[1].trim();
      }
    }

    return {
      question_data: result,
      correct_answer: { answer: result.correct_answer, units: result.units },
    };
  }
}
