import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import { Course } from "./Course.model";
import { User } from "./User.model";
import { Submission } from "./Submission.model";

export interface IAssignmentAttributes {
  id?: number;
  title: string;
  description: string;
  due_date: Date;
  max_score: number;
  submission_type: "file" | "text" | "both";
  allowed_file_types?: string[] | null;
  rubric?: Array<{
    criteria: string;
    max_score: number;
    description?: string;
  }> | null;
  course_id: number;
  created_by: number | null;
  status: "draft" | "published" | "completed" | "removed";
  created_at?: Date;
  updated_at?: Date;
}

export type AssignmentCreationAttributes = Omit<
  IAssignmentAttributes,
  "id" | "created_at" | "updated_at" | "status"
>;

@Table({
  tableName: "assignments",
  timestamps: true,
  underscored: true,
  modelName: "Assignment",
})
export class Assignment extends Model<
  IAssignmentAttributes,
  AssignmentCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Title is required" },
      len: {
        args: [1, 200],
        msg: "Title must be between 1 and 200 characters",
      },
    },
  })
  public title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Description is required" },
    },
  })
  public description!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "due_date",
    // Removed validation to allow any date (past, present, future)
  })
  public due_date!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "max_score",
    validate: {
      min: {
        args: [0],
        msg: "Maximum score cannot be negative",
      },
      max: {
        args: [1000],
        msg: "Maximum score cannot exceed 1000",
      },
    },
  })
  public max_score!: number;

  @Column({
    type: DataType.ENUM,
    values: ["file", "text", "both"],
    allowNull: false,
    field: "submission_type",
    defaultValue: "both",
    validate: {
      notNull: { msg: "Submission type is required" },
      isIn: {
        args: [["file", "text", "both"]],
        msg: "Submission type must be one of: file, text, or both",
      },
    },
  })
  public submission_type!: "file" | "text" | "both";

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "allowed_file_types",
    validate: {
      isValidFileTypes(value: string[] | null) {
        if (value && !Array.isArray(value)) {
          throw new Error("Allowed file types must be an array of strings");
        }
        if (value && value.some((item) => typeof item !== "string")) {
          throw new Error("All items in allowed_file_types must be strings");
        }
      },
    },
  })
  public allowed_file_types?: string[] | null;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    validate: {
      isValidRubric(
        value: Array<{
          criteria: string;
          max_score: number;
          description?: string;
        }> | null
      ) {
        if (!value) return;

        if (!Array.isArray(value)) {
          throw new Error("Rubric must be an array of objects");
        }

        for (let index = 0; index < value.length; index++) {
          const item = value[index];
          if (!item || typeof item !== "object") {
            throw new Error(`Rubric item at index ${index} must be an object`);
          }
          if (!item.criteria || typeof item.criteria !== "string") {
            throw new Error(
              `Rubric item at index ${index} must have a string 'criteria' property`
            );
          }
          if (typeof item.max_score !== "number" || item.max_score <= 0) {
            throw new Error(
              `Rubric item at index ${index} must have a positive 'max_score' number`
            );
          }
          if (item.description && typeof item.description !== "string") {
            throw new Error(
              `Rubric item at index ${index} description must be a string if provided`
            );
          }
        }
      },
    },
  })
  public rubric?: Array<{
    criteria: string;
    max_score: number;
    description?: string;
  }> | null;

  @ForeignKey(() => Course)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "course_id",
  })
  public course_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "created_by",
  })
  public created_by!: number | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.ENUM,
    values: ["draft", "published", "completed", "removed"],
    allowNull: false,
    field: "status",
    defaultValue: "draft",
  })
  public status!: "draft" | "published" | "completed" | "removed";

  @BelongsTo(() => Course, "course_id")
  public course!: Course;

  @BelongsTo(() => User, "created_by")
  public creator!: User;

  @HasMany(() => Submission, "assignment_id")
  public submissions!: Submission[];

  // Virtual getters
  get is_past_due(): boolean {
    return new Date() > this.due_date;
  }

  async submission_count(): Promise<number> {
    return this.submissions ? this.submissions.length : 0;
  }

  // Add model-level validation (removed due date future check)
  static validate(assignment: Assignment): void {
    if (!assignment.title || assignment.title.trim().length === 0) {
      throw new Error("Please provide assignment title");
    }
    if (assignment.title.length > 200) {
      throw new Error("Title cannot be more than 200 characters");
    }
    if (!assignment.description || assignment.description.trim().length === 0) {
      throw new Error("Please provide assignment description");
    }
    if (!assignment.due_date) {
      throw new Error("Please provide due date");
    }
    // Removed: if (new Date(assignment.due_date) <= new Date()) {
    //   throw new Error("Due date must be in the future");
    // }
  }
}

export default Assignment;
