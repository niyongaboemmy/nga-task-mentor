import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
} from "sequelize-typescript";
import { ManualAssessmentScore } from "./ManualAssessmentScore.model";

export interface IManualAssessmentAttributes {
  id?: number;
  course_id: number;
  title: string;
  max_score: number;
  term: string;
  academic_year: string;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export type ManualAssessmentCreationAttributes = Omit<
  IManualAssessmentAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "manual_assessments",
  timestamps: true,
  underscored: true,
  modelName: "ManualAssessment",
})
export class ManualAssessment extends Model<
  IManualAssessmentAttributes,
  ManualAssessmentCreationAttributes
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
    field: "course_id",
  })
  public course_id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    validate: { notEmpty: true },
  })
  public title!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: "max_score",
    validate: { min: 1 },
  })
  public max_score!: number;

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
    type: DataType.INTEGER,
    allowNull: true,
    field: "created_by",
  })
  public created_by!: number | null;

  @HasMany(() => ManualAssessmentScore, "manual_assessment_id")
  public scores!: ManualAssessmentScore[];
}

export default ManualAssessment;
