import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import BloomsTaxonomyLevel from "./BloomsTaxonomyLevel.model";

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

export type DifficultyLevel = "EASY" | "MEDIUM" | "DIFFICULT";

export interface IQuestionBankAttributes {
  id?: number;
  course_id: number; // The course this question belongs to
  question_type: QuestionType;
  question_text: string;
  question_data: object; // JSON data specific to question type
  correct_answer?: object | null; // JSON data for correct answer
  explanation?: string | null;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }> | null;
  created_by: number; // User who created this question
  academic_term_id?: number | null;
  blooms_taxonomy_level_id?: number | null;
  tags?: string[] | null;
  difficulty_level?: DifficultyLevel | null;
  time_limit_seconds?: number | null;
  scheme_of_work_entry_id?: number | null;
  scheme_of_work_entry_title?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type QuestionBankCreationAttributes = Omit<
  IQuestionBankAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "question_bank",
  timestamps: true,
  underscored: true,
  modelName: "QuestionBank",
})
export class QuestionBank extends Model<
  IQuestionBankAttributes,
  QuestionBankCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "course_id",
  })
  course_id!: number;

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
      "ordering",
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
  question_data!: object;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "correct_answer",
  })
  correct_answer?: object | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "explanation",
  })
  explanation?: string | null;

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
    allowNull: false,
    field: "created_by",
  })
  created_by!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
    field: "academic_term_id",
  })
  academic_term_id?: number | null;

  @ForeignKey(() => BloomsTaxonomyLevel)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
    field: "blooms_taxonomy_level_id",
  })
  blooms_taxonomy_level_id?: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    defaultValue: null,
    field: "tags",
    get() {
      const parsed = this.getDataValue("tags");
      if (typeof parsed === "string") {
        try {
          return JSON.parse(parsed);
        } catch (e) {
          return [];
        }
      }
      return parsed ? parsed : null;
    },
    set(value: string[] | null) {
      if (value) {
        this.setDataValue("tags", JSON.stringify(value) as any);
      } else {
        this.setDataValue("tags", null as any);
      }
    },
  })
  tags?: string[] | null;

  @Column({
    type: DataType.ENUM("EASY", "MEDIUM", "DIFFICULT"),
    allowNull: true,
    defaultValue: null,
    field: "difficulty_level",
  })
  difficulty_level?: DifficultyLevel | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: 60,
    field: "time_limit_seconds",
    validate: {
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
  time_limit_seconds?: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
    field: "scheme_of_work_entry_id",
  })
  scheme_of_work_entry_id?: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    defaultValue: null,
    field: "scheme_of_work_entry_title",
  })
  scheme_of_work_entry_title?: string | null;

  // Associations
  @BelongsTo(() => BloomsTaxonomyLevel, "blooms_taxonomy_level_id")
  bloomsLevel?: BloomsTaxonomyLevel;
}

export default QuestionBank;
