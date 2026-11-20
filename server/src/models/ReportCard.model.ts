import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import { User } from "./User.model";

/** draft -> reviewed -> approved -> published (services/reportCardWorkflow.ts). */
export type ReportCardStatus = "draft" | "reviewed" | "approved" | "published";
export const REPORT_CARD_STATUSES: ReportCardStatus[] = ["draft", "reviewed", "approved", "published"];

export interface IReportCardAttributes {
  id?: number;
  uuid?: string;
  pdf_path?: string | null;
  student_id: number;
  term: string;
  academic_year: string;
  status?: ReportCardStatus;
  class_teacher_comment?: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  attendance_excused?: number;
  attendance_sick?: number;
  attendance_source?: "manual" | "imported";
  /** Behaviour (conduct) mark out of 40, entered by the class teacher; outside every total. */
  behaviour_mark?: number | null;
  version?: number;
  class_group_id?: number | null;
  class_name?: string | null;
  head_teacher_comment?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: Date | null;
  approved_by?: number | null;
  approved_at?: Date | null;
  published_by?: number | null;
  published_at?: Date | null;
  publish_at?: Date | null;
  returned_reason?: string | null;
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
  indexes: [{ unique: true, fields: ["student_id", "term", "academic_year"], name: "uq_report_card" }],
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

  /** The student's MIS user id (legacy cards were re-keyed by the 2026-11-19 migration). */
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
    type: DataType.ENUM("draft", "reviewed", "approved", "published"),
    allowNull: false,
    defaultValue: "draft",
  })
  public status!: ReportCardStatus;

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

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: "attendance_excused" })
  public attendance_excused!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: "attendance_sick" })
  public attendance_sick!: number;

  @Column({ type: DataType.ENUM("manual", "imported"), allowNull: false, defaultValue: "manual", field: "attendance_source" })
  public attendance_source!: "manual" | "imported";

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    field: "behaviour_mark",
    get(this: ReportCard) {
      const v = this.getDataValue("behaviour_mark" as any);
      return v == null ? null : Number(v);
    },
  })
  public behaviour_mark?: number | null;

  /** Bumped on every approval; the snapshot of that approval has this version. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  public version!: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "class_group_id" })
  public class_group_id!: number | null;

  @Column({ type: DataType.STRING(120), allowNull: true, field: "class_name" })
  public class_name!: string | null;

  @Column({ type: DataType.TEXT, allowNull: true, field: "head_teacher_comment" })
  public head_teacher_comment!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "reviewed_by" })
  public reviewed_by!: number | null;
  @Column({ type: DataType.DATE, allowNull: true, field: "reviewed_at" })
  public reviewed_at!: Date | null;
  @Column({ type: DataType.INTEGER, allowNull: true, field: "approved_by" })
  public approved_by!: number | null;
  @Column({ type: DataType.DATE, allowNull: true, field: "approved_at" })
  public approved_at!: Date | null;
  @Column({ type: DataType.INTEGER, allowNull: true, field: "published_by" })
  public published_by!: number | null;
  @Column({ type: DataType.DATE, allowNull: true, field: "published_at" })
  public published_at!: Date | null;
  /** A scheduled release: the publish sweep publishes the card at this time. */
  @Column({ type: DataType.DATE, allowNull: true, field: "publish_at" })
  public publish_at!: Date | null;
  /** Why the card was last returned or reopened to draft. */
  @Column({ type: DataType.STRING(500), allowNull: true, field: "returned_reason" })
  public returned_reason!: string | null;

  @BelongsTo(() => User, { foreignKey: "student_id", constraints: false })
  public student!: User;

  get total_school_days(): number {
    return (
      this.attendance_present + this.attendance_absent + this.attendance_late +
      (this.attendance_excused ?? 0) + (this.attendance_sick ?? 0)
    );
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
