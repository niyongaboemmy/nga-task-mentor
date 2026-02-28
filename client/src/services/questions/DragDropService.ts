import type { IQuestionService, ValidationResult } from "./IQuestionService";
import type { QuestionType, DragDropData } from "../../types/quiz.types";

export class DragDropService implements IQuestionService {
  supports(type: QuestionType): boolean {
    return type === "drag_drop";
  }

  validate(data: any): ValidationResult {
    const dragDropData = data as DragDropData;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !dragDropData.draggable_items ||
      dragDropData.draggable_items.length === 0
    ) {
      errors.push("At least one draggable item is required.");
    }

    if (!dragDropData.drop_zones || dragDropData.drop_zones.length === 0) {
      errors.push("At least one drop zone is required.");
    } else {
      const allDraggableIds = (dragDropData.draggable_items || []).map(
        (i) => i.id,
      );

      dragDropData.drop_zones.forEach((zone, index) => {
        if (!zone.id) errors.push(`Drop zone ${index + 1} is missing an ID.`);
        if (!zone.correct_items || zone.correct_items.length === 0) {
          warnings.push(
            `Drop zone ${zone.id || index + 1} has no correct items defined.`,
          );
        } else {
          zone.correct_items.forEach((itemId) => {
            if (!allDraggableIds.includes(itemId)) {
              errors.push(
                `Drop zone ${zone.id} refers to a non-existent draggable item: ${itemId}.`,
              );
            }
          });
        }
      });
    }

    if (!dragDropData.background_image) {
      warnings.push(
        "No background image defined. The question will use a default canvas.",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getLabel(): string {
    return "Drag and Drop";
  }

  getIconName(): string {
    return "Move";
  }
}
