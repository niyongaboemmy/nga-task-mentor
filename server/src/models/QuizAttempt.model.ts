import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { User } from "./User.model";
import Quiz from "./Quiz.model";
import QuizQuestion from "./QuizQuestion.model";
import QuizSubmission from "./QuizSubmission.model";

export type AttemptStatus =
  | "in_progress"
  | "completed"
  | "timed_out"
  | "abandoned";

export interface IQuizAttemptAttributes {
  id?: number;
  quiz_id: number;
  question_id: number;
  student_id: number;
  submission_id?: number; // Optional - set when part of a complete submission
  submitted_answer?: object; // Normalized submitted answer for comparison
  correct_answer?: object; // Correct answer at time of submission for comparison
  is_correct?: boolean;
  points_earned?: number;
  time_taken?: number; // seconds
  status: AttemptStatus;
  started_at: Date;
  completed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export type QuizAttemptCreationAttributes = Omit<
  IQuizAttemptAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "quiz_attempts",
  timestamps: true,
  underscored: true,
  modelName: "QuizAttempt",
})
export class QuizAttempt extends Model<
  IQuizAttemptAttributes,
  QuizAttemptCreationAttributes
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

  @ForeignKey(() => QuizQuestion)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "question_id",
  })
  question_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "student_id",
  })
  student_id!: number;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "submitted_answer",
  })
  submitted_answer?: object;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "correct_answer",
  })
  correct_answer?: object;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    field: "is_correct",
  })
  is_correct?: boolean;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: "points_earned",
    validate: {
      min: {
        args: [0],
        msg: "Points earned cannot be negative",
      },
    },
  })
  points_earned?: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "time_taken",
    validate: {
      min: {
        args: [0],
        msg: "Time taken cannot be negative",
      },
    },
  })
  time_taken?: number;

  @Column({
    type: DataType.ENUM("in_progress", "completed", "timed_out", "abandoned"),
    allowNull: false,
    defaultValue: "in_progress",
  })
  status!: AttemptStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "started_at",
    defaultValue: DataType.NOW,
  })
  started_at!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "completed_at",
  })
  completed_at?: Date;

  @ForeignKey(() => QuizSubmission)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "submission_id",
  })
  submission_id?: number;

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  @BelongsTo(() => QuizQuestion, "question_id")
  question!: QuizQuestion;

  @BelongsTo(() => User, "student_id")
  student!: User;

  @BelongsTo(() => QuizSubmission, "submission_id")
  submission!: QuizSubmission;
}

export default QuizAttempt;
