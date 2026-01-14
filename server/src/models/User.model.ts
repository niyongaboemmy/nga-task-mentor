import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsToMany,
  BeforeCreate,
  BeforeUpdate,
  BeforeBulkCreate,
} from "sequelize-typescript";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import Submission from "./Submission.model";
import Assignment from "./Assignment.model";
import Course from "./Course.model";
import { UserCourse } from "./UserCourse.model";
import Quiz from "./Quiz.model";
import QuizSubmission from "./QuizSubmission.model";
import QuizAttempt from "./QuizAttempt.model";

export type UserRole = "student" | "instructor" | "admin";

export interface IUserAttributes {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: UserRole;
  mis_user_id?: number | null;
  profile_image?: string | null;
  reset_password_token?: string | null;
  reset_password_expire?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Omit<
  IUserAttributes,
  "id" | "createdAt" | "updatedAt"
>;

export type UserLoginAttributes = Pick<IUserAttributes, "email" | "password">;

@Table({
  tableName: "users",
  timestamps: true,
  underscored: true,
  modelName: "User",
})
export class User extends Model<IUserAttributes, UserCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide first name" },
      len: {
        args: [1, 50],
        msg: "First name must be between 1 and 50 characters",
      },
    },
  })
  first_name!: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide last name" },
      len: {
        args: [1, 50],
        msg: "Last name must be between 1 and 50 characters",
      },
    },
  })
  last_name!: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    validate: {
      isEmail: { msg: "Please provide a valid email" },
      notNull: { msg: "Please provide an email" },
    },
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: "Please provide a password" },
      len: {
        args: [6],
        msg: "Password must be at least 6 characters long",
      },
    },
  } as any)
  password!: string;

  @Column({
    type: DataType.ENUM("student", "instructor", "admin"),
    allowNull: false,
    defaultValue: "student",
  })
  role!: UserRole;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: "mis_user_id",
  })
  mis_user_id?: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: "profile_image",
  })
  profile_image?: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: "reset_password_token",
  })
  reset_password_token?: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: "reset_password_expire",
  })
  reset_password_expire?: Date | null;

  // Associations
  @HasMany(() => Course, "instructor_id")
  courses_taught?: Course[];

  @HasMany(() => Assignment, "created_by")
  assignments_created?: Assignment[];

  @HasMany(() => Submission, "student_id")
  submissions?: Submission[];

  @BelongsToMany(() => Course, () => UserCourse)
  enrolled_courses?: Course[];

  @HasMany(() => Quiz, "created_by")
  quizzes_created?: Quiz[];

  @HasMany(() => QuizSubmission, "student_id")
  quiz_submissions?: QuizSubmission[];

  @HasMany(() => QuizSubmission, "graded_by")
  graded_submissions?: QuizSubmission[];

  @HasMany(() => QuizAttempt, "student_id")
  question_attempts?: QuizAttempt[];

  // Instance methods
  getSignedJwtToken(): string {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }
    const payload = { id: this.id, role: this.role };
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRE
      ? Number(process.env.JWT_EXPIRE) || process.env.JWT_EXPIRE
      : "30d";
    const options: jwt.SignOptions = {
      expiresIn: expiresIn as any,
    };
    return jwt.sign(payload, secret, options);
  }

  // Method to check password
  async matchPassword(enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
  }

  // Method to generate password reset token
  getResetPasswordToken(): string {
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    this.reset_password_token = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire
    this.reset_password_expire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return resetToken;
  }

  // Hooks
  @BeforeCreate
  @BeforeUpdate
  static async hashPassword(instance: User): Promise<void> {
    if (instance.changed("password")) {
      const salt = await bcrypt.genSalt(10);
      instance.password = await bcrypt.hash(instance.password, salt);
    }
  }

  @BeforeBulkCreate
  static async hashBulkPassword(instances: User[]): Promise<void> {
    for (const instance of instances) {
      const salt = await bcrypt.genSalt(10);
      instance.password = await bcrypt.hash(instance.password, salt);
    }
  }

  // Virtual for full name
  get full_name(): string {
    return `${this.first_name} ${this.last_name}`;
  }
}

export default User;
