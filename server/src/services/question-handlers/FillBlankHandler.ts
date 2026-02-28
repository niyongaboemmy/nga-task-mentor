import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class FillBlankHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "fill_blank";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const acceptable_answers: any[] = [];

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("correct:")) {
        const answersStr = textOnly.substring(8).trim();

        // Handle explicit indexing: "0: apple, 1: banana | fruit"
        if (answersStr.includes("0:") || answersStr.includes("1:")) {
          // Robust regex to extract "index: values" pairs
          const matches = answersStr.matchAll(/(\d+)[:]\s*([^,;]+)/g);
          for (const match of matches) {
            const idx = parseInt(match[1]);
            const vals = match[2].split("|").map((v) => v.trim());
            acceptable_answers.push({ blank_index: idx, answers: vals });
          }
        } else {
          // Implicit order: split by comma for different blanks,
          // or assume all are synonyms for the first blank if only one blank exists
          const parts = answersStr.split(",").map((p) => p.trim());
          parts.forEach((val, idx) => {
            acceptable_answers.push({
              blank_index: idx,
              answers: [val],
            });
          });
        }
      }
    }

    return {
      question_data: {
        text_with_blanks: questionText || "",
        acceptable_answers,
      },
      correct_answer: { answers: acceptable_answers },
    };
  }
}
