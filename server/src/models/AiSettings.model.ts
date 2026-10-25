import { Table, Column, Model, DataType } from "sequelize-typescript";

/**
 * Premium AI and the school's AI settings in Task Mentor (GRADING_PREMIUM_CONTRACTS.md;
 * migration 20261025120000-ai-premium-and-settings).
 */

/** Per-user premium AI override: granted (or explicitly off), with an optional daily limit. */
@Table({ tableName: "ai_entitlements", timestamps: false, modelName: "AiEntitlement" })
export class AiEntitlement extends Model {
  /** The local Task Mentor user id (users.id). */
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: false }) user_id!: number;
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) premium!: boolean;
  /** Premium requests a day; null: TMCODE_AI_PREMIUM_PER_DAY. */
  @Column({ type: DataType.INTEGER, allowNull: true }) daily_limit?: number | null;
  @Column({ type: DataType.STRING(500), allowNull: true }) note?: string | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) granted_by?: number | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) updated_at!: Date;
}

/** Small key/value settings of the app (JSON values), e.g. "ai.byok_allowed". */
@Table({ tableName: "app_settings", timestamps: false, modelName: "AppSetting" })
export class AppSetting extends Model {
  @Column({ type: DataType.STRING(100), primaryKey: true }) key!: string;
  @Column({ type: DataType.TEXT, allowNull: true }) value?: string | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) updated_by?: number | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) updated_at!: Date;
}

export const AI_SETTINGS_MODELS = [AiEntitlement, AppSetting];
