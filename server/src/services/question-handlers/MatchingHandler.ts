import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class MatchingHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "matching";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    const left_items: any[] = [];
    const right_items: any[] = [];
    const correct_matches: Record<string, string> = {};

    for (const p of paragraphs) {
      // Match <-> in all forms: raw, fully HTML-encoded, or partially decoded
      // (partial decode happens when &gt; is decoded but &lt; is not)
      const separatorMatch = p.match(/&lt;-&gt;|&lt;->|<->|↔/);
      if (separatorMatch) {
        const separator = separatorMatch[0];
        const parts = p.split(separator).map((s) => s.trim());

        if (parts.length === 2) {
          const leftId = Math.random().toString(36).substring(2, 11);
          const rightId = Math.random().toString(36).substring(2, 11);

          left_items.push({ id: leftId, text: parts[0] });
          right_items.push({ id: rightId, text: parts[1] });
          correct_matches[leftId] = rightId;
        }
      }
    }

    // Shuffle right items to make it a real matching challenge
    const shuffledRight = [...right_items].sort(() => Math.random() - 0.5);

    return {
      question_data: {
        left_items,
        right_items: shuffledRight,
        correct_matches,
      },
      correct_answer: { matches: correct_matches },
    };
  }
}
