import { QuestionType } from "../../types/quiz.types";
import { IQuestionHandler } from "./IQuestionHandler";
import { SingleChoiceHandler } from "./SingleChoiceHandler";
import { MultipleChoiceHandler } from "./MultipleChoiceHandler";
import { TrueFalseHandler } from "./TrueFalseHandler";
import { ShortAnswerHandler } from "./ShortAnswerHandler";
import { MatchingHandler } from "./MatchingHandler";
import { OrderingHandler } from "./OrderingHandler";
import { FillBlankHandler } from "./FillBlankHandler";
import { NumericalHandler } from "./NumericalHandler";
import { DropdownHandler } from "./DropdownHandler";
import { AlgorithmicHandler } from "./AlgorithmicHandler";
import { LogicalExpressionHandler } from "./LogicalExpressionHandler";
import { DragDropHandler } from "./DragDropHandler";
import { CodingHandler } from "./CodingHandler";

export class HandlerFactory {
  private static handlers: IQuestionHandler[] = [
    new SingleChoiceHandler(),
    new MultipleChoiceHandler(),
    new TrueFalseHandler(),
    new ShortAnswerHandler(),
    new MatchingHandler(),
    new OrderingHandler(),
    new FillBlankHandler(),
    new NumericalHandler(),
    new DropdownHandler(),
    new AlgorithmicHandler(),
    new LogicalExpressionHandler(),
    new DragDropHandler(),
    new CodingHandler(),
  ];

  static getHandler(type: QuestionType): IQuestionHandler | undefined {
    return this.handlers.find((h) => h.supports(type));
  }
}
