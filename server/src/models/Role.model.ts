import { Table, Column, Model, DataType, HasMany, BelongsToMany } from "sequelize-typescript";
import Permission from "./Permission.model";
import RolePermission from "./RolePermission.model";
import User from "./User.model";

export interface IRoleAttributes {
  id?: number;
  name: string;
  description?: string | null;
  is_system?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RoleCreationAttributes = Omit<
  IRoleAttributes,
  "id" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "roles",
  timestamps: true,
  underscored: true,
  modelName: "Role",
})
export class Role extends Model<IRoleAttributes, RoleCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    unique: true,
  })
  name!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  description?: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: "is_system",
  })
  is_system!: boolean;

  @BelongsToMany(() => Permission, () => RolePermission)
  permissions?: Permission[];

  @HasMany(() => User, "role_id")
  users?: User[];
}

export default Role;
