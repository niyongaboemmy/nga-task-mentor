import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import { User } from "./User.model";
import Quiz from "./Quiz.model";
import QuizAttempt from "./QuizAttempt.model";

export type QuizSubmissionStatus =
  | "in_progress"
  | "completed"
  | "timed_out"
  | "abandoned";
export type GradeStatus = "pending" | "graded" | "auto_graded";

export interface IQuizSubmissionAttributes {
  id?: number;
  quiz_id: number;
  student_id: number;
  total_score: number;
  max_score: number;
  percentage: number;
  status: QuizSubmissionStatus;
  grade_status: GradeStatus;
  time_taken: number; // total seconds
  started_at: Date;
  end_time?: Date; // calculated end time based on quiz duration
  completed_at?: Date;
  graded_at?: Date;
  graded_by?: number; // instructor who graded (for manual grading)
  feedback?: string;
  passed: boolean;
  attempt_number: number;
  created_at?: Date;
  updated_at?: Date;
}

export type QuizSubmissionCreationAttributes = Omit<
  IQuizSubmissionAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "quiz_submissions",
  timestamps: true,
  underscored: true,
  modelName: "QuizSubmission",
})
export class QuizSubmission extends Model<
  IQuizSubmissionAttributes,
  QuizSubmissionCreationAttributes
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

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "student_id",
  })
  student_id!: number;

  @Column({
    type: DataType.DECIMAL(8, 2),
    allowNull: false,
    field: "total_score",
    validate: {
      notNull: { msg: "Please provide total score" },
      min: {
        args: [0],
        msg: "Total score cannot be negative",
      },
    },
  })
  total_score!: number;

  @Column({
    type: DataType.DECIMAL(8, 2),
    allowNull: false,
    field: "max_score",
    validate: {
      notNull: { msg: "Please provide maximum score" },
      min: {
        args: [0],
        msg: "Maximum score cannot be negative",
      },
    },
  })
  max_score!: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    field: "percentage",
    validate: {
      notNull: { msg: "Please provide percentage" },
      min: {
        args: [0],
        msg: "Percentage cannot be negative",
      },
      max: {
        args: [100],
        msg: "Percentage cannot exceed 100%",
      },
    },
  })
  percentage!: number;

  @Column({
    type: DataType.ENUM("in_progress", "completed", "timed_out", "abandoned"),
    allowNull: false,
    defaultValue: "in_progress",
  })
  status!: QuizSubmissionStatus;

  @Column({
    type: DataType.ENUM("pending", "graded", "auto_graded"),
    allowNull: false,
    defaultValue: "pending",
    field: "grade_status",
  })
  grade_status!: GradeStatus;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "time_taken",
    validate: {
      notNull: { msg: "Please provide time taken" },
      min: {
        args: [0],
        msg: "Time taken cannot be negative",
      },
    },
  })
  time_taken!: number;

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
    field: "end_time",
  })
  end_time?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "completed_at",
  })
  completed_at?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "graded_at",
  })
  graded_at?: Date;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "graded_by",
  })
  graded_by?: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "feedback",
  })
  feedback?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    field: "passed",
  })
  passed!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "attempt_number",
    validate: {
      notNull: { msg: "Please provide attempt number" },
      min: {
        args: [1],
        msg: "Attempt number must be at least 1",
      },
    },
  })
  attempt_number!: number;

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  @BelongsTo(() => User, "student_id")
  student!: User;

  @BelongsTo(() => User, "graded_by")
  grader?: User;

  @HasMany(() => QuizAttempt, "submission_id")
  attempts!: QuizAttempt[];

  // Virtual getters
  get duration_minutes(): number {
    return Math.round(this.time_taken / 60);
  }

  get grade_letter(): string {
    const percentage = this.percentage;
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  }

  get is_late(): boolean {
    if (!this.quiz.end_date) return false;
    return this.completed_at ? this.completed_at > this.quiz.end_date : false;
  }
}

export default QuizSubmission;
