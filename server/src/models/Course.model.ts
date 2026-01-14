import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  BelongsToMany,
} from "sequelize-typescript";
import { User } from "./User.model";
import Assignment from "./Assignment.model";
import { UserCourse } from "./UserCourse.model";
import Quiz from "./Quiz.model";

export interface ICourseAttributes {
  id?: number;
  code: string;
  title: string;
  description: string;
  credits: number;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
  max_students: number;
  instructor_id: number;
  created_at?: Date;
  updated_at?: Date;
}

export type CourseCreationAttributes = Omit<
  ICourseAttributes,
  "id" | "created_at" | "updated_at"
>;

@Table({
  tableName: "courses",
  timestamps: true,
  underscored: true,
  modelName: "Course",
})
export class Course extends Model<ICourseAttributes, CourseCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    unique: {
      name: "courses_code_unique",
      msg: "Course code already exists!",
    },
    validate: {
      notNull: { msg: "Please provide course code" },
      len: {
        args: [1, 20],
        msg: "Course code cannot be more than 20 characters",
      },
      isUppercase: {
        msg: "Course code must be uppercase",
      },
    },
  })
  code!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide course title" },
      len: {
        args: [1, 100],
        msg: "Course title cannot be more than 100 characters",
      },
    },
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide course description" },
      notEmpty: { msg: "Course description cannot be empty" },
    },
  })
  description!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide number of credits" },
      min: {
        args: [0],
        msg: "Credits cannot be negative",
      },
      max: {
        args: [10],
        msg: "Credits cannot be more than 10",
      },
    },
  })
  credits!: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: "start_date",
    validate: {
      notNull: { args: true, msg: "Please provide start date" },
      isDate: { args: true, msg: "Please provide a valid start date" },
      // isFutureDate(value: string) {
      //   const today = new Date().toISOString().split("T")[0];
      //   if (value < today) {
      //     throw new Error("Start date cannot be in the past");
      //   }
      // },
    },
  } as any)
  start_date!: Date;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: "end_date",
    validate: {
      notNull: { args: true, msg: "Please provide end date" },
      isDate: { args: true, msg: "Please provide a valid end date" },
      isAfterStartDate(value: string) {
        const startDate = (this as any).start_date;
        if (!startDate) return; // skip if start_date is not yet set
        if (new Date(value) <= new Date(startDate)) {
          throw new Error("End date must be after start date");
        }
      },
    },
  } as any)
  end_date!: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "is_active",
  })
  is_active!: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "max_students",
    validate: {
      notNull: { args: true, msg: "Please provide maximum number of students" },
      min: {
        args: [1],
        msg: "Maximum students must be at least 1",
      },
      max: {
        args: [200],
        msg: "Maximum students cannot exceed 200",
      },
    },
  } as any)
  max_students!: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "instructor_id",
  } as any)
  instructor_id!: number;

  // Associations
  @BelongsTo(() => User, "instructor_id")
  instructor!: User;

  @HasMany(() => Assignment, "course_id")
  assignments!: Assignment[];

  @BelongsToMany(() => User, () => UserCourse)
  students!: User[];

  @HasMany(() => Quiz, "course_id")
  quizzes!: Quiz[];

  // Virtual getters
  get duration_weeks(): number {
    const diffTime = Math.abs(
      new Date(this.end_date).getTime() - new Date(this.start_date).getTime()
    );
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  }

  get is_full(): boolean {
    return this.students ? this.students.length >= this.max_students : false;
  }
}

export default Course;
