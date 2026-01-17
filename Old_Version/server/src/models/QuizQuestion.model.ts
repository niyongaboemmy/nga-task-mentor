import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import Quiz from "./Quiz.model";
import QuizAttempt from "./QuizAttempt.model";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "fill_blank"
  | "dropdown"
  | "numerical"
  | "algorithmic"
  | "short_answer"
  | "coding"
  | "logical_expression"
  | "drag_drop"
  | "ordering";

export interface IQuestionAttributes {
  id?: number;
  quiz_id: number;
  question_type: QuestionType;
  question_text: string;
  question_data: object; // JSON data specific to question type
  correct_answer?: object; // JSON data for correct answer
  explanation?: string;
  points: number;
  order: number;
  time_limit_seconds: number; // seconds for this specific question
  is_required: boolean;
  created_by: number; // User who created this question
  created_at?: Date;
  updated_at?: Date;
}

export type QuestionCreationAttributes = Omit<
  IQuestionAttributes,
  "id" | "created_at" | "updated_at"
>;

// Interface for single choice question data
export interface SingleChoiceData {
  options: string[];
  correct_option_index: number;
}

// Interface for multiple choice question data
export interface MultipleChoiceData {
  options: string[];
  correct_option_indices: number[];
}

// Interface for true/false question data
export interface TrueFalseData {
  correct_answer: boolean;
}

// Interface for matching question data
export interface MatchingData {
  left_items: Array<{ id: string; text: string }>;
  right_items: Array<{ id: string; text: string }>;
  correct_matches: Record<string, string>;
}

// Interface for fill-in-the-blank question data
export interface FillBlankData {
  text_with_blanks: string; // Text with {{blank}} placeholders
  acceptable_answers: Array<{ blank_index: number; answers: string[] }>;
}

// Interface for dropdown question data
export interface DropdownData {
  text_with_dropdowns: string; // Text with {{dropdown}} placeholders
  dropdown_options: Array<{ dropdown_index: number; options: string[] }>;
  correct_selections?: string[];
}

// Interface for numerical question data
export interface NumericalData {
  correct_answer: number;
  precision?: number; // decimal places
  tolerance?: number; // allowed margin of error
  units?: string; // expected units
  acceptable_range?: {
    min: number;
    max: number;
  };
}

// Interface for algorithmic question data
export interface AlgorithmicData {
  algorithm_description: string;
  input_format: string;
  output_format: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
    is_hidden: boolean;
  }>;
}

// Interface for short answer question data
export interface ShortAnswerData {
  max_length?: number;
  keywords?: string[]; // for grading assistance
}

// Interface for coding question data
export interface CodingData {
  language: string;
  starter_code?: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
  }>;
  time_limit?: number; // seconds
  memory_limit?: number; // MB
}

// Interface for logical expression question data
export interface LogicalExpressionData {
  expression_format: string; // e.g., "A AND B OR C"
  variables: Array<{ name: string; description: string }>;
  truth_table?: Array<{ inputs: object; output: boolean }>;
}

// Interface for drag and drop question data
export interface DragDropData {
  background_image?: string;
  drop_zones: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    correct_items: string[];
  }>;
  draggable_items: Array<{
    id: string;
    text: string;
    image?: string;
  }>;
}

// Interface for ordering question data
export interface OrderingData {
  items: Array<{ id: string; text: string; image?: string }>;
}

export type QuestionDataType =
  | SingleChoiceData
  | MultipleChoiceData
  | TrueFalseData
  | MatchingData
  | FillBlankData
  | DropdownData
  | NumericalData
  | AlgorithmicData
  | ShortAnswerData
  | CodingData
  | LogicalExpressionData
  | DragDropData
  | OrderingData;

@Table({
  tableName: "quiz_questions",
  timestamps: true,
  underscored: true,
  modelName: "QuizQuestion",
})
export class QuizQuestion extends Model<
  IQuestionAttributes,
  QuestionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @ForeignKey(() => Quiz)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "quiz_id",
  })
  quiz_id!: number;

  @Column({
    type: DataType.ENUM(
      "single_choice",
      "multiple_choice",
      "true_false",
      "matching",
      "fill_blank",
      "dropdown",
      "numerical",
      "algorithmic",
      "short_answer",
      "coding",
      "logical_expression",
      "drag_drop",
      "ordering"
    ),
    allowNull: false,
    field: "question_type",
  })
  question_type!: QuestionType;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: "question_text",
    validate: {
      notNull: { msg: "Please provide question text" },
      notEmpty: { msg: "Question text cannot be empty" },
    },
  })
  question_text!: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    field: "question_data",
    validate: {
      notNull: { msg: "Please provide question data" },
    },
  })
  question_data!: QuestionDataType;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "correct_answer",
  })
  correct_answer?: object;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "explanation",
  })
  explanation?: string;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    field: "points",
    validate: {
      notNull: { msg: "Please provide points for this question" },
      min: {
        args: [0],
        msg: "Points cannot be negative",
      },
      max: {
        args: [100],
        msg: "Points cannot exceed 100",
      },
    },
  })
  points!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "order",
    validate: {
      notNull: { msg: "Please provide question order" },
      min: {
        args: [1],
        msg: "Question order must be at least 1",
      },
    },
  })
  order!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "time_limit_seconds",
    validate: {
      notNull: { msg: "Please provide time limit for this question" },
      min: {
        args: [10],
        msg: "Question time limit must be at least 10 seconds",
      },
      max: {
        args: [3600],
        msg: "Question time limit cannot exceed 1 hour",
      },
    },
  })
  time_limit_seconds!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "is_required",
  })
  is_required!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "created_by",
  })
  created_by!: number;

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  @HasMany(() => QuizAttempt, "question_id")
  attempts!: QuizAttempt[];
}

export default QuizQuestion;
