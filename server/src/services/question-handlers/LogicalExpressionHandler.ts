import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class LogicalExpressionHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "logical_expression";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const variables: any[] = [];
    let correct_expression = "";
    const truth_table: any[] = [];

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("variable:")) {
        const content = textOnly.replace(/^variable:\s*/i, "").trim();
        const parts = content.split(",").map((s) => s.trim());
        const variable: any = { type: "boolean" };

        parts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          if (key.trim() === "name") variable.name = val;
          if (key.trim() === "description") variable.description = val;
          if (key.trim() === "type") variable.type = val;
        });

        if (variable.name) {
          variables.push(variable);
        }
      } else if (lowerText.startsWith("correct expression:")) {
        correct_expression = textOnly
          .replace(/^correct expression:\s*/i, "")
          .trim();
      } else if (lowerText.startsWith("truth table:")) {
        const content = textOnly.replace(/^truth table:\s*/i, "").trim();
        // Syntax: A=true, B=false -> true
        const [inputsStr, outputStr] = content.split("->").map((s) => s.trim());
        const inputsParts = inputsStr.split(",").map((s) => s.trim());
        const inputs: Record<string, any> = {};

        inputsParts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          inputs[key.trim()] =
            val === "true" ? true : val === "false" ? false : val;
        });

        const output = outputStr === "true";
        truth_table.push({ inputs, output });
      }
    }

    return {
      question_data: {
        expression_format: questionText || "",
        variables,
        truth_table,
        correct_expression,
      },
      correct_answer: { expression: correct_expression },
    };
  }
}
