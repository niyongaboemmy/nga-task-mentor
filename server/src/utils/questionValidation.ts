import {
  QuestionType,
  QuestionDataType,
  QuestionValidationResult,
} from "../types/quiz.types";

// Validation functions for each question type
export class QuestionValidator {
  static validateQuestionData(
    questionType: string,
    data: any,
    correctAnswer?: any,
  ): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let result: QuestionValidationResult;

    switch (questionType) {
      case "single_choice":
        return this.validateSingleChoice(data);
      case "multiple_choice":
        return this.validateMultipleChoice(data);
      case "true_false":
        result = this.validateTrueFalse(data);
        break;
      case "matching":
        result = this.validateMatching(data);
        break;
      case "fill_blank":
        result = this.validateFillBlank(data);
        break;
      case "dropdown":
        result = this.validateDropdown(data);

        // Also validate that correct_answer exists for dropdown questions
        if (result.isValid && correctAnswer) {
          const dropdownCorrectAnswer = correctAnswer as any;
          if (!Array.isArray(dropdownCorrectAnswer)) {
            result.errors.push(
              "Dropdown questions must have correct_answer as an array",
            );
            result.isValid = false;
          } else {
            // Validate all dropdowns have a correct answer
            const dropdownCount = (
              data.text_with_dropdowns?.match(/\{\{dropdown\}\}/g) || []
            ).length;
            if (dropdownCorrectAnswer.length !== dropdownCount) {
              result.errors.push(
                `Must specify correct answer for all ${dropdownCount} dropdowns`,
              );
              result.isValid = false;
            }

            // Validate each correct answer item
            dropdownCorrectAnswer.forEach((item: any, index: number) => {
              if (typeof item.dropdown_index !== "number") {
                result.errors.push(
                  `Correct answer item ${index} must have dropdown_index`,
                );
                result.isValid = false;
              }
              if (
                !item.selected_option ||
                typeof item.selected_option !== "string"
              ) {
                result.errors.push(
                  `Correct answer item ${index} must have selected_option`,
                );
                result.isValid = false;
              }
            });
          }
        } else if (result.isValid && !correctAnswer) {
          result.errors.push(
            "Dropdown questions must have correct_answer defined",
          );
          result.isValid = false;
        }
        break;
      case "numerical":
        result = this.validateNumerical(data);
        break;
      case "algorithmic":
        result = this.validateAlgorithmic(data);
        break;
      case "short_answer":
        result = this.validateShortAnswer(data);
        break;
      case "coding":
        return this.validateCoding(data);
      case "logical_expression":
        return this.validateLogicalExpression(data);
      case "drag_drop":
        return this.validateDragDrop(data);
      case "ordering":
        return this.validateOrdering(data);
      default:
        errors.push(`Unknown question type: ${questionType}`);
        return { isValid: false, errors, warnings };
    }

    return result;
  }

  private static validateSingleChoice(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.options ||
      !Array.isArray(data.options) ||
      data.options.length < 2
    ) {
      errors.push("Single choice questions must have at least 2 options");
    }

    if (
      data.options &&
      data.options.some(
        (opt: string) => typeof opt !== "string" || opt.trim() === "",
      )
    ) {
      errors.push("All options must be non-empty strings");
    }

    if (
      typeof data.correct_option_index !== "number" ||
      data.correct_option_index < 0 ||
      data.correct_option_index >= data.options?.length
    ) {
      errors.push(
        "Correct option index must be a valid index within the options array",
      );
    }

    if (data.options && data.options.length > 10) {
      warnings.push("Large number of options may affect user experience");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateMultipleChoice(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.options ||
      !Array.isArray(data.options) ||
      data.options.length < 2
    ) {
      errors.push("Multiple choice questions must have at least 2 options");
    }

    if (
      !data.correct_option_indices ||
      !Array.isArray(data.correct_option_indices) ||
      data.correct_option_indices.length === 0
    ) {
      errors.push(
        "Multiple choice questions must have at least one correct option",
      );
    }

    if (data.correct_option_indices) {
      data.correct_option_indices.forEach((index: number, i: number) => {
        if (
          typeof index !== "number" ||
          index < 0 ||
          index >= data.options?.length
        ) {
          errors.push(
            `Correct option index ${index} at position ${i} is invalid`,
          );
        }
      });
    }

    if (
      data.min_selections &&
      data.max_selections &&
      data.min_selections > data.max_selections
    ) {
      errors.push(
        "Minimum selections cannot be greater than maximum selections",
      );
    }

    if (
      data.correct_option_indices &&
      data.correct_option_indices.length === 1
    ) {
      warnings.push(
        "Only one correct option selected - consider using single choice instead",
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateTrueFalse(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data.correct_answer !== "boolean") {
      errors.push(
        "True/False questions must have a boolean correct_answer field",
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateMatching(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.left_items ||
      !Array.isArray(data.left_items) ||
      data.left_items.length === 0
    ) {
      errors.push("Matching questions must have at least one left item");
    }

    if (
      !data.right_items ||
      !Array.isArray(data.right_items) ||
      data.right_items.length === 0
    ) {
      errors.push("Matching questions must have at least one right item");
    }

    if (
      data.left_items &&
      data.right_items &&
      data.left_items.length !== data.right_items.length
    ) {
      warnings.push(
        "Number of left and right items differ - this may confuse students",
      );
    }

    if (!data.correct_matches || typeof data.correct_matches !== "object") {
      errors.push("Matching questions must have correct_matches mapping");
    }

    if (data.left_items && data.correct_matches) {
      const leftIds = data.left_items.map((item: any) => item.id);
      const correctMatchKeys = Object.keys(data.correct_matches);

      leftIds.forEach((id: string) => {
        if (!correctMatchKeys.includes(id)) {
          errors.push(`Left item ${id} is missing from correct_matches`);
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateFillBlank(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.text_with_blanks || typeof data.text_with_blanks !== "string") {
      errors.push("Fill blank questions must have text_with_blanks field");
    }

    if (
      !data.acceptable_answers ||
      !Array.isArray(data.acceptable_answers) ||
      data.acceptable_answers.length === 0
    ) {
      errors.push(
        "Fill blank questions must have at least one acceptable answer",
      );
    }

    const blankCount = (data.text_with_blanks?.match(/\{\{blank\}\}/g) || [])
      .length;
    if (blankCount === 0) {
      errors.push("Text must contain at least one {{blank}} placeholder");
    }

    if (
      data.acceptable_answers &&
      blankCount > 0 &&
      data.acceptable_answers.length !== blankCount
    ) {
      errors.push(
        `Number of acceptable answers (${data.acceptable_answers.length}) must match number of blanks (${blankCount})`,
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateDropdown(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.text_with_dropdowns ||
      typeof data.text_with_dropdowns !== "string"
    ) {
      errors.push("Dropdown questions must have text_with_dropdowns field");
    }

    if (
      !data.dropdown_options ||
      !Array.isArray(data.dropdown_options) ||
      data.dropdown_options.length === 0
    ) {
      errors.push(
        "Dropdown questions must have at least one dropdown option set",
      );
    }

    const dropdownCount = (
      data.text_with_dropdowns?.match(/\{\{dropdown\}\}/g) || []
    ).length;
    if (dropdownCount === 0) {
      errors.push("Text must contain at least one {{dropdown}} placeholder");
    }

    if (
      data.dropdown_options &&
      dropdownCount > 0 &&
      data.dropdown_options.length !== dropdownCount
    ) {
      errors.push(
        `Number of dropdown option sets (${data.dropdown_options.length}) must match number of dropdowns (${dropdownCount})`,
      );
    }

    if (data.dropdown_options) {
      data.dropdown_options.forEach((optionSet: any, index: number) => {
        if (
          !optionSet.options ||
          !Array.isArray(optionSet.options) ||
          optionSet.options.length < 2
        ) {
          errors.push(
            `Dropdown option set ${index} must have at least 2 options`,
          );
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateNumerical(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof data.correct_answer !== "number") {
      errors.push("Numerical questions must have a numeric correct_answer");
    }

    if (
      data.tolerance !== undefined &&
      (typeof data.tolerance !== "number" || data.tolerance < 0)
    ) {
      errors.push("Tolerance must be a non-negative number");
    }

    if (
      data.precision !== undefined &&
      (typeof data.precision !== "number" || data.precision < 0)
    ) {
      errors.push("Precision must be a non-negative number");
    }

    if (data.acceptable_range) {
      if (
        typeof data.acceptable_range.min !== "number" ||
        typeof data.acceptable_range.max !== "number"
      ) {
        errors.push("Acceptable range min and max must be numbers");
      } else if (data.acceptable_range.min >= data.acceptable_range.max) {
        errors.push("Acceptable range min must be less than max");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateAlgorithmic(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.algorithm_description ||
      typeof data.algorithm_description !== "string"
    ) {
      errors.push("Algorithmic questions must have algorithm_description");
    }

    if (!data.input_format || typeof data.input_format !== "string") {
      errors.push("Algorithmic questions must have input_format");
    }

    if (!data.output_format || typeof data.output_format !== "string") {
      errors.push("Algorithmic questions must have output_format");
    }

    if (
      !data.test_cases ||
      !Array.isArray(data.test_cases) ||
      data.test_cases.length === 0
    ) {
      errors.push("Algorithmic questions must have at least one test case");
    }

    if (data.test_cases) {
      data.test_cases.forEach((testCase: any, index: number) => {
        if (!testCase.input || !testCase.expected_output) {
          errors.push(`Test case ${index} must have input and expected_output`);
        }
        if (typeof testCase.points !== "number" || testCase.points <= 0) {
          errors.push(`Test case ${index} must have positive points`);
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateShortAnswer(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      data.max_length &&
      (typeof data.max_length !== "number" || data.max_length < 1)
    ) {
      errors.push("Max length must be a positive number");
    }

    if (data.keywords && !Array.isArray(data.keywords)) {
      errors.push("Keywords must be an array of strings");
    }

    if (data.keywords) {
      data.keywords.forEach((keyword: any, index: number) => {
        if (typeof keyword !== "string") {
          errors.push(`Keyword at index ${index} must be a string`);
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateCoding(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.language || typeof data.language !== "string") {
      errors.push("Coding questions must specify a programming language");
    }

    if (
      !data.test_cases ||
      !Array.isArray(data.test_cases) ||
      data.test_cases.length === 0
    ) {
      errors.push("Coding questions must have at least one test case");
    }

    if (data.test_cases) {
      data.test_cases.forEach((testCase: any, index: number) => {
        if (!testCase.input || !testCase.expected_output) {
          errors.push(`Test case ${index} must have input and expected_output`);
        }
        if (typeof testCase.points !== "number" || testCase.points <= 0) {
          errors.push(`Test case ${index} must have positive points`);
        }
      });
    }

    if (
      data.time_limit &&
      (typeof data.time_limit !== "number" || data.time_limit < 1)
    ) {
      errors.push("Time limit must be a positive number");
    }

    if (
      data.memory_limit &&
      (typeof data.memory_limit !== "number" || data.memory_limit < 1)
    ) {
      errors.push("Memory limit must be a positive number");
    }

    if (data.allowed_languages && !Array.isArray(data.allowed_languages)) {
      errors.push("Allowed languages must be an array of strings");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateLogicalExpression(
    data: any,
  ): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.expression_format || typeof data.expression_format !== "string") {
      errors.push("Logical expression questions must have expression_format");
    }

    if (
      !data.variables ||
      !Array.isArray(data.variables) ||
      data.variables.length === 0
    ) {
      errors.push(
        "Logical expression questions must have at least one variable",
      );
    }

    if (
      !data.correct_expression ||
      typeof data.correct_expression !== "string"
    ) {
      errors.push("Logical expression questions must have correct_expression");
    }

    if (data.variables) {
      data.variables.forEach((variable: any, index: number) => {
        if (!variable.name || !variable.description) {
          errors.push(
            `Variable at index ${index} must have name and description`,
          );
        }
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateDragDrop(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !data.drop_zones ||
      !Array.isArray(data.drop_zones) ||
      data.drop_zones.length === 0
    ) {
      errors.push("Drag and drop questions must have at least one drop zone");
    }

    if (
      !data.draggable_items ||
      !Array.isArray(data.draggable_items) ||
      data.draggable_items.length === 0
    ) {
      errors.push(
        "Drag and drop questions must have at least one draggable item",
      );
    }

    if (data.drop_zones) {
      data.drop_zones.forEach((zone: any, index: number) => {
        if (
          typeof zone.x !== "number" ||
          typeof zone.y !== "number" ||
          typeof zone.width !== "number" ||
          typeof zone.height !== "number"
        ) {
          errors.push(
            `Drop zone ${index} must have numeric x, y, width, and height`,
          );
        }
        if (zone.width <= 0 || zone.height <= 0) {
          errors.push(`Drop zone ${index} must have positive width and height`);
        }
      });
    }

    if (data.draggable_items && data.drop_zones) {
      const totalCorrectSlots = data.drop_zones.reduce(
        (sum: number, zone: any) => sum + zone.correct_items.length,
        0,
      );
      if (totalCorrectSlots > data.draggable_items.length) {
        warnings.push(
          "More correct slots than draggable items - some items may need to be used multiple times",
        );
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateOrdering(data: any): QuestionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.items || !Array.isArray(data.items) || data.items.length < 2) {
      errors.push("Ordering questions must have at least 2 items");
    }

    if (data.items) {
      // Check for duplicate order values
      const orders = data.items.map((item: any) => item.order);
      const uniqueOrders = new Set(orders);

      if (orders.length !== uniqueOrders.size) {
        errors.push("All items must have unique order values");
      }

      // Check if orders form a consecutive sequence starting from 1
      const minOrder = Math.min(...orders);
      const maxOrder = Math.max(...orders);

      if (minOrder !== 1 || maxOrder !== data.items.length) {
        warnings.push(
          "Order values should form a consecutive sequence starting from 1",
        );
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
