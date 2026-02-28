import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, SingleChoiceData } from "../../types/quiz.types";

export class SingleChoiceService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "single_choice";
  }

  validate(data: any): ValidationResult {
    const scData = data as SingleChoiceData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!scData.options || scData.options.length < 2) {
      errors.push("Single choice question must have at least 2 options.");
    }

    if (
      scData.correct_option_index === undefined ||
      scData.correct_option_index < 0 ||
      scData.correct_option_index >= (scData.options?.length || 0)
    ) {
      errors.push("Invalid correct option index.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Single Choice";
  }

  getIconName(): string {
    return "CheckCircle2";
  }
}
