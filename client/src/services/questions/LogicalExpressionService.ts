import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type {
  QuestionType,
  LogicalExpressionData,
} from "../../types/quiz.types";

export class LogicalExpressionService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "logical_expression";
  }

  validate(data: any): ValidationResult {
    const logicalData = data as LogicalExpressionData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !logicalData.expression_format ||
      logicalData.expression_format.trim() === ""
    ) {
      errors.push("Expression problem statement/format is required.");
    }

    if (!logicalData.variables || logicalData.variables.length === 0) {
      errors.push("At least one variable is required.");
    } else {
      logicalData.variables.forEach((v, index) => {
        if (!v.name) errors.push(`Variable ${index + 1} is missing a name.`);
        if (!v.description)
          warnings.push(
            `Variable ${v.name || index + 1} is missing a description.`,
          );
      });
    }

    if (
      !logicalData.correct_expression ||
      logicalData.correct_expression.trim() === ""
    ) {
      errors.push("The correct logical expression must be defined.");
    }

    if (!logicalData.truth_table || logicalData.truth_table.length === 0) {
      warnings.push(
        "No truth table entries defined. Truth table validation will not be available.",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Logical Expression";
  }

  getIconName(): string {
    return "FunctionSquare";
  }
}
