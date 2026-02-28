import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, TrueFalseData } from "../../types/quiz.types";

export class TrueFalseService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "true_false";
  }

  validate(data: any): ValidationResult {
    const tfData = data as TrueFalseData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tfData.correct_answer === undefined || tfData.correct_answer === null) {
      errors.push("True/False question must have a correct answer.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "True / False";
  }

  getIconName(): string {
    return "ToggleLeft";
  }
}
