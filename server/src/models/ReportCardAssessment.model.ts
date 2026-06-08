import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { ReportCard } from "./ReportCard.model";

export type AssessmentType = "quiz" | "assignment" | "manual";
export type AssessmentCategory = "CW" | "HW" | "MD" | "EOT";

export interface IReportCardAssessmentAttributes {
  id?: number;
  report_card_id: number;
  subject_id: number;
  assessment_type: AssessmentType;
  assessment_id: number;
  category: AssessmentCategory;
  created_at?: Date;
  updated_at?: Date;
}

export type ReportCardAssessmentCreationAttributes = Omit<
  IReportCardAssessmentAttributes,
  "id" | "created_at" | "updated_at"
>;

const VALID_ASSESSMENT_TYPES: AssessmentType[] = ["quiz", "assignment", "manual"];
const VALID_CATEGORIES: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];

@Table({
  tableName: "report_card_assessments",
  timestamps: true,
  underscored: true,
  modelName: "ReportCardAssessment",
})
export class ReportCardAssessment extends Model<
  IReportCardAssessmentAttributes,
  ReportCardAssessmentCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @ForeignKey(() => ReportCard)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "report_card_id",
  })
  public report_card_id!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "subject_id",
  })
  public subject_id!: number;

  @Column({
    type: DataType.ENUM("quiz", "assignment", "manual"),
    allowNull: false,
    field: "assessment_type",
    validate: {
      notNull: { msg: "Assessment type is required" },
      isIn: {
        args: [VALID_ASSESSMENT_TYPES],
        msg: "Assessment type must be one of: quiz, assignment, manual",
      },
    },
  })
  public assessment_type!: AssessmentType;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "assessment_id",
  })
  public assessment_id!: number;

  @Column({
    type: DataType.ENUM("CW", "HW", "MD", "EOT"),
    allowNull: false,
    validate: {
      notNull: { msg: "Category is required" },
      isIn: {
        args: [VALID_CATEGORIES],
        msg: "Category must be one of: CW, HW, MD, EOT",
      },
    },
  })
  public category!: AssessmentCategory;

  @BelongsTo(() => ReportCard, "report_card_id")
  public reportCard!: ReportCard;

  static validate(assessment: ReportCardAssessmentCreationAttributes): void {
    if (!assessment.report_card_id) {
      throw new Error("Report card ID is required");
    }
    if (!assessment.subject_id) {
      throw new Error("Subject ID is required");
    }
    if (!VALID_ASSESSMENT_TYPES.includes(assessment.assessment_type)) {
      throw new Error("Assessment type must be one of: quiz, assignment, manual");
    }
    if (!assessment.assessment_id) {
      throw new Error("Assessment ID is required");
    }
    if (!VALID_CATEGORIES.includes(assessment.category)) {
      throw new Error("Category must be one of: CW, HW, MD, EOT");
    }
  }
}

export default ReportCardAssessment;
