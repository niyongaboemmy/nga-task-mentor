import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from "sequelize-typescript";
import { ReportCard } from "./ReportCard.model";

/**
 * Report card workflow tables (migration 20261119100000-report-card-workflow):
 *  - ReportCardSnapshot   one frozen, rendered copy of a card per approval
 *  - ReportCardTransition the audit trail of every status change
 *  - ReportCycle          a class group x term: deadlines, release date, next term
 *  - ReportCycleSubjectSignoff  a subject teacher's "my marks are final" per cycle
 */

@Table({ tableName: "report_card_snapshots", timestamps: true, underscored: true, modelName: "ReportCardSnapshot" })
export class ReportCardSnapshot extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  public id!: number;

  @ForeignKey(() => ReportCard)
  @Column({ type: DataType.INTEGER, allowNull: false, field: "report_card_id" })
  public report_card_id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  public version!: number;

  /** The rendered card (ReportCardDocument in services/reportCardDocument.ts). */
  @Column({ type: DataType.JSON, allowNull: false })
  public payload!: any;

  @Column({ type: DataType.STRING(500), allowNull: true, field: "pdf_path" })
  public pdf_path!: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: "pdf_sha256" })
  public pdf_sha256!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "approved_by" })
  public approved_by!: number | null;

  @Column({ type: DataType.DATE, allowNull: false, field: "approved_at" })
  public approved_at!: Date;

  /** True for a snapshot made after the fact for a card published before snapshots existed. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  public backfilled!: boolean;

  @Column({ type: DataType.DATE, allowNull: true, field: "superseded_at" })
  public superseded_at!: Date | null;

  @Column({ type: DataType.STRING(500), allowNull: true, field: "superseded_reason" })
  public superseded_reason!: string | null;

  @BelongsTo(() => ReportCard, { foreignKey: "report_card_id", constraints: false })
  public reportCard!: ReportCard;
}

@Table({
  tableName: "report_card_transitions",
  timestamps: true,
  updatedAt: false,
  underscored: true,
  modelName: "ReportCardTransition",
})
export class ReportCardTransition extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  public id!: number;

  @ForeignKey(() => ReportCard)
  @Column({ type: DataType.INTEGER, allowNull: false, field: "report_card_id" })
  public report_card_id!: number;

  @Column({ type: DataType.STRING(20), allowNull: false })
  public action!: string;

  @Column({ type: DataType.STRING(20), allowNull: false, field: "from_status" })
  public from_status!: string;

  @Column({ type: DataType.STRING(20), allowNull: false, field: "to_status" })
  public to_status!: string;

  @Column({ type: DataType.INTEGER, allowNull: true })
  public version!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "actor_id" })
  public actor_id!: number | null;

  @Column({ type: DataType.STRING(160), allowNull: true, field: "actor_name" })
  public actor_name!: string | null;

  @Column({ type: DataType.STRING(500), allowNull: true })
  public reason!: string | null;
}

@Table({ tableName: "report_cycles", timestamps: true, underscored: true, modelName: "ReportCycle" })
export class ReportCycle extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  public id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: "class_group_id" })
  public class_group_id!: number;

  @Column({ type: DataType.STRING(120), allowNull: true, field: "class_name" })
  public class_name!: string | null;

  @Column({ type: DataType.STRING(50), allowNull: false })
  public term!: string;

  @Column({ type: DataType.STRING(20), allowNull: false, field: "academic_year" })
  public academic_year!: string;

  @Column({ type: DataType.DATE, allowNull: true, field: "marks_due_at" })
  public marks_due_at!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: "review_due_at" })
  public review_due_at!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: "publish_at" })
  public publish_at!: Date | null;

  @Column({ type: DataType.DATEONLY, allowNull: true, field: "next_term_begins_on" })
  public next_term_begins_on!: string | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "updated_by" })
  public updated_by!: number | null;
}

export type SignoffStatus = "open" | "submitted";

@Table({
  tableName: "report_cycle_subject_signoffs",
  timestamps: true,
  underscored: true,
  modelName: "ReportCycleSubjectSignoff",
})
export class ReportCycleSubjectSignoff extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  public id!: number;

  @ForeignKey(() => ReportCycle)
  @Column({ type: DataType.INTEGER, allowNull: false, field: "cycle_id" })
  public cycle_id!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: "subject_id" })
  public subject_id!: number;

  @Column({ type: DataType.ENUM("open", "submitted"), allowNull: false, defaultValue: "open" })
  public status!: SignoffStatus;

  @Column({ type: DataType.INTEGER, allowNull: true, field: "submitted_by" })
  public submitted_by!: number | null;

  @Column({ type: DataType.STRING(160), allowNull: true, field: "submitted_by_name" })
  public submitted_by_name!: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: "submitted_at" })
  public submitted_at!: Date | null;

  @Column({ type: DataType.STRING(500), allowNull: true, field: "returned_reason" })
  public returned_reason!: string | null;
}
