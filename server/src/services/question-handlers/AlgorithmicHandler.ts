import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class AlgorithmicHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "algorithmic";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const test_cases: any[] = [];
    let algorithm_code = "";
    let input_format = "";
    let output_format = "";
    let constraints = "";
    let isParsingCode = false;

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("code:")) {
        algorithm_code = p.replace(/^(<[^>]*>)*code:\s*/i, "").trim();
        isParsingCode = true;
      } else if (lowerText.startsWith("input format:")) {
        input_format = p.replace(/^(<[^>]*>)*input format:\s*/i, "").trim();
        isParsingCode = false;
      } else if (lowerText.startsWith("output format:")) {
        output_format = p.replace(/^(<[^>]*>)*output format:\s*/i, "").trim();
        isParsingCode = false;
      } else if (lowerText.startsWith("constraints:")) {
        constraints = p.replace(/^(<[^>]*>)*constraints:\s*/i, "").trim();
        isParsingCode = false;
      } else if (lowerText.startsWith("test case:")) {
        isParsingCode = false;
        const content = textOnly.replace(/^test case:\s*/i, "").trim();
        // Simple comma-separated key-value pairs: input=X, expected=Y, points=Z
        const parts = content.split(",").map((s) => s.trim());
        const testCase: any = {
          id: `tc-${test_cases.length + 1}`,
          is_hidden: false,
          points: 10,
        };

        parts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          if (key.trim() === "input") testCase.input = val;
          if (key.trim() === "expected") testCase.expected_output = val;
          if (key.trim() === "points") testCase.points = parseInt(val) || 10;
          if (key.trim() === "is_hidden")
            testCase.is_hidden = val.toLowerCase() === "true";
          if (key.trim() === "explanation") testCase.explanation = val;
        });

        if (testCase.input && testCase.expected_output) {
          test_cases.push(testCase);
        }
      } else if (isParsingCode) {
        algorithm_code += (algorithm_code ? "\n" : "") + p;
      }
    }

    return {
      question_data: {
        algorithm_description: questionText || "",
        algorithm_code: algorithm_code.replace(/<br\s*\/?>/gi, "\n"),
        input_format,
        output_format,
        constraints,
        test_cases,
      },
      correct_answer: { test_cases },
    };
  }
}
