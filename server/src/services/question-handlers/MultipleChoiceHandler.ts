import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class MultipleChoiceHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "multiple_choice";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    const options: string[] = [];
    const optionIdentifiers: string[] = [];
    let correctChars: string[] = [];

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("correct:")) {
        const val = textOnly.replace(/^correct:/i, "").trim();
        correctChars = val.split(",").map((v) => v.trim().toUpperCase());
      } else {
        const match = textOnly.match(/^([a-z0-9])[\.\)\-]\s*(.*)/i);
        if (match) {
          const letter = match[1].toUpperCase();
          // Try to strip the identifier from the HTML while-preserving tags correctly
          // Matches from start: optional tags, then identifier (letter+sep), then optional closing tags, then whitespace
          const cleanHtml = p.replace(
            /^(<[^>]*>)*[a-z0-9][\.\)\-]\s*(<\/[^>]*>)*\s*/i,
            "",
          );
          options.push(cleanHtml);
          optionIdentifiers.push(letter);
        } else {
          options.push(p);
          optionIdentifiers.push("");
        }
      }
    }

    const correctIndices: number[] = [];
    optionIdentifiers.forEach((id, idx) => {
      if (id && correctChars.includes(id)) {
        correctIndices.push(idx);
      }
    });

    return {
      question_data: { options, correct_option_indices: correctIndices },
      correct_answer: { correct_option_indices: correctIndices },
    };
  }
}
