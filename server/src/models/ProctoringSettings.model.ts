import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Quiz } from "./Quiz.model";

export type ProctoringMode =
  | "automated"
  | "live"
  | "record_review"
  | "disabled";

export interface IProctoringSettingsAttributes {
  id?: number;
  quiz_id: number;
  enabled: boolean;
  mode: ProctoringMode;
  require_identity_verification: boolean;
  require_environment_scan: boolean;
  allow_screen_recording: boolean;
  allow_audio_monitoring: boolean;
  allow_video_monitoring: boolean;
  lockdown_browser: boolean;
  prevent_tab_switching: boolean;
  prevent_window_minimization: boolean;
  prevent_copy_paste: boolean;
  prevent_right_click: boolean;
  max_flags_allowed: number;
  auto_terminate_on_high_risk: boolean;
  risk_threshold: number; // 0-100
  require_proctor_approval: boolean;
  recording_retention_days: number;
  allow_multiple_faces: boolean;
  face_detection_sensitivity: number; // 0-100
  suspicious_behavior_detection: boolean;
  alert_instructors: boolean;
  alert_emails?: string; // Comma-separated email addresses
  custom_instructions?: string;
  // New fields for specific proctoring rules
  require_fullscreen: boolean;
  min_camera_level: number; // 0-100
  min_microphone_level: number; // 0-100
  min_speaker_level: number; // 0-100
  enable_face_detection: boolean;
  enable_object_detection: boolean;
  object_detection_sensitivity: number; // 0-100
  created_at?: Date;
  updated_at?: Date;
}

export type ProctoringSettingsCreationAttributes = Omit<
  IProctoringSettingsAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "proctoring_settings",
  timestamps: true,
  underscored: true,
  modelName: "ProctoringSettings",
})
export class ProctoringSettings extends Model<
  IProctoringSettingsAttributes,
  ProctoringSettingsCreationAttributes
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
    unique: true,
    field: "quiz_id",
  })
  quiz_id!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  enabled!: boolean;

  @Column({
    type: DataType.ENUM("automated", "live", "record_review", "disabled"),
    allowNull: false,
    defaultValue: "automated",
  })
  mode!: ProctoringMode;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "require_identity_verification",
  })
  require_identity_verification!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "require_environment_scan",
  })
  require_environment_scan!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "allow_screen_recording",
  })
  allow_screen_recording!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "allow_audio_monitoring",
  })
  allow_audio_monitoring!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "allow_video_monitoring",
  })
  allow_video_monitoring!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "lockdown_browser",
  })
  lockdown_browser!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "prevent_tab_switching",
  })
  prevent_tab_switching!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "prevent_window_minimization",
  })
  prevent_window_minimization!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "prevent_copy_paste",
  })
  prevent_copy_paste!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "prevent_right_click",
  })
  prevent_right_click!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 5,
    field: "max_flags_allowed",
    validate: {
      min: 0,
      max: 100,
    },
  })
  max_flags_allowed!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "auto_terminate_on_high_risk",
  })
  auto_terminate_on_high_risk!: boolean;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 75,
    field: "risk_threshold",
    validate: {
      min: 0,
      max: 100,
    },
  })
  risk_threshold!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "require_proctor_approval",
  })
  require_proctor_approval!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 90,
    field: "recording_retention_days",
    validate: {
      min: 1,
      max: 365,
    },
  })
  recording_retention_days!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "allow_multiple_faces",
  })
  allow_multiple_faces!: boolean;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 70,
    field: "face_detection_sensitivity",
    validate: {
      min: 0,
      max: 100,
    },
  })
  face_detection_sensitivity!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "suspicious_behavior_detection",
  })
  suspicious_behavior_detection!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "alert_instructors",
  })
  alert_instructors!: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "alert_emails",
  })
  alert_emails?: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "custom_instructions",
  })
  custom_instructions?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "require_fullscreen",
  })
  require_fullscreen!: boolean;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.0,
    field: "min_camera_level",
    validate: {
      min: 0,
      max: 100,
    },
  })
  min_camera_level!: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.0,
    field: "min_microphone_level",
    validate: {
      min: 0,
      max: 100,
    },
  })
  min_microphone_level!: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 50.0,
    field: "min_speaker_level",
    validate: {
      min: 0,
      max: 100,
    },
  })
  min_speaker_level!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "enable_face_detection",
  })
  enable_face_detection!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "enable_object_detection",
  })
  enable_object_detection!: boolean;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 70.0,
    field: "object_detection_sensitivity",
    validate: {
      min: 0,
      max: 100,
    },
  })
  object_detection_sensitivity!: number;

  // Associations
  @BelongsTo(() => Quiz, "quiz_id")
  quiz!: Quiz;

  // Virtual getters
  get is_strict_mode(): boolean {
    return (
      this.lockdown_browser &&
      this.prevent_tab_switching &&
      this.prevent_copy_paste &&
      this.max_flags_allowed <= 3
    );
  }

  get monitoring_features(): string[] {
    const features = [];
    if (this.allow_video_monitoring) features.push("video");
    if (this.allow_audio_monitoring) features.push("audio");
    if (this.allow_screen_recording) features.push("screen");
    return features;
  }

  get alert_emails_array(): string[] {
    return this.alert_emails
      ? this.alert_emails.split(",").map((email) => email.trim())
      : [];
  }

  set alert_emails_array(emails: string[]) {
    this.alert_emails = emails.join(",");
  }
}

export default ProctoringSettings;
