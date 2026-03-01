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
        // Syntax: A=true, B=false -> true OR A=true[B]B=false -> true (tab or comma)
        const [inputsStr, outputStr] = content
          .split(/->|\u2192/)
          .map((s) => s.trim());

        console.log("Truth table parse:", { inputsStr, outputStr });

        // Support comma, tab, and pipe as separators
        const inputsParts = inputsStr
          .split(/[,\t|]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const inputs: Record<string, any> = {};

        inputsParts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const trimmedKey = key.trim();
          const val = valParts.join("=").trim();
          if (trimmedKey) {
            inputs[trimmedKey] =
              val === "true" ? true : val === "false" ? false : val;
          }
        });

        console.log("Parsed inputs:", inputs, "outputStr:", outputStr);
        const output = outputStr?.toLowerCase().trim() === "true";
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
