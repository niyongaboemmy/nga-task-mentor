import zlib from "zlib";
import { Request, Response } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import { Project, ProjectActivityLink, ProjectRevision } from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { trackKeyEvent } from "../activity/keyEvents";
import { isAiDisabledError } from "../services/aiPolicy";
import { accessFor } from "../services/aiEntitlements";
import { loadActivity, teacherCanSeeActivity } from "../tmcode/projects/access";
import { readBlobGz, readManifest, type ManifestEntry } from "../tmcode/projects/storage";
import { userBrief, usersById } from "../tmcode/projects/serialize";
import { IGNORED_PATH } from "../services/coderunner/projectKind";
import { isProbablyText, languageOfPath } from "../tmcode/practical/run";
import { canGradeAssignment, canGradeQuiz } from "../utils/gradingAccess";
import { AiError, scrubSecrets, streamChat } from "../tmcode/ai/service";
import { briefText, buildDraftMessages, extractJson, normalizeDraft, type GradingInfo } from "../tmcode/ai/grading";
import { gradingContext } from "./tmcodePracticals.controller";
import { ByokSchema } from "./tmcodeAi.controller";

/**
 * POST /api/tmcode/grading/:type/:id/students/:studentId/ai-draft
 * (GRADING_PREMIUM_CONTRACTS.md, "Grading draft endpoint"): the AI drafts a grade for one student
 * from the brief, the rubric, the student's latest submitted revision and the tests summary,
 * through the TMCode AI mode the teacher picked (free/auto/premium/byok).
 * It saves NOTHING: the teacher reviews the draft in TMCode and clicks Save.
 */

export const DRAFT_MAX_FILES = 60;
export const DRAFT_MAX_BYTES = 200 * 1024;
/** One file bigger than this is left out (it would crowd out the others). */
const DRAFT_MAX_FILE_BYTES = 100 * 1024;
/** Extensions never worth reading (binary or generated). */
const BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|icns|svgz|pdf|zip|gz|tgz|rar|7z|jar|war|class|exe|dll|so|dylib|o|a|bin|wasm|pyc|mp3|mp4|wav|ogg|mov|avi|ttf|otf|woff2?|eot|psd|sqlite|db|lock)$/i;
const SKIP_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.DS_Store)$/;

const DraftSchema = z.object({
  question_id: z.number().int().positive().optional().nullable(),
  mode: z.string().max(200).default("free"),
  byok: ByokSchema.optional(),
  /** The teacher's prompt ("what to focus on"). */
  instructions: z.string().max(4_000).optional(),
  tests: z
    .object({
      passed: z.number().int().min(0).max(100_000),
      failed: z.number().int().min(0).max(100_000),
      total: z.number().int().min(0).max(100_000),
      summary: z.string().max(4_000).optional(),
    })
    .nullable()
    .optional(),
});

/** The text files of a revision for the AI, within the caps; what was left out is said. */
export async function draftFiles(entries: ManifestEntry[], read: (sha: string) => Promise<Buffer | null> = readRaw) {
  const wanted = entries.filter((f) => !IGNORED_PATH.test(f.path) && !/(^|\/)node_modules\//.test(f.path) && !BINARY_EXT.test(f.path) && !SKIP_FILES.test(f.path));
  // Source code first (by path), then the rest (data, docs).
  const ranked = [...wanted.filter((f) => languageOfPath(f.path)), ...wanted.filter((f) => !languageOfPath(f.path))];
  const files: { path: string; text: string }[] = [];
  let bytes = 0;
  let skipped = entries.length - wanted.length;
  for (const f of ranked) {
    if (files.length >= DRAFT_MAX_FILES || f.size > DRAFT_MAX_FILE_BYTES || bytes + f.size > DRAFT_MAX_BYTES) {
      skipped++;
      continue;
    }
    const buf = await read(f.sha256).catch(() => null);
    if (!buf || !isProbablyText(buf)) {
      skipped++;
      continue;
    }
    bytes += buf.length;
    files.push({ path: f.path, text: buf.toString("utf8") });
  }
  return { files, skipped, bytes };
}

async function readRaw(sha: string): Promise<Buffer | null> {
  const gz = await readBlobGz(sha);
  return gz ? zlib.gunzipSync(gz) : null;
}

/** The revision to grade: the latest submitted one for this activity, else the project's latest save. */
async function studentRevision(type: "assignment" | "quiz", activityId: number, questionId: number | null, studentId: number) {
  const projects = await Project.findAll({ where: { owner_id: studentId } });
  if (!projects.length) return null;
  const where: any = { activity_type: type, activity_id: activityId, project_id: { [Op.in]: projects.map((p) => p.id) } };
  if (type === "quiz" && questionId) where.question_id = questionId;
  const links = await ProjectActivityLink.findAll({ where, order: [["submitted_at", "DESC"], ["id", "DESC"]] });
  const live = (pid: number) => projects.find((p) => p.id === pid)?.status !== "removed";
  const submitted = links.find((l) => l.status === "submitted" && l.revision_id && live(l.project_id)) ?? links.find((l) => l.status === "submitted" && l.revision_id);
  if (submitted) return { revisionId: Number(submitted.revision_id), submitted: true };
  const project =
    (type === "assignment" ? projects.find((p) => (p as any).assignment_id === activityId && p.status !== "removed") : null) ??
    projects.find((p) => links.some((l) => l.project_id === p.id) && p.status !== "removed");
  return project?.head_revision_id ? { revisionId: Number(project.head_revision_id), submitted: false } : null;
}

export const aiDraftGrade = async (req: Request, res: Response) => {
  const parsed = DraftSchema.safeParse(req.body ?? {});
  if (!parsed.success) return tmcodeError(res, 400, "VALIDATION", "That request isn't valid.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const body = parsed.data;
  const type = String(req.params.type) as "assignment" | "quiz";
  const activityId = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  const ctx = await gradingContext(type, activityId, body.question_id ?? (req.query.question_id ? Number(req.query.question_id) : null));
  if (!ctx) return tmcodeError(res, 404, "NOT_FOUND", "Activity not found.");
  const activity = await loadActivity(ctx.type, ctx.id);
  if (!activity || !(await teacherCanSeeActivity(req, activity))) return tmcodeError(res, 403, "FORBIDDEN", "This activity isn't in your courses.");
  const allowed = ctx.type === "assignment" ? await canGradeAssignment(req, ctx.assignment as any) : await canGradeQuiz(req, ctx.quiz as any);
  if (!allowed) return tmcodeError(res, 403, "FORBIDDEN", "Only a teacher of this subject, the creator or a super admin can grade this.");

  const paid = await accessFor(req, body.mode, body.byok);
  if (!paid.ok) return tmcodeError(res, paid.status, paid.code, paid.message, { code: paid.code });

  const rev = await studentRevision(ctx.type, ctx.id, ctx.question?.id ?? null, studentId);
  const revision = rev ? await ProjectRevision.findByPk(rev.revisionId) : null;
  if (!rev || !revision) return tmcodeError(res, 409, "NOTHING_TO_GRADE", "This student has no saved work for this activity yet.");
  const { files, skipped } = await draftFiles(readManifest(revision));
  if (!files.length) return tmcodeError(res, 422, "NO_READABLE_FILES", "The AI can't read any of this student's files (binary or too large). Grade this one yourself.");

  const student = userBrief((await usersById([studentId])).get(studentId), studentId);
  const info: GradingInfo = {
    activity_title: ctx.title,
    brief:
      ctx.type === "quiz"
        ? briefText(ctx.brief.instructions)
        : [briefText(ctx.brief.description), ctx.brief.instructions ? `Instructions:\n${briefText(ctx.brief.instructions)}` : ""].filter(Boolean).join("\n\n"),
    rubric: ctx.rubric.map((c, index) => ({ index, criteria: c.criteria, description: c.description ?? null, max_score: Number(c.max_score) || 0 })),
    student_name: student?.name ?? "",
    ...(ctx.type === "quiz" && ctx.question ? { question_text: ctx.question.text } : {}),
    max_points: ctx.max_points,
  };
  const warnings: string[] = [];
  if (!rev.submitted) warnings.push("Not submitted yet: the AI read the student's latest saved version.");
  if (skipped) warnings.push(`${skipped} file${skipped === 1 ? " was" : "s were"} not read (binary, dependencies, or over the size limits). Check them yourself.`);
  if (!body.tests) warnings.push("No test results were sent: the AI judged the code by reading it.");

  const messages = buildDraftMessages({
    info,
    instructions: body.instructions?.trim() || undefined,
    tests: body.tests ?? null,
    files,
    filesNote: rev.submitted ? `revision ${revision.number ?? revision.id}, submitted` : `revision ${revision.number ?? revision.id}, not submitted yet`,
  });

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });
  const key = paid.access?.tier === "byok" ? paid.access.key : null;
  let text = "";
  let result: { provider: string; model: string; tier: "free" | "premium" | "byok" };
  try {
    result = await streamChat(Number(req.user.id), body.mode, messages, () => {}, (t) => (text += t), abort.signal, undefined, { access: paid.access, maxTokens: 3_000, temperature: 0.2 });
  } catch (e) {
    if (abort.signal.aborted) return;
    if (isAiDisabledError(e)) return tmcodeError(res, 403, "AI_DISABLED", e.message, { code: "AI_DISABLED", reason: e.reason });
    const err = e instanceof AiError ? e : new AiError(502, "PROVIDER_FAILED", "The AI didn't answer. Try again.");
    if (!(e instanceof AiError) && !paid.access) console.error("[tmcode-ai] draft", (e as Error)?.message);
    return tmcodeError(res, err.status, err.code, scrubSecrets(err.message, key), { code: err.code });
  }

  const draft = normalizeDraft(extractJson(text), info.rubric, ctx.max_points);
  if (!draft) return tmcodeError(res, 502, "AI_BAD_DRAFT", "The AI didn't return a usable draft. Try again, or pick another model.", { code: "AI_BAD_DRAFT" });

  trackKeyEvent(req, "tm.grade.ai_draft", {
    kind: ctx.type,
    activity_id: ctx.id,
    question_id: ctx.question?.id ?? null,
    student_id: studentId,
    source: "tmcode",
    tier: result.tier,
    model: result.model,
  });
  return res.status(200).json({
    draft: {
      ...draft,
      warnings: [...warnings, ...draft.warnings],
      by: `TMCode AI · ${result.model}`,
      model: result.model,
      tier: result.tier,
    },
  });
};
