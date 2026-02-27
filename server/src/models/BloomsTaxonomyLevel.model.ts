import { Table, Column, Model, DataType, HasMany } from "sequelize-typescript";

export interface IBloomsTaxonomyLevelAttributes {
  id?: number;
  name: string;
  description?: string | null;
  level_order: number;
  created_at?: Date;
  updated_at?: Date;
}

export type BloomsTaxonomyLevelCreationAttributes = Omit<
  IBloomsTaxonomyLevelAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "blooms_taxonomy_levels",
  timestamps: true,
  underscored: true,
  modelName: "BloomsTaxonomyLevel",
})
export class BloomsTaxonomyLevel extends Model<
  IBloomsTaxonomyLevelAttributes,
  BloomsTaxonomyLevelCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide level name" },
      notEmpty: { msg: "Level name cannot be empty" },
      len: {
        args: [1, 100],
        msg: "Level name must be between 1 and 100 characters",
      },
    },
  })
  name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    defaultValue: null,
  })
  description?: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: "level_order",
  })
  level_order!: number;
}

export default BloomsTaxonomyLevel;
