import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, DropdownData } from "../../types/quiz.types";

export class DropdownService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "dropdown";
  }

  validate(data: any): ValidationResult {
    const dropdownData = data as DropdownData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !dropdownData.text_with_dropdowns ||
      dropdownData.text_with_dropdowns.trim() === ""
    ) {
      errors.push("Question text is required.");
    } else if (!dropdownData.text_with_dropdowns.includes("{{dropdown}}")) {
      errors.push(
        "Question text must contain at least one {{dropdown}} placeholder.",
      );
    }

    if (
      !dropdownData.dropdown_options ||
      dropdownData.dropdown_options.length === 0
    ) {
      errors.push("Dropdown options must be defined.");
    } else {
      const placeholderCount = (
        dropdownData.text_with_dropdowns.match(/{{dropdown}}/g) || []
      ).length;
      if (dropdownData.dropdown_options.length !== placeholderCount) {
        errors.push(
          `Number of dropdown option sets (${dropdownData.dropdown_options.length}) does not match the number of placeholders (${placeholderCount}) in the text.`,
        );
      }

      dropdownData.dropdown_options.forEach((opt, index) => {
        if (!opt.options || opt.options.length < 1) {
          errors.push(`Dropdown ${index} must have at least one option.`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Dropdown";
  }

  getIconName(): string {
    return "ListOrdered";
  }
}
