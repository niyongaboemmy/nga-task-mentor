import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, FillBlankData } from "../../types/quiz.types";

export class FillBlankService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "fill_blank";
  }

  validate(data: any): ValidationResult {
    const fbData = data as FillBlankData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !fbData.text_with_blanks ||
      (!fbData.text_with_blanks.includes("[blank]") &&
        !fbData.text_with_blanks.includes("{{blank}}"))
    ) {
      errors.push(
        "Fill-in-the-blank question must contain at least one placeholder ([blank] or {{blank}}).",
      );
    }

    const acceptableAnswers = fbData.acceptable_answers || [];
    if (acceptableAnswers.length === 0) {
      errors.push("No acceptable answers have been defined.");
    }

    const blanksInText = (
      fbData.text_with_blanks?.match(/\[blank\]|\{\{blank\}\}/g) || []
    ).length;

    if (acceptableAnswers.length < blanksInText) {
      errors.push(`Some blanks do not have acceptable answers defined.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Fill in the Blank";
  }

  getIconName(): string {
    return "Type";
  }
}
