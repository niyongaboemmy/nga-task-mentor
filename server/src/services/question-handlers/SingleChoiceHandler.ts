import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class SingleChoiceHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "single_choice";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    const options: string[] = [];
    const optionIdentifiers: string[] = [];
    let correctChar = "";

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("correct:")) {
        correctChar = textOnly
          .replace(/^correct:/i, "")
          .trim()
          .toUpperCase();
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

    const correctIndex = optionIdentifiers.indexOf(correctChar);
    const finalIndex = correctIndex >= 0 ? correctIndex : 0;

    return {
      question_data: { options, correct_option_index: finalIndex },
      correct_answer: { correct_option_index: finalIndex },
    };
  }
}
