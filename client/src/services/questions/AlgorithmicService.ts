import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, AlgorithmicData } from "../../types/quiz.types";

export class AlgorithmicService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "algorithmic";
  }

  validate(data: any): ValidationResult {
    const algorithmicData = data as AlgorithmicData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !algorithmicData.algorithm_description ||
      algorithmicData.algorithm_description.trim() === ""
    ) {
      errors.push("Algorithm description/problem statement is required.");
    }

    if (
      !algorithmicData.test_cases ||
      algorithmicData.test_cases.length === 0
    ) {
      errors.push("At least one test case is required.");
    } else {
      const visibleTestCases = algorithmicData.test_cases.filter(
        (tc) => !tc.is_hidden,
      );
      if (visibleTestCases.length === 0) {
        warnings.push(
          "No visible test cases defined. All test cases are hidden.",
        );
      }

      algorithmicData.test_cases.forEach((tc, index) => {
        if (!tc.input) errors.push(`Test case ${index + 1} is missing input.`);
        if (!tc.expected_output)
          errors.push(`Test case ${index + 1} is missing expected output.`);
      });
    }

    if (!algorithmicData.input_format) {
      warnings.push("Input format description is missing.");
    }
    if (!algorithmicData.output_format) {
      warnings.push("Output format description is missing.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Algorithmic";
  }

  getIconName(): string {
    return "Cpu";
  }
}
