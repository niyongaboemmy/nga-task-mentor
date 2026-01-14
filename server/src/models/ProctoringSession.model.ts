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
import { Quiz } from "./Quiz.model";
import ProctoringEvent from "./ProctoringEvent.model";

export type ProctoringStatus =
  | "setup"
  | "active"
  | "paused"
  | "completed"
  | "terminated"
  | "flagged";

export type ProctoringMode =
  | "live_proctoring"
  | "automated_proctoring"
  | "record_review";

export interface IProctoringSessionAttributes {
  id?: number;
  quiz_id: number;
  student_id: number;
  proctor_id?: number; // For live proctoring
  session_token: string;
  status: ProctoringStatus;
  mode: ProctoringMode;
  start_time: Date;
  end_time?: Date;
  duration_minutes?: number;
  browser_info?: string;
  system_info?: string;
  ip_address?: string;
  location_data?: string;
  identity_verified: boolean;
  environment_verified: boolean;
  flags_count: number;
  risk_score: number; // 0-100, higher = more suspicious
  recording_url?: string;
  notes?: string;
  is_connected: boolean; // Track if student is currently connected
  last_connection_time?: Date; // Track when student last connected
  created_at?: Date;
  updated_at?: Date;
}

export type ProctoringSessionCreationAttributes = Omit<
  IProctoringSessionAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "proctoring_sessions",
  timestamps: true,
  underscored: true,
  modelName: "ProctoringSession",
})
export class ProctoringSession extends Model<
  IProctoringSessionAttributes,
  ProctoringSessionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @ForeignKey(() => Quiz)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "quiz_id",
  })
  quiz_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "student_id",
  })
  student_id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "proctor_id",
  })
  proctor_id?: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
    field: "session_token",
  })
  session_token!: string;

  @Column({
    type: DataType.ENUM(
      "setup",
      "active",
      "paused",
      "completed",
      "terminated",
      "flagged"
    ),
    allowNull: false,
    defaultValue: "setup",
  })
  status!: ProctoringStatus;

  @Column({
    type: DataType.ENUM(
      "live_proctoring",
      "automated_proctoring",
      "record_review"
    ),
    allowNull: false,
    defaultValue: "automated_proctoring",
  })
  mode!: ProctoringMode;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "start_time",
  })
  start_time!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "end_time",
  })
  end_time?: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "duration_minutes",
  })
  duration_minutes?: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "browser_info",
  })
  browser_info?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "system_info",
  })
  system_info?: string;

  @Column({
    type: DataType.STRING(45),
    allowNull: true,
    field: "ip_address",
  })
  ip_address?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "location_data",
  })
  location_data?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "identity_verified",
  })
  identity_verified!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "environment_verified",
  })
  environment_verified!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: "flags_count",
  })
  flags_count!: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    field: "risk_score",
    validate: {
      min: 0,
      max: 100,
    },
  })
  risk_score!: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "recording_url",
  })
  recording_url?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "notes",
  })
  notes?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "is_connected",
  })
  is_connected!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "last_connection_time",
  })
  last_connection_time?: Date;

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  @BelongsTo(() => User, "student_id")
  student!: User;

  @BelongsTo(() => User, "proctor_id")
  proctor?: User;

  @HasMany(() => ProctoringEvent, "session_id")
  events!: ProctoringEvent[];

  // Virtual getters
  get is_active(): boolean {
    return this.status === "active";
  }

  get is_completed(): boolean {
    return ["completed", "terminated"].includes(this.status);
  }

  get risk_level(): "low" | "medium" | "high" | "critical" {
    if (this.risk_score >= 80) return "critical";
    if (this.risk_score >= 60) return "high";
    if (this.risk_score >= 30) return "medium";
    return "low";
  }

  get duration_seconds(): number {
    if (this.end_time && this.start_time) {
      return Math.floor(
        (this.end_time.getTime() - this.start_time.getTime()) / 1000
      );
    }
    return 0;
  }
}

export default ProctoringSession;
