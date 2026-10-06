import { Table, Column, Model, DataType } from "sequelize-typescript";

/**
 * TMCode tables (plan §14, migration 20261006080000-create-tmcode-tables).
 * Snapshot files and telemetry batches are gzip'd JSON in the row.
 */

@Table({ tableName: "tmcode_devices", timestamps: false, modelName: "TmcodeDevice" })
export class TmcodeDevice extends Model {
  @Column({ type: DataType.CHAR(36), primaryKey: true }) id!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column(DataType.STRING(40)) os?: string | null;
  @Column(DataType.STRING(40)) os_version?: string | null;
  @Column(DataType.STRING(16)) arch?: string | null;
  @Column(DataType.STRING(20)) app_version?: string | null;
  @Column(DataType.DATE) first_seen?: Date | null;
  @Column(DataType.DATE) last_seen?: Date | null;
}

@Table({ tableName: "tmcode_launch_tickets", timestamps: false, modelName: "TmcodeLaunchTicket" })
export class TmcodeLaunchTicket extends Model {
  /** SHA-256 hex of the ticket; the ticket itself is never stored. */
  @Column({ type: DataType.CHAR(64), primaryKey: true }) ticket_hash!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) submission_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) quiz_id!: number;
  @Column({ type: DataType.DATE, allowNull: false }) expires_at!: Date;
  @Column({ type: DataType.DATE, allowNull: true }) used_at?: Date | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) created_at!: Date;
}

export type TmcodeSessionStatus = "active" | "superseded" | "revoked" | "ended";

@Table({ tableName: "tmcode_sessions", timestamps: false, modelName: "TmcodeSession" })
export class TmcodeSession extends Model {
  @Column({ type: DataType.CHAR(36), primaryKey: true }) id!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) submission_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) quiz_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column({ type: DataType.CHAR(36), allowNull: false }) device_id!: string;
  @Column({ type: DataType.ENUM("practice", "monitored", "secure"), allowNull: false })
  mode!: "practice" | "monitored" | "secure";
  @Column({
    type: DataType.ENUM("active", "superseded", "revoked", "ended"),
    allowNull: false,
    defaultValue: "active",
  })
  status!: TmcodeSessionStatus;
  /** base64 of 32 random bytes (PROTOCOL.md §4). */
  @Column({ type: DataType.STRING(64), allowNull: false }) journal_nonce!: string;
  /** Head of the snapshot chain: last accepted seq and its hmac. */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) last_seq!: number;
  @Column({ type: DataType.CHAR(64), allowNull: false, defaultValue: "" }) last_hmac!: string;
  @Column({ type: DataType.JSON, allowNull: true }) env_report?: object | null;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false }) seb_verified!: boolean;
  @Column({ type: DataType.INTEGER, allowNull: true }) current_question?: number | null;
  @Column({ type: DataType.STRING(8), allowNull: true }) focus?: string | null;
  @Column({ type: DataType.DATE, allowNull: false }) started_at!: Date;
  @Column({ type: DataType.DATE, allowNull: true }) last_heartbeat?: Date | null;
  @Column({ type: DataType.DATE, allowNull: true }) ended_at?: Date | null;
}

export type SnapshotKind = "auto" | "run" | "final" | "offline_final";

@Table({ tableName: "tmcode_snapshots", timestamps: false, modelName: "TmcodeSnapshot" })
export class TmcodeSnapshot extends Model {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.CHAR(36), allowNull: false }) session_id!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) submission_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) question_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) seq!: number;
  @Column({ type: DataType.ENUM("auto", "run", "final", "offline_final"), allowNull: false })
  kind!: SnapshotKind;
  @Column({ type: DataType.CHAR(64), allowNull: false }) files_hash!: string;
  /** gzip(JSON [{path, content}]) */
  @Column({ type: DataType.BLOB("long"), allowNull: false }) files_gz!: Buffer;
  @Column({ type: DataType.DATE(3), allowNull: false }) client_ts!: Date;
  @Column({ type: DataType.DATE(3), allowNull: false }) server_ts!: Date;
  @Column({ type: DataType.CHAR(64), allowNull: false }) hmac!: string;
}

@Table({ tableName: "tmcode_telemetry", timestamps: false, modelName: "TmcodeTelemetry" })
export class TmcodeTelemetry extends Model {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.CHAR(36), allowNull: false }) session_id!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) seq!: number;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) events!: number;
  /** gzip(JSON TelemetryEvent[]) */
  @Column({ type: DataType.BLOB("long"), allowNull: false }) events_gz!: Buffer;
  @Column({ type: DataType.BIGINT, allowNull: true }) t_from?: number | null;
  @Column({ type: DataType.BIGINT, allowNull: true }) t_to?: number | null;
  @Column({ type: DataType.DATE(3), allowNull: false }) received_at!: Date;
}

@Table({ tableName: "tmcode_flags", timestamps: false, modelName: "TmcodeFlag" })
export class TmcodeFlag extends Model {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.CHAR(36), allowNull: false }) session_id!: string;
  @Column({ type: DataType.INTEGER, allowNull: false }) submission_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: true }) question_id?: number | null;
  @Column({ type: DataType.STRING(40), allowNull: false }) rule!: string;
  @Column({ type: DataType.ENUM("info", "warn", "high"), allowNull: false })
  severity!: "info" | "warn" | "high";
  @Column({ type: DataType.JSON, allowNull: true }) evidence?: object | null;
  @Column({ type: DataType.DATE(3), allowNull: false }) at!: Date;
  @Column({ type: DataType.INTEGER, allowNull: true }) reviewed_by?: number | null;
  @Column({ type: DataType.TEXT, allowNull: true }) review_note?: string | null;
}

export type TmcodeRunStatus = "queued" | "running" | "done" | "error";

@Table({ tableName: "tmcode_runs", timestamps: false, modelName: "TmcodeRun" })
export class TmcodeRun extends Model {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) submission_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) question_id!: number;
  @Column({ type: DataType.BIGINT, allowNull: false }) snapshot_id!: number;
  @Column({
    type: DataType.ENUM("grade", "regrade", "validate_reference", "server_run"),
    allowNull: false,
  })
  purpose!: "grade" | "regrade" | "validate_reference" | "server_run";
  @Column({ type: DataType.STRING(20), allowNull: true }) engine?: string | null;
  @Column({
    type: DataType.ENUM("queued", "running", "done", "error"),
    allowNull: false,
    defaultValue: "queued",
  })
  status!: TmcodeRunStatus;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) attempts!: number;
  @Column({ type: DataType.JSON, allowNull: true }) results?: object | null;
  @Column({ type: DataType.DECIMAL(8, 2), allowNull: true }) score?: number | null;
  @Column({ type: DataType.DECIMAL(8, 2), allowNull: true }) max_score?: number | null;
  @Column({ type: DataType.TEXT, allowNull: true }) error?: string | null;
  @Column({ type: DataType.DATE(3), allowNull: false }) queued_at!: Date;
  @Column({ type: DataType.DATE(3), allowNull: true }) started_at?: Date | null;
  @Column({ type: DataType.DATE(3), allowNull: true }) finished_at?: Date | null;
}

/** Register with sequelize.addModels next to the other models. */
export const TMCODE_MODELS = [
  TmcodeDevice,
  TmcodeLaunchTicket,
  TmcodeSession,
  TmcodeSnapshot,
  TmcodeTelemetry,
  TmcodeFlag,
  TmcodeRun,
];
