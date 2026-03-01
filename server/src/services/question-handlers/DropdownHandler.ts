import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class DropdownHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "dropdown";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const dropdown_options: any[] = [];
    const correctly_selected: any[] = [];

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      // Similar to FillBlank, we expect "0: Option 1, Option 2 | Correct"
      // or "Option 1, Option 2, Option 3 (Correct: Option 1)"

      const match = textOnly.match(/^(\d+)[:]\s*(.*)/);
      if (match) {
        const idx = parseInt(match[1]);
        const content = match[2];

        // Check for "Option A, Option B | Correct Option"
        const [optionsStr, correctStr] = content
          .split("|")
          .map((s) => s.trim());
        const options = optionsStr.split(",").map((o) => o.trim());

        dropdown_options.push({
          dropdown_index: idx,
          options: options,
        });

        if (correctStr) {
          correctly_selected.push({
            dropdown_index: idx,
            selected_option: correctStr,
          });
        } else {
          // Default to first option if not specified
          correctly_selected.push({
            dropdown_index: idx,
            selected_option: options[0],
          });
        }
      }
    }

    return {
      question_data: {
        text_with_dropdowns: questionText || "",
        dropdown_options,
      },
      correct_answer: { selections: correctly_selected },
    };
  }
}
