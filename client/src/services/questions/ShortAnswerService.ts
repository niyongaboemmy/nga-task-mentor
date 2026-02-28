import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, ShortAnswerData } from "../../types/quiz.types";

export class ShortAnswerService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "short_answer";
  }

  validate(data: any): ValidationResult {
    const saData = data as ShortAnswerData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (saData.keywords && saData.keywords.length === 0) {
      warnings.push("No keywords provided for short answer grading.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Short Answer";
  }

  getIconName(): string {
    return "MessageSquare";
  }
}
