import { IQuestionHandler } from "./IQuestionHandler";
import { QuestionType } from "../../types/quiz.types";

export class DragDropHandler implements IQuestionHandler {
  supports(type: QuestionType): boolean {
    return type === "drag_drop";
  }

  handle(
    paragraphs: string[],
    questionText?: string,
  ): { question_data: any; correct_answer?: any } {
    const drop_zones: any[] = [];
    const draggable_items: any[] = [];
    let background_image = "";
    const placements: Record<string, string> = {};

    for (const p of paragraphs) {
      const textOnly = p.replace(/<[^>]*>/g, "").trim();
      const lowerText = textOnly.toLowerCase();

      if (lowerText.startsWith("background:")) {
        background_image = textOnly.replace(/^background:\s*/i, "").trim();
      } else if (lowerText.startsWith("draggable:")) {
        const content = textOnly.replace(/^draggable:\s*/i, "").trim();
        const parts = content.split(",").map((s) => s.trim());
        const item: any = {};

        parts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          if (key.trim() === "id") item.id = val;
          if (key.trim() === "text") item.text = val;
          if (key.trim() === "value") item.value = val;
          if (key.trim() === "image") item.image = val;
        });

        if (item.id) {
          draggable_items.push(item);
        }
      } else if (lowerText.startsWith("drop zone:")) {
        const content = textOnly.replace(/^drop zone:\s*/i, "").trim();
        const parts = content.split(",").map((s) => s.trim());
        const zone: any = { correct_items: [] };

        parts.forEach((part) => {
          const [key, ...valParts] = part.split("=");
          const val = valParts.join("=").trim();
          if (key.trim() === "id") zone.id = val;
          if (key.trim() === "x") zone.x = parseInt(val) || 0;
          if (key.trim() === "y") zone.y = parseInt(val) || 0;
          if (key.trim() === "width") zone.width = parseInt(val) || 100;
          if (key.trim() === "height") zone.height = parseInt(val) || 50;
          if (key.trim() === "label") zone.label = val;
          if (key.trim() === "correct")
            zone.correct_items = val.split("|").map((s) => s.trim());
        });

        if (zone.id) {
          drop_zones.push(zone);
          // For correct_answer, we need to map zone_id -> item_id
          if (zone.correct_items.length > 0) {
            placements[zone.id] = zone.correct_items[0];
          }
        }
      }
    }

    return {
      question_data: {
        background_image,
        drop_zones,
        draggable_items,
      },
      correct_answer: { placements },
    };
  }
}
