import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class CodingHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "coding";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const test_cases: any[] = [];
    let starter_code = "";
    let language = "javascript";
    let constraints = "";
    let time_limit = 5;
    let memory_limit = 256;
    let isParsingCode = false;

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("language:")) {
        language = p
          .replace(/^(<[^>]*>)*language:\s*/i, "")
          .trim()
          .toLowerCase();
        isParsingCode = false;
      } else if (
        lowerText.startsWith("starter code:") ||
        lowerText.startsWith("code:")
      ) {
        starter_code = p
          .replace(/^(<[^>]*>)*(starter code|code):\s*/i, "")
          .trim();
        isParsingCode = true;
      } else if (lowerText.startsWith("constraints:")) {
        constraints = p.replace(/^(<[^>]*>)*constraints:\s*/i, "").trim();
        isParsingCode = false;
      } else if (lowerText.startsWith("time limit:")) {
        const val = p.replace(/^(<[^>]*>)*time limit:\s*/i, "").trim();
        time_limit = parseInt(val) || 5;
        isParsingCode = false;
      } else if (lowerText.startsWith("memory limit:")) {
        const val = p.replace(/^(<[^>]*>)*memory limit:\s*/i, "").trim();
        memory_limit = parseInt(val) || 256;
        isParsingCode = false;
      } else if (lowerText.startsWith("test case:")) {
        isParsingCode = false;
        const content = textOnly.replace(/^test case:\s*/i, "").trim();
        // Format: input=X, expected=Y, points=Z, is_hidden=true/false
        const parts = content.split(",").map((s) => s.trim());
        const testCase: any = {
          id: `tc-${test_cases.length + 1}`,
          is_hidden: false,
          points: 10,
        };

        parts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          const lowerKey = key.trim().toLowerCase();

          if (lowerKey === "input") testCase.input = val;
          if (lowerKey === "expected" || lowerKey === "output")
            testCase.expected_output = val;
          if (lowerKey === "points") testCase.points = parseInt(val) || 10;
          if (lowerKey === "is_hidden" || lowerKey === "hidden")
            testCase.is_hidden = val.toLowerCase() === "true";
          if (lowerKey === "explanation") testCase.explanation = val;
        });

        if (testCase.expected_output !== undefined) {
          test_cases.push(testCase);
        }
      } else if (isParsingCode) {
        starter_code += (starter_code ? "\n" : "") + p;
      }
    }

    return {
      question_data: {
        description: questionText || "",
        starter_code: starter_code.replace(/<br\s*\/?>/gi, "\n"),
        language,
        constraints,
        time_limit,
        memory_limit,
        test_cases,
      },
      correct_answer: { test_cases },
    };
  }
}
