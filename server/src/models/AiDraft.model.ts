import { Table, Column, Model, DataType } from "sequelize-typescript";

/**
 * AI drafts made by a person's own Claude / ChatGPT through the NGA connector
 * (nga_central_mis EXTERNAL_AI_CONTRACT.md §2; integration/mcpTools.ts). Connector
 * writes create drafts only: nothing here is in the question bank, on an assignment or
 * visible to a student until the teacher opens the draft in Task Mentor (AI drafts page)
 * and confirms it there.
 *
 *   questions  payload { questions: [...] }            → "Add to question bank" (POST …/bulk)
 *   rubric     payload { criteria: [...], max_score }   → loaded into the assignment form
 *   feedback   payload { feedback, rubric_scores, … }   → read by the teacher while grading;
 *                                                         never released to the student
 *
 * Migration 20261101120000-create-ai-drafts.js.
 */
export type AiDraftKind = "questions" | "rubric" | "feedback";
export type AiDraftStatus = "draft" | "applied" | "discarded";

@Table({
  tableName: "ai_drafts",
  timestamps: true,
  underscored: true,
  modelName: "AiDraft",
  indexes: [{ fields: ["user_id", "status"] }, { fields: ["submission_id"] }, { fields: ["assignment_id"] }],
})
export class AiDraft extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true }) id!: number;
  /** The owner: local users.id. Only they see it. */
  @Column({ type: DataType.INTEGER, allowNull: false }) user_id!: number;
  @Column({ type: DataType.ENUM("questions", "rubric", "feedback"), allowNull: false }) kind!: AiDraftKind;
  @Column({ type: DataType.INTEGER, allowNull: true }) course_id?: number | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) assignment_id?: number | null;
  @Column({ type: DataType.INTEGER, allowNull: true }) submission_id?: number | null;
  @Column({ type: DataType.STRING(255), allowNull: false, defaultValue: "" }) title!: string;
  @Column({ type: DataType.JSON, allowNull: false }) payload!: any;
  @Column({ type: DataType.ENUM("draft", "applied", "discarded"), allowNull: false, defaultValue: "draft" }) status!: AiDraftStatus;
  /** "connector" (the person's own AI through NGA's MCP server). */
  @Column({ type: DataType.STRING(32), allowNull: false, defaultValue: "connector" }) source!: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export default AiDraft;
