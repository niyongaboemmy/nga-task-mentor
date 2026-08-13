import {
  Circle,
  CheckSquare,
  CheckCircle2,
  PenLine,
  Link2,
  Hash,
  MessageSquare,
  ListOrdered,
  ChevronDownSquare,
  Code2,
  Settings2,
  Move,
  Puzzle,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { QuestionType } from "../../types/quiz.types";

export const QUESTION_TYPE_ICONS: Record<QuestionType, LucideIcon> = {
  single_choice: Circle,
  multiple_choice: CheckSquare,
  true_false: CheckCircle2,
  fill_blank: PenLine,
  matching: Link2,
  numerical: Hash,
  short_answer: MessageSquare,
  ordering: ListOrdered,
  dropdown: ChevronDownSquare,
  coding: Code2,
  algorithmic: Settings2,
  drag_drop: Move,
  logical_expression: Puzzle,
};

export function getQuestionTypeIcon(type: QuestionType): LucideIcon {
  return QUESTION_TYPE_ICONS[type] ?? HelpCircle;
}
