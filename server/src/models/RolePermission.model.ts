import { Table, Column, Model, DataType, ForeignKey } from "sequelize-typescript";
import Role from "./Role.model";
import Permission from "./Permission.model";

export interface IRolePermissionAttributes {
  id?: number;
  role_id: number;
  permission_id: number;
  createdAt?: Date;
}

export type RolePermissionCreationAttributes = Omit<
  IRolePermissionAttributes,
  "id" | "createdAt"
>;

@Table({
  tableName: "role_permissions",
  timestamps: true,
  updatedAt: false,
  underscored: true,
  modelName: "RolePermission",
})
export class RolePermission extends Model<
  IRolePermissionAttributes,
  RolePermissionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @ForeignKey(() => Role)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "role_id",
  })
  role_id!: number;

  @ForeignKey(() => Permission)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "permission_id",
  })
  permission_id!: number;
}

export default RolePermission;
