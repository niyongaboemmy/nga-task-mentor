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

export interface IReportCardAttributes {
  id?: number;
  uuid?: string;
  pdf_path?: string | null;
  student_id: number;
  term: string;
  academic_year: string;
  class_teacher_comment?: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  created_at?: Date;
  updated_at?: Date;
}

export type ReportCardCreationAttributes = Omit<
  IReportCardAttributes,
  "id" | "uuid" | "created_at" | "updated_at"
>;

@Table({
  tableName: "report_cards",
  timestamps: true,
  underscored: true,
  modelName: "ReportCard",
})
export class ReportCard extends Model<
  IReportCardAttributes,
  ReportCardCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  public id!: number;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    defaultValue: DataType.UUIDV4,
    unique: true,
    field: "uuid",
  })
  public uuid!: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: true,
    defaultValue: null,
    field: "pdf_path",
  })
  public pdf_path?: string | null;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "student_id",
  })
  public student_id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: { msg: "Term is required" },
      len: { args: [1, 50], msg: "Term must be between 1 and 50 characters" },
    },
  })
  public term!: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    field: "academic_year",
    validate: {
      notEmpty: { msg: "Academic year is required" },
      len: {
        args: [1, 20],
        msg: "Academic year must be between 1 and 20 characters",
      },
    },
  })
  public academic_year!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "class_teacher_comment",
  })
  public class_teacher_comment?: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: "attendance_present",
    validate: {
      min: { args: [0], msg: "Attendance present cannot be negative" },
    },
  })
  public attendance_present!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: "attendance_absent",
    validate: {
      min: { args: [0], msg: "Attendance absent cannot be negative" },
    },
  })
  public attendance_absent!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: "attendance_late",
    validate: {
      min: { args: [0], msg: "Attendance late cannot be negative" },
    },
  })
  public attendance_late!: number;

  @BelongsTo(() => User, "student_id")
  public student!: User;

  get total_school_days(): number {
    return this.attendance_present + this.attendance_absent + this.attendance_late;
  }

  static validate(card: ReportCardCreationAttributes): void {
    if (!card.term || card.term.trim().length === 0) {
      throw new Error("Term is required");
    }
    if (!card.academic_year || card.academic_year.trim().length === 0) {
      throw new Error("Academic year is required");
    }
    if (!card.student_id) {
      throw new Error("Student ID is required");
    }
    if (card.attendance_present < 0) {
      throw new Error("Attendance present cannot be negative");
    }
    if (card.attendance_absent < 0) {
      throw new Error("Attendance absent cannot be negative");
    }
    if (card.attendance_late < 0) {
      throw new Error("Attendance late cannot be negative");
    }
  }
}

export default ReportCard;
