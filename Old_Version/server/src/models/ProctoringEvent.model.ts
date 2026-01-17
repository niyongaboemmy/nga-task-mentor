import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import ProctoringSession from "./ProctoringSession.model";

export type ProctoringEventType =
  | "session_start"
  | "session_end"
  | "identity_verification"
  | "environment_scan"
  | "face_not_visible"
  | "multiple_faces"
  | "looking_away"
  | "tab_switch"
  | "window_minimized"
  | "browser_leave"
  | "suspicious_audio"
  | "device_disconnected"
  | "network_issue"
  | "screen_recording_start"
  | "screen_recording_stop"
  | "manual_flag"
  | "auto_flag"
  | "proctor_message"
  // New event types for specific proctoring rules
  | "fullscreen_exited"
  | "camera_level_low"
  | "microphone_level_low"
  | "speaker_level_low"
  | "mobile_phone_detected"
  | "unauthorized_object_detected";

export type ProctoringEventSeverity = "low" | "medium" | "high" | "critical";

export interface IProctoringEventAttributes {
  id?: number;
  session_id: number;
  event_type: ProctoringEventType;
  severity: ProctoringEventSeverity;
  timestamp: Date;
  description: string;
  metadata?: string; // JSON string with additional event data
  screenshot_url?: string;
  video_timestamp?: number; // Timestamp in video recording
  reviewed: boolean;
  reviewed_by?: number;
  reviewed_at?: Date;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type ProctoringEventCreationAttributes = Omit<
  IProctoringEventAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "proctoring_events",
  timestamps: true,
  underscored: true,
  modelName: "ProctoringEvent",
})
export class ProctoringEvent extends Model<
  IProctoringEventAttributes,
  ProctoringEventCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @ForeignKey(() => ProctoringSession)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "session_id",
  })
  session_id!: number;

  @Column({
    type: DataType.ENUM(
      "session_start",
      "session_end",
      "identity_verification",
      "environment_scan",
      "face_not_visible",
      "multiple_faces",
      "looking_away",
      "tab_switch",
      "window_minimized",
      "browser_leave",
      "suspicious_audio",
      "device_disconnected",
      "network_issue",
      "screen_recording_start",
      "screen_recording_stop",
      "manual_flag",
      "auto_flag",
      "proctor_message",
      // New event types for specific proctoring rules
      "fullscreen_exited",
      "camera_level_low",
      "microphone_level_low",
      "speaker_level_low",
      "mobile_phone_detected",
      "unauthorized_object_detected"
    ),
    allowNull: false,
    field: "event_type",
  })
  event_type!: ProctoringEventType;

  @Column({
    type: DataType.ENUM("low", "medium", "high", "critical"),
    allowNull: false,
    defaultValue: "low",
  })
  severity!: ProctoringEventSeverity;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  timestamp!: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  description!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  metadata?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "screenshot_url",
  })
  screenshot_url?: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "video_timestamp",
  })
  video_timestamp?: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  reviewed!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "reviewed_by",
  })
  reviewed_by?: number;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "reviewed_at",
  })
  reviewed_at?: Date;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes?: string;

  // Associations
  @BelongsTo(() => ProctoringSession, "session_id")
  session!: ProctoringSession;

  // Virtual getters
  get is_suspicious(): boolean {
    return ["high", "critical"].includes(this.severity);
  }

  get metadata_parsed(): any {
    try {
      return this.metadata ? JSON.parse(this.metadata) : {};
    } catch {
      return {};
    }
  }

  set metadata_parsed(value: any) {
    this.metadata = JSON.stringify(value);
  }
}

export default ProctoringEvent;
