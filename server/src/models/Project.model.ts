import { Table, Column, Model, DataType } from "sequelize-typescript";

/**
 * TMCode Projects (PROJECTS_PLAN.md §2, migration 20261006100000-create-projects).
 * Users are LOCAL Task Mentor user ids throughout (never MIS ids).
 */

export type ProjectKind = "github" | "tm";
export type ProjectVisibility = "private" | "course";

/** Last git status TMCode reported for a github project (POST /projects/:id/git). */
export interface ProjectGitState {
  branch?: string | null;
  head_commit?: string | null;
  ahead?: number;
  behind?: number;
  changes?: number;
  remote_url?: string | null;
  last_push?: { commit: string; message?: string | null; at: string } | null;
  reported_at: string;
}

@Table({ tableName: "projects", timestamps: true, underscored: true, modelName: "Project" })
export class Project extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) owner_id!: number;
  @Column({ type: DataType.STRING(120), allowNull: false }) name!: string;
  @Column({ type: DataType.STRING(140), allowNull: false }) slug!: string;
  @Column({ type: DataType.TEXT, allowNull: true }) description?: string | null;
  @Column({ type: DataType.STRING(60), allowNull: true }) language?: string | null;
  @Column({ type: DataType.ENUM("github", "tm"), allowNull: false, defaultValue: "tm" }) kind!: ProjectKind;
  @Column({ type: DataType.ENUM("private", "course"), allowNull: false, defaultValue: "private" })
  visibility!: ProjectVisibility;
  @Column({ type: DataType.STRING(500), allowNull: true }) repo_url?: string | null;
  @Column({ type: DataType.STRING(200), allowNull: true }) repo_full_name?: string | null;
  @Column({ type: DataType.STRING(120), allowNull: true }) default_branch?: string | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) head_revision_id?: number | null;
  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 }) size_bytes!: number;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) file_count!: number;
  @Column({ type: DataType.JSON, allowNull: true }) git_state?: ProjectGitState | null;
  @Column({ type: DataType.DATE, allowNull: true }) last_activity_at?: Date | null;
  @Column({ type: DataType.DATE, allowNull: true }) archived_at?: Date | null;
  /** The student's workspace for this TMCode assignment (ASSIGNMENTS_PLAN.md); unique per owner. */
  @Column({ type: DataType.INTEGER, allowNull: true }) assignment_id?: number | null;
  /** Live status (presence) goes to teachers' monitors. Locked on for open assignment workspaces. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true }) share_presence!: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

export type TmcodeKind = "practical" | "case_study";

/**
 * The TMCode columns of `assignments` (migration 20261007090000). Kept off the
 * Assignment model so code that runs before the migration doesn't SELECT
 * columns that aren't there yet. Read and update only -- never create rows.
 */
@Table({ tableName: "assignments", timestamps: false, modelName: "AssignmentTmcode" })
export class AssignmentTmcode extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true }) id!: number;
  @Column({ type: DataType.ENUM("practical", "case_study"), allowNull: true }) tmcode_kind?: TmcodeKind | null;
  @Column({ type: DataType.STRING(40), allowNull: true }) tmcode_language?: string | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) tmcode_starter_project_id?: number | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) tmcode_starter_revision_id?: number | null;
  @Column({ type: DataType.TEXT, allowNull: true }) tmcode_instructions?: string | null;
}

export type ProjectMemberRole = "owner" | "collaborator" | "viewer";
export type ProjectMemberStatus = "invited" | "active" | "removed";

@Table({ tableName: "project_members", timestamps: true, underscored: true, modelName: "ProjectMember" })
export class ProjectMember extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) project_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column({ type: DataType.ENUM("owner", "collaborator", "viewer"), allowNull: false }) role!: ProjectMemberRole;
  @Column({ type: DataType.STRING(100), allowNull: true }) github_username?: string | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) invited_by?: number | null;
  @Column({ type: DataType.ENUM("invited", "active", "removed"), allowNull: false, defaultValue: "active" })
  status!: ProjectMemberStatus;
  declare created_at: Date;
  declare updated_at: Date;
}

export type RevisionSource = "save" | "auto" | "submit";

@Table({ tableName: "project_revisions", timestamps: false, modelName: "ProjectRevision" })
export class ProjectRevision extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) project_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) number!: number;
  @Column({ type: DataType.INTEGER, allowNull: true }) parent_id?: number | null;
  @Column({ type: DataType.INTEGER, allowNull: false }) author_id!: number;
  @Column({ type: DataType.STRING(500), allowNull: true }) message?: string | null;
  /** gzip(JSON [{path, sha256, size}]), sorted by path */
  @Column({ type: DataType.BLOB("long"), allowNull: false }) manifest_gz!: Buffer;
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 }) file_count!: number;
  @Column({ type: DataType.BIGINT, allowNull: false, defaultValue: 0 }) size_bytes!: number;
  @Column({ type: DataType.ENUM("save", "auto", "submit"), allowNull: false, defaultValue: "save" })
  source!: RevisionSource;
  @Column({ type: DataType.STRING(64), allowNull: true }) git_commit?: string | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) created_at!: Date;
}

@Table({ tableName: "project_blobs", timestamps: false, modelName: "ProjectBlob" })
export class ProjectBlob extends Model {
  @Column({ type: DataType.CHAR(64), primaryKey: true }) sha256!: string;
  /** Uncompressed size in bytes. */
  @Column({ type: DataType.INTEGER, allowNull: false }) size!: number;
  @Column({ type: DataType.ENUM("db", "fs"), allowNull: false }) storage!: "db" | "fs";
  /** gzip'd content; null when it lives on the file-server (projects/<sha>). */
  @Column({ type: DataType.BLOB("long"), allowNull: true }) data_gz?: Buffer | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) created_at!: Date;
}

/** What TMCode reports about an open project (PROJECTS_PLAN.md §2). */
export interface PresenceState {
  open?: boolean;
  file?: string | null;
  dirty?: number | string[] | null;
  branch?: string | null;
  ahead?: number | null;
  behind?: number | null;
  changes?: number | null;
  last_commit?: unknown;
  last_run?: unknown;
  sync?: string | null;
  [k: string]: unknown;
}

@Table({ tableName: "project_presence", timestamps: false, modelName: "ProjectPresence" })
export class ProjectPresence extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) project_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column({ type: DataType.STRING(64), allowNull: false }) device_id!: string;
  @Column({ type: DataType.STRING(20), allowNull: true }) app_version?: string | null;
  @Column({ type: DataType.JSON, allowNull: true }) state?: PresenceState | null;
  @Column({ type: DataType.DATE, allowNull: false }) last_seen_at!: Date;
}

export type ActivityType = "quiz" | "assignment" | "manual_assessment";

@Table({ tableName: "project_activity_links", timestamps: true, underscored: true, modelName: "ProjectActivityLink" })
export class ProjectActivityLink extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) project_id!: number;
  @Column({ type: DataType.ENUM("quiz", "assignment", "manual_assessment"), allowNull: false })
  activity_type!: ActivityType;
  @Column({ type: DataType.INTEGER, allowNull: false }) activity_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) linked_by!: number;
  @Column({ type: DataType.INTEGER, allowNull: true }) revision_id?: number | null;
  @Column({ type: DataType.STRING(64), allowNull: true }) git_commit?: string | null;
  @Column({ type: DataType.ENUM("linked", "submitted"), allowNull: false, defaultValue: "linked" })
  status!: "linked" | "submitted";
  @Column({ type: DataType.DATE, allowNull: true }) submitted_at?: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

@Table({ tableName: "project_events", timestamps: false, modelName: "ProjectEvent" })
export class ProjectEvent extends Model {
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true }) id!: number;
  @Column({ type: DataType.INTEGER, allowNull: false }) project_id!: number;
  @Column({ type: DataType.INTEGER, allowNull: true }) user_id?: number | null;
  @Column({ type: DataType.STRING(30), allowNull: false }) type!: string;
  @Column({ type: DataType.JSON, allowNull: true }) data?: Record<string, unknown> | null;
  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW }) created_at!: Date;
}

/** Register with sequelize.addModels next to the other models. */
export const PROJECT_MODELS = [
  Project,
  AssignmentTmcode,
  ProjectMember,
  ProjectRevision,
  ProjectBlob,
  ProjectPresence,
  ProjectActivityLink,
  ProjectEvent,
];
