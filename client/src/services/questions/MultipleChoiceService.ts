import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, MultipleChoiceData } from "../../types/quiz.types";

export class MultipleChoiceService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "multiple_choice";
  }

  validate(data: any): ValidationResult {
    const mcData = data as MultipleChoiceData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!mcData.options || mcData.options.length < 2) {
      errors.push("Multiple choice question must have at least 2 options.");
    }

    if (
      !mcData.correct_option_indices ||
      mcData.correct_option_indices.length === 0
    ) {
      errors.push("At least one correct option must be selected.");
    }

    (mcData.correct_option_indices || []).forEach((idx) => {
      if (idx < 0 || idx >= (mcData.options?.length || 0)) {
        errors.push(`Invalid correct option index: ${idx}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Multiple Choice";
  }

  getIconName(): string {
    return "CheckSquare";
  }
}
