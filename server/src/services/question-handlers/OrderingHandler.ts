import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class OrderingHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "ordering";
  }

  handle(paragraphs: string[]): { question_data: any; correct_answer?: any } {
    const items: any[] = [];

    for (const p of paragraphs) {
      // Find digit followed by punctuation at the start of original paragraph
      // Even if wrapped in simple HTML tags like <p> or <strong>
      const match = p.match(/^((?:<[^>]*>)*)\s*(\d+)[.\)-]\s*/i);
      if (match) {
        const order = parseInt(match[2]);
        const cleanHtml = p.replace(/^((?:<[^>]*>)*)\s*\d+[.\)-]\s*/i, "$1");

        items.push({
          id: Math.random().toString(36).substring(2, 11),
          text: cleanHtml,
          order,
        });
      }
    }

    // The order they appear in the doc is usually the correct order,
    // but we use the explicit numbers if provided.
    const orderedItems = [...items].sort((a, b) => a.order - b.order);
    const orderedItemIds = orderedItems.map((it) => it.id);

    return {
      question_data: { items: orderedItems },
      correct_answer: { ordered_item_ids: orderedItemIds },
    };
  }
}
