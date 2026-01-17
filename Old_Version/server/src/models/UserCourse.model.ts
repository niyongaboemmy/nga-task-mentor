import { Table, Column, Model, DataType, ForeignKey } from 'sequelize-typescript';
import { User } from './User.model';
import { Course } from './Course.model';

export interface IUserCourseAttributes {
  id?: number;
  user_id: number;
  course_id: number;
  enrollment_date: Date;
  completion_date?: Date | null;
  status: 'enrolled' | 'completed' | 'dropped';
  grade?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type UserCourseCreationAttributes = Omit<IUserCourseAttributes, 'id' | 'created_at' | 'updated_at'>;

@Table({
  tableName: 'user_courses',
  timestamps: true,
  underscored: true,
  modelName: 'UserCourse',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'course_id'],
      name: 'unique_user_course'
    }
  ]
})
export class UserCourse extends Model<IUserCourseAttributes, UserCourseCreationAttributes> {
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
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  })
  user_id!: number;

  @ForeignKey(() => Course)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'course_id',
    references: {
      model: 'courses',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  })
  course_id!: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'enrollment_date',
    defaultValue: DataType.NOW
  })
  enrollment_date!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'completion_date',
    validate: {
      isAfterEnrollmentDate(this: UserCourse, value: Date | null) {
        if (value && value < this.enrollment_date) {
          throw new Error('Completion date must be after enrollment date');
        }
      }
    }
  })
  completion_date?: Date | null;

  @Column({
    type: DataType.ENUM('enrolled', 'completed', 'dropped'),
    allowNull: false,
    defaultValue: 'enrolled'
  })
  status!: 'enrolled' | 'completed' | 'dropped';

  @Column({
    type: DataType.STRING(2),
    allowNull: true,
    validate: {
      isValidGrade(value: string | null) {
        if (!value) return;
        const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'P', 'NP', 'I'];
        if (!validGrades.includes(value)) {
          throw new Error('Invalid grade');
        }
      }
    }
  })
  grade?: string | null;

  // Virtual getters
  get is_completed(): boolean {
    return this.status === 'completed';
  }

  get is_active(): boolean {
    return this.status === 'enrolled';
  }
}

export default UserCourse;
