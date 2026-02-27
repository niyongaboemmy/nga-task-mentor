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
import QuestionBank from "./QuestionBank.model";

export interface IQuizQuestionAttributes {
  id?: number;
  quiz_id: number;
  question_id: number; // FK → question_bank
  order: number;
  points: number;
  time_limit_seconds: number;
  is_required: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type QuizQuestionCreationAttributes = Omit<
  IQuizQuestionAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "quiz_questions",
  timestamps: true,
  underscored: true,
  modelName: "QuizQuestion",
})
export class QuizQuestion extends Model<
  IQuizQuestionAttributes,
  QuizQuestionCreationAttributes
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

  @ForeignKey(() => QuestionBank)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "question_id",
  })
  question_id!: number;

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
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    field: "points",
    defaultValue: 1,
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
    field: "time_limit_seconds",
    defaultValue: 60,
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

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  @BelongsTo(() => QuestionBank, "question_id")
  questionBank!: QuestionBank;

  @HasMany(() => QuizAttempt, "question_id")
  attempts!: QuizAttempt[];
}

export default QuizQuestion;
