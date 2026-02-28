import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, NumericalData } from "../../types/quiz.types";

export class NumericalService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "numerical";
  }

  validate(data: any): ValidationResult {
    const nData = data as NumericalData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      nData.correct_answer === undefined ||
      isNaN(Number(nData.correct_answer))
    ) {
      errors.push(
        "Numerical question must have a valid number as the correct answer.",
      );
    }

    if (nData.tolerance === undefined || isNaN(Number(nData.tolerance))) {
      errors.push("Numerical question must have a valid tolerance.");
    }

    if (Number(nData.tolerance) < 0) {
      errors.push("Tolerance must be a non-negative number.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Numerical";
  }

  getIconName(): string {
    return "Hash";
  }
}
