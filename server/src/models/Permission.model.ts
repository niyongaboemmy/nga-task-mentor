import { Table, Column, Model, DataType, BelongsToMany } from "sequelize-typescript";
import Role from "./Role.model";
import RolePermission from "./RolePermission.model";

export interface IPermissionAttributes {
  id?: number;
  key: string;
  category: string;
  description?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PermissionCreationAttributes = Omit<
  IPermissionAttributes,
  "id" | "createdAt" | "updatedAt"
>;

@Table({
  tableName: "permissions",
  timestamps: true,
  underscored: true,
  modelName: "Permission",
})
export class Permission extends Model<IPermissionAttributes, PermissionCreationAttributes> {
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
  key!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  category!: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  description?: string | null;

  @BelongsToMany(() => Role, () => RolePermission)
  roles?: Role[];
}

export default Permission;
