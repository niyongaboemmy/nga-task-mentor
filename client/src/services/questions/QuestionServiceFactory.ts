import type { IQuestionService } from "./IQuestionService";
import { SingleChoiceService } from "./SingleChoiceService";
import { MultipleChoiceService } from "./MultipleChoiceService";
import { TrueFalseService } from "./TrueFalseService";
import { ShortAnswerService } from "./ShortAnswerService";
import { MatchingService } from "./MatchingService";
import { OrderingService } from "./OrderingService";
import { FillBlankService } from "./FillBlankService";
import { NumericalService } from "./NumericalService";
import { DropdownService } from "./DropdownService";
import { AlgorithmicService } from "./AlgorithmicService";
import { LogicalExpressionService } from "./LogicalExpressionService";
import { DragDropService } from "./DragDropService";
import type { QuestionType } from "../../types/quiz.types";

export class QuestionServiceFactory {
  private static services: IQuestionService[] = [
    new SingleChoiceService(),
    new MultipleChoiceService(),
    new TrueFalseService(),
    new ShortAnswerService(),
    new MatchingService(),
    new OrderingService(),
    new FillBlankService(),
    new NumericalService(),
    new DropdownService(),
    new AlgorithmicService(),
    new LogicalExpressionService(),
    new DragDropService(),
  ];

  static getService(type: QuestionType): IQuestionService | undefined {
    return this.services.find((s) => s.supports(type));
  }

  static validate(type: QuestionType, data: any) {
    const service = this.getService(type);
    if (!service) {
      return {
        isValid: false,
        errors: [`No validation service found for type: ${type}`],
        warnings: [],
      };
    }
    return service.validate(data);
  }
}
