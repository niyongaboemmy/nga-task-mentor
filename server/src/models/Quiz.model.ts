import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  HasOne,
} from "sequelize-typescript";
import { User } from "./User.model";
import QuizQuestion from "./QuizQuestion.model";
import QuizAttempt from "./QuizAttempt.model";
import ProctoringSettings from "./ProctoringSettings.model";
import ProctoringSession from "./ProctoringSession.model";

export type QuizStatus = "draft" | "published" | "completed";
export type QuizType = "practice" | "graded" | "exam";

export interface IQuizAttributes {
  id?: number;
  title: string;
  description: string;
  instructions?: string;
  status: QuizStatus;
  type: QuizType;
  time_limit?: number; // in minutes
  max_attempts?: number;
  passing_score?: number; // percentage
  show_results_immediately: boolean;
  randomize_questions: boolean;
  show_correct_answers: boolean;
  enable_automatic_grading: boolean;
  require_manual_grading: boolean;
  start_date?: Date;
  end_date?: Date;
  is_public?: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }> | null;
  course_id?: number | null;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
}

export type QuizCreationAttributes = Omit<
  IQuizAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "quizzes",
  timestamps: true,
  underscored: true,
  modelName: "Quiz",
})
export class Quiz extends Model<IQuizAttributes, QuizCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(200),
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide quiz title" },
      len: {
        args: [1, 200],
        msg: "Quiz title must be between 1 and 200 characters",
      },
    },
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide quiz description" },
      notEmpty: { msg: "Quiz description cannot be empty" },
    },
  })
  description!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "instructions",
  })
  instructions?: string;

  @Column({
    type: DataType.ENUM("draft", "published", "completed"),
    allowNull: false,
    defaultValue: "draft",
  })
  status!: QuizStatus;

  @Column({
    type: DataType.ENUM("practice", "graded", "exam"),
    allowNull: false,
    defaultValue: "practice",
  })
  type!: QuizType;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "time_limit",
    validate: {
      min: {
        args: [1],
        msg: "Time limit must be at least 1 minute",
      },
      max: {
        args: [480],
        msg: "Time limit cannot exceed 480 minutes (8 hours)",
      },
    },
  })
  time_limit?: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "max_attempts",
    validate: {
      min: {
        args: [1],
        msg: "Maximum attempts must be at least 1",
      },
      max: {
        args: [50],
        msg: "Maximum attempts cannot exceed 50",
      },
    },
  })
  max_attempts?: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: "passing_score",
    validate: {
      min: {
        args: [0],
        msg: "Passing score cannot be negative",
      },
      max: {
        args: [100],
        msg: "Passing score cannot exceed 100%",
      },
    },
  })
  passing_score?: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "show_results_immediately",
  })
  show_results_immediately!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "randomize_questions",
  })
  randomize_questions!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "show_correct_answers",
  })
  show_correct_answers!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "enable_automatic_grading",
  })
  enable_automatic_grading!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "require_manual_grading",
  })
  require_manual_grading!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "is_public",
  })
  is_public!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "start_date",
  })
  start_date?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "end_date",
  })
  end_date?: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const parsed = this.getDataValue("attachments");
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed);
        } catch (e) {
          return [];
        }
      }
      return parsed ? parsed : null;
    },
    set(value: Array<any> | null) {
      if (value) {
        this.setDataValue("attachments", JSON.stringify(value));
      } else {
        this.setDataValue("attachments", null);
      }
    },
  })
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }> | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "course_id",
  })
  course_id?: number | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "created_by",
  })
  created_by!: number;

  // Associations
  @BelongsTo(() => User, "created_by")
  creator!: User;

  @HasMany(() => QuizQuestion, "quiz_id")
  questions!: QuizQuestion[];

  @HasMany(() => QuizAttempt, "quiz_id")
  attempts!: QuizAttempt[];

  @HasOne(() => ProctoringSettings, "quiz_id")
  proctoringSettings!: ProctoringSettings;

  @HasMany(() => ProctoringSession, "quiz_id")
  proctoringSessions!: ProctoringSession[];

  // Virtual getters
  get total_questions(): number {
    return this.questions ? this.questions.length : 0;
  }

  get total_points(): number {
    return this.questions
      ? this.questions.reduce(
          (total, question) => total + (question.points || 1),
          0,
        )
      : 0;
  }

  get is_active(): boolean {
    if (this.status !== "published") return false;

    const now = new Date();
    if (this.start_date && now < this.start_date) return false;
    if (this.end_date && now > this.end_date) return false;

    return true;
  }

  get is_available(): boolean {
    // For public quizzes, they are available if published and active
    // For private quizzes, they follow the original logic (published and active)
    if (this.is_public) {
      return this.status === "published" && this.is_active;
    }
    return this.status === "published" && this.is_active;
  }
}

export default Quiz;
