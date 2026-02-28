import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, MatchingData } from "../../types/quiz.types";

export class MatchingService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "matching";
  }

  validate(data: any): ValidationResult {
    const matchingData = data as MatchingData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!matchingData.left_items || matchingData.left_items.length < 2) {
      errors.push("Matching question must have at least 2 items to match.");
    }

    if (!matchingData.right_items || matchingData.right_items.length < 2) {
      errors.push("Matching question must have at least 2 possible matches.");
    }

    const matchedLeftIds = Object.keys(matchingData.correct_matches || {});
    if (matchedLeftIds.length === 0) {
      errors.push("No matches have been defined.");
    } else if (matchedLeftIds.length < (matchingData.left_items?.length || 0)) {
      warnings.push("Some items do not have a defined correct match.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Matching";
  }

  getIconName(): string {
    return "GitCompare";
  }
}
