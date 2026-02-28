import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, OrderingData } from "../../types/quiz.types";

export class OrderingService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "ordering";
  }

  validate(data: any): ValidationResult {
    const orderingData = data as OrderingData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!orderingData.items || orderingData.items.length < 2) {
      errors.push("Ordering question must have at least 2 items.");
    }

    const itemsWithoutText = orderingData.items?.filter((i) => !i.text.trim());
    if (itemsWithoutText?.length > 0) {
      errors.push("Each item must have text.");
    }

    const itemsWithoutOrder = orderingData.items?.filter(
      (i) => i.order === undefined || i.order === null,
    );
    if (itemsWithoutOrder?.length > 0) {
      errors.push("Each item must have an assigned order.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Ordering";
  }

  getIconName(): string {
    return "ListOrdered";
  }
}
