import { Table, Column, Model, DataType, BelongsTo, ForeignKey } from "sequelize-typescript";
import { User } from "./User.model";

export type DatabaseQueryLogStatus = "success" | "error";

export interface IDatabaseQueryLogAttributes {
  id?: number;
  userId: number;
  queryText: string;
  statementType: string;
  isWrite: boolean;
  rowCount?: number | null;
  executionMs?: number | null;
  status: DatabaseQueryLogStatus;
  errorMessage?: string | null;
  ipAddress?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type DatabaseQueryLogCreationAttributes = Omit<
  IDatabaseQueryLogAttributes,
  "id" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "database_query_logs",
  timestamps: true,
  underscored: true,
  modelName: "DatabaseQueryLog",
})
export class DatabaseQueryLog extends Model<
  IDatabaseQueryLogAttributes,
  DatabaseQueryLogCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "user_id",
  })
  userId!: number;

  @BelongsTo(() => User, "userId")
  user?: User;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: "query_text",
  })
  queryText!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    field: "statement_type",
  })
  statementType!: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "is_write",
  })
  isWrite!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "row_count",
  })
  rowCount?: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "execution_ms",
  })
  executionMs?: number | null;

  @Column({
    type: DataType.ENUM("success", "error"),
    allowNull: false,
  })
  status!: DatabaseQueryLogStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: "error_message",
  })
  errorMessage?: string | null;

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
    field: "ip_address",
  })
  ipAddress?: string | null;
}

export default DatabaseQueryLog;
