import { Table, Column, Model, DataType } from "sequelize-typescript";
import type { AssessmentType, AssessmentCategory } from "./ReportCardAssessment.model";

/**
 * The canonical, subject-wide assessment→category mapping for a
 * (subject, term, academic_year). One instructor maps their subject's
 * quizzes/assignments/manual entries into CW/HW/MD/EOT ONCE here; saving a
 * new mapping fans out and rewrites every enrolled student's
 * ReportCardAssessment rows (see reportCard.controller.ts::saveSubjectMapping)
 * so the existing per-student grading/PDF/annual pipeline needs no changes —
 * it still reads ReportCardAssessment exactly as before. This table exists
 * purely to hold the one canonical copy the builder UI edits and to know
 * "what does this subject's report card currently look like" without having
 * to pick an arbitrary student's card to inspect.
 */
export interface ISubjectAssessmentMappingAttributes {
  id?: number;
  subject_id: number;
  term: string;
  academic_year: string;
  assessment_type: AssessmentType;
  assessment_id: number;
  category: AssessmentCategory;
  created_by: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export type SubjectAssessmentMappingCreationAttributes = Omit<
  ISubjectAssessmentMappingAttributes,
  "id" | "created_at" | "updated_at"
>;

const VALID_ASSESSMENT_TYPES: AssessmentType[] = ["quiz", "assignment", "manual"];
const VALID_CATEGORIES: AssessmentCategory[] = ["CW", "HW", "MD", "EOT"];

@Table({
  tableName: "subject_assessment_mappings",
  timestamps: true,
  underscored: true,
  modelName: "SubjectAssessmentMapping",
})
export class SubjectAssessmentMapping extends Model<
  ISubjectAssessmentMappingAttributes,
  SubjectAssessmentMappingCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "subject_id",
  })
  public subject_id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  public term!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: "academic_year",
  })
  public academic_year!: string;

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

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "created_by",
  })
  public created_by!: number | null;
}

export default SubjectAssessmentMapping;
