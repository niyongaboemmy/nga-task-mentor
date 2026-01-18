import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  BeforeSave,
  BeforeUpdate,
} from "sequelize-typescript";
import { Assignment } from "./Assignment.model";
import { User } from "./User.model";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "late"
  | "graded"
  | "resubmitted";

export interface IFileSubmission {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

export interface IResubmission {
  text?: string;
  files?: IFileSubmission[];
  submittedAt: string;
  feedback?: string;
}

export interface IComment {
  author: string;
  authorId: number;
  content: string;
  createdAt: string;
  isInstructor: boolean;
}

export interface ISubmissionAttributes {
  id?: number;
  assignment_id: number;
  student_id: number;
  status: SubmissionStatus;
  submitted_at?: Date;
  text_submission?: string | null;
  file_submissions?: IFileSubmission[] | null;
  grade?: string | null;
  feedback?: string | null;
  resubmissions?: IResubmission[];
  is_late: boolean;
  comments?: IComment[];
  rubric_scores?: Record<number, number> | null;
  created_at?: Date;
  updated_at?: Date;
}

export type SubmissionCreationAttributes = Omit<
  ISubmissionAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "submissions",
  timestamps: true,
  underscored: true,
  modelName: "Submission",
  indexes: [
    {
      unique: true,
      fields: ["assignment_id", "student_id"],
      name: "unique_assignment_student",
    },
    { fields: ["student_id"] },
    { fields: ["assignment_id"] },
    { fields: ["status"] },
    { fields: ["submitted_at"] },
  ],
})
export class Submission extends Model<
  ISubmissionAttributes,
  SubmissionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @ForeignKey(() => Assignment)
  @Column(DataType.INTEGER)
  public assignment_id!: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  public student_id!: number;

  @Column({
    type: DataType.ENUM("draft", "submitted", "late", "graded", "resubmitted"),
    allowNull: false,
    defaultValue: "draft",
  })
  public status!: SubmissionStatus;

  @Column(DataType.DATE)
  public submitted_at?: Date;

  @Column(DataType.TEXT)
  public text_submission?: string | null;

  @Column(DataType.JSON)
  public file_submissions?: IFileSubmission[] | null;

  @Column(DataType.TEXT)
  public grade?: string | null;

  @Column(DataType.TEXT)
  public feedback?: string | null;

  @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  public resubmissions?: IResubmission[];

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  public is_late!: boolean;

  @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  public comments?: IComment[];

  @Column({
    type: DataType.JSON,
    allowNull: true,
    field: "rubric_scores",
  })
  public rubric_scores?: Record<number, number> | null;

  // Associations
  @BelongsTo(() => Assignment, "assignment_id")
  public assignment!: Assignment;

  @BelongsTo(() => User, "student_id")
  public student!: User;

  // Add validation methods
  static validateSubmission(submission: ISubmissionAttributes): void {
    // Only validate file_submissions if they are actually provided as an array
    if (
      submission.file_submissions !== null &&
      submission.file_submissions !== undefined &&
      Array.isArray(submission.file_submissions)
    ) {
      for (const file of submission.file_submissions) {
        if (!file || typeof file !== "object") {
          throw new Error("Each file must be an object");
        }
        if (!file.filename || typeof file.filename !== "string") {
          throw new Error("Each file must have a filename");
        }
        if (!file.path || typeof file.path !== "string") {
          throw new Error("Each file must have a path");
        }
      }
    }

    if (submission.grade) {
      // Validate grade string format (e.g., "85/100")
      if (typeof submission.grade !== "string") {
        throw new Error("Grade must be a string");
      }

      const gradeParts = submission.grade.split("/");
      if (gradeParts.length !== 2) {
        throw new Error('Grade must be in format "score/maxScore"');
      }

      const score = parseFloat(gradeParts[0]);
      const maxScore = parseFloat(gradeParts[1]);

      if (isNaN(score) || score < 0) {
        throw new Error("Score must be a non-negative number");
      }

      if (isNaN(maxScore) || maxScore <= 0) {
        throw new Error("Max score must be a positive number");
      }

      if (score > maxScore) {
        throw new Error("Score cannot exceed max score");
      }
    }
  }

  // Hooks
  @BeforeSave
  @BeforeUpdate
  protected static async validateBeforeSave(
    instance: Submission,
  ): Promise<void> {
    try {
      // Only validate basic field types, not submission content unless it's a new record or status change
      await Submission.validateSubmission(instance);

      // Only run comprehensive validation for new submissions or when status is being changed
      if (instance.isNewRecord || instance.changed("status")) {
        if (
          instance.status === "submitted" ||
          instance.status === "resubmitted"
        ) {
          if (!instance.submitted_at) {
            instance.submitted_at = new Date();
          }

          const assignment =
            instance.assignment ||
            (await Assignment.findByPk(instance.assignment_id));

          if (assignment) {
            instance.is_late =
              instance.submitted_at > (assignment as any).due_date;

            const submissionType = (assignment as any).submission_type;
            if (
              (submissionType === "text" || submissionType === "both") &&
              !instance.text_submission?.trim()
            ) {
              throw new Error("Text submission is required");
            }

            if (
              (submissionType === "file" || submissionType === "both") &&
              (!instance.file_submissions ||
                instance.file_submissions.length === 0)
            ) {
              throw new Error("File submission is required");
            }

            const allowedFileTypes = (assignment as any).allowed_file_types;
            if (allowedFileTypes && instance.file_submissions?.length) {
              for (const file of instance.file_submissions) {
                const fileExt = file.originalname
                  .split(".")
                  .pop()
                  ?.toLowerCase();
                if (!fileExt || !allowedFileTypes.includes(`.${fileExt}`)) {
                  throw new Error(`File type .${fileExt} is not allowed`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in Submission validateBeforeSave:", error);
      throw error;
    }
  }
}

export default Submission;
