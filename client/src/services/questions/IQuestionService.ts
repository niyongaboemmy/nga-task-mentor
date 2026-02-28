import type { QuestionDataType, QuestionType } from "../../types/quiz.types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IQuestionService {
  supports(type: QuestionType): boolean;
  validate(data: QuestionDataType): ValidationResult;
  // Metadata for preview/UI
  getLabel(): string;
  getIconName(): string;
}
