import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Unique,
} from "sequelize-typescript";
import { ManualAssessment } from "./ManualAssessment.model";

export type ManualScoreStatus = "scored" | "absent" | "exempt";

export interface IManualAssessmentScoreAttributes {
  id?: number;
  manual_assessment_id: number;
  student_id: number;
  score: number;
  /** scored (default) | absent (counts as 0) | exempt (left out). */
  status?: ManualScoreStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type ManualAssessmentScoreCreationAttributes = Omit<
  IManualAssessmentScoreAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "manual_assessment_scores",
  timestamps: true,
  underscored: true,
  modelName: "ManualAssessmentScore",
  indexes: [
    { unique: true, fields: ["manual_assessment_id", "student_id"] },
  ],
})
export class ManualAssessmentScore extends Model<
  IManualAssessmentScoreAttributes,
  ManualAssessmentScoreCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @ForeignKey(() => ManualAssessment)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "manual_assessment_id",
  })
  public manual_assessment_id!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "student_id",
  })
  public student_id!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    validate: { min: 0 },
  })
  public score!: number;

  @Column({ type: DataType.ENUM("scored", "absent", "exempt"), allowNull: false, defaultValue: "scored" })
  public status!: ManualScoreStatus;

  @BelongsTo(() => ManualAssessment, "manual_assessment_id")
  public assessment!: ManualAssessment;
}

export default ManualAssessmentScore;
