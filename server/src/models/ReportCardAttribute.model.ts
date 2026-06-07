import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { ReportCard } from "./ReportCard.model";

export type AttributeRating = "Excellent" | "Very good" | "Good";

export interface IReportCardAttributeAttributes {
  id?: number;
  report_card_id: number;
  attribute_name: string;
  rating: AttributeRating;
  created_at?: Date;
  updated_at?: Date;
}

export type ReportCardAttributeCreationAttributes = Omit<
  IReportCardAttributeAttributes,
  "id" | "created_at" | "updated_at"
>;

const VALID_RATINGS: AttributeRating[] = ["Excellent", "Very good", "Good"];

@Table({
  tableName: "report_card_attributes",
  timestamps: true,
  underscored: true,
  modelName: "ReportCardAttribute",
})
export class ReportCardAttribute extends Model<
  IReportCardAttributeAttributes,
  ReportCardAttributeCreationAttributes
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
    type: DataType.STRING(100),
    allowNull: false,
    field: "attribute_name",
    validate: {
      notEmpty: { msg: "Attribute name is required" },
      len: {
        args: [1, 100],
        msg: "Attribute name must be between 1 and 100 characters",
      },
    },
  })
  public attribute_name!: string;

  @Column({
    type: DataType.ENUM("Excellent", "Very good", "Good"),
    allowNull: false,
    validate: {
      notNull: { msg: "Rating is required" },
      isIn: {
        args: [VALID_RATINGS],
        msg: "Rating must be one of: Excellent, Very good, Good",
      },
    },
  })
  public rating!: AttributeRating;

  @BelongsTo(() => ReportCard, "report_card_id")
  public reportCard!: ReportCard;

  static validate(attr: ReportCardAttributeCreationAttributes): void {
    if (!attr.report_card_id) {
      throw new Error("Report card ID is required");
    }
    if (!attr.attribute_name || attr.attribute_name.trim().length === 0) {
      throw new Error("Attribute name is required");
    }
    if (!VALID_RATINGS.includes(attr.rating)) {
      throw new Error("Rating must be one of: Excellent, Very good, Good");
    }
  }
}

export default ReportCardAttribute;
