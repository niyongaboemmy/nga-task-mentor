import zlib from "zlib";
import { Request, Response } from "express";
import { z } from "zod";
import { Op, QueryTypes, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import {
  ActivityType,
  Assignment,
  ManualAssessment,
  Project,
  ProjectActivityLink,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  ProjectStatus,
  Quiz,
  User,
  AssignmentTmcode,
} from "../models";
import { tmcodeError } from "../middleware/tmcodeAuth";
import { apiOrigin } from "./tmcode.controller";
import { getScopedSubjects } from "../utils/scopedSubjects";
import {
  ACTIVITY_TYPES,
  canReadRevision,
  forgetProjectCourses,
  loadActivity,
  ProjectAccess,
  projectCourseIds,
  resolveProjectAccess,
  scopedCourseIds,
  teacherCanSeeActivity,
  userMayUseActivity,
} from "../tmcode/projects/access";
import { MONITOR_TOPIC, openSse, projectsBus, projectTopic } from "../tmcode/projects/bus";
import { projectLimits, presenceStaleMs } from "../tmcode/projects/limits";
import { invalidPathReason } from "../tmcode/projects/paths";
import { MonitorEntry, MonitorProject, publishPresence, withdrawPresence } from "../tmcode/projects/presence";
import { AssignmentBrief, assignmentBriefs } from "../tmcode/assignments/load";
import { isReadOnlyStatus, presenceLocked } from "../tmcode/assignments/state";
import { lockReason, reopenProject, syncProjectStatus } from "../tmcode/projects/status";
import { loadQuizPractical, practicalQuestionsOf } from "./tmcodePracticals.controller";
import {
  HIDDEN_PRESENCE,
  eventJson,
  isOnline,
  linkJson,
  memberJson,
  presenceJson,
  presenceSummary,
  projectCore,
  revisionJson,
  userBrief,
  usersById,
} from "../tmcode/projects/serialize";
import {
  BlobError,
  blobSizes,
  collectUnusedBlobs,
  gzipManifest,
  ManifestEntry,
  missingBlobs,
  putBlob,
  readBlobGz,
  readManifest,
  sameManifest,
  SHA256_RE,
} from "../tmcode/projects/storage";

/**
 * TMCode Projects API (PROJECTS_PLAN.md §3; contract in
 * server/src/tmcode/PROJECTS_API.md). Every route runs behind
 * tmcodeUserAuth (TMCode user token or TM web token) and answers errors as
 * `{error_code, message, ...}`.
 */

const validation = (res: Response, error: z.ZodError) =>
  tmcodeError(res, 400, "VALIDATION_ERROR", "Invalid request.", {
    errors: error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
  });

const has = (req: Request, key: string) => !!req.user?.permissions?.has(key);
const notFound = (res: Response) => tmcodeError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
const ownerOnly = (res: Response) =>
  tmcodeError(res, 403, "FORBIDDEN", "Only the project's owner can do that.");

/** Resolve :id -> access, or answer 404. */
async function accessOr404(req: Request, res: Response): Promise<ProjectAccess | null> {
  const access = await resolveProjectAccess(req, Number(req.params.id));
  if (!access) notFound(res);
  return access;
}

/** Record a timeline event (and bump last_activity_at); publish it after the caller commits. */
export async function recordEvent(
  projectId: number,
  userId: number | null,
  type: string,
  data: Record<string, unknown> = {},
  transaction?: Transaction,
) {
  const event = await ProjectEvent.create(
    { project_id: projectId, user_id: userId, type, data, created_at: new Date() } as any,
    { transaction },
  );
  await Project.update({ last_activity_at: new Date() }, { where: { id: projectId }, transaction, silent: true } as any);
  return event;
}

export function publishEvent(event: ProjectEvent) {
  projectsBus.publish(projectTopic(event.project_id), "event", eventJson(event));
}

const slugify = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "project";

export async function uniqueSlug(ownerId: number, name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set(
    (
      await Project.findAll({
        where: { owner_id: ownerId, slug: { [Op.like]: `${base}%` } },
        attributes: ["slug"],
      })
    ).map((p) => p.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** "owner/repo" for github.com URLs (https or ssh). */
function githubFullName(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

const repoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((u) => /^(https:\/\/|git@)[^\s]+$/.test(u), "Use an https:// or git@ repository URL");

const monitorProject = (p: Project, owner: User | null | undefined): MonitorProject => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  language: p.language ?? null,
  owner: userBrief(owner, p.owner_id),
});

// ─── Projects ────────────────────────────────────────────────────────────────

// @desc    List projects: mine (owner), shared (member), all (PROJECTS_VIEW_ALL),
//          with head, presence and links summaries.
// @route   GET /api/tmcode/projects?scope=mine|shared|all&q=&kind=&archived=exclude|include|only
export const listProjects = async (req: Request, res: Response) => {
  const parsed = z
    .object({
      scope: z.enum(["mine", "shared", "all"]).default("mine"),
      q: z.string().trim().max(100).optional(),
      kind: z.enum(["github", "tm"]).optional(),
      archived: z.enum(["exclude", "include", "only"]).default("exclude"),
      // "active" = everything but removed (the default); "all" includes removed.
      status: z.enum(["active", "all", "draft", "submitted", "graded", "removed"]).default("active"),
    })
    .safeParse(req.query);
  if (!parsed.success) return validation(res, parsed.error);
  const { scope, q, kind, archived, status } = parsed.data;
  const userId = Number(req.user.id);

  if (scope === "all" && !has(req, "PROJECTS_VIEW_ALL")) {
    return tmcodeError(res, 403, "FORBIDDEN", "Missing required permission: PROJECTS_VIEW_ALL");
  }
  if (scope !== "all" && !has(req, "PROJECTS_USE")) {
    return tmcodeError(res, 403, "FORBIDDEN", "Missing required permission: PROJECTS_USE");
  }

  const where: any = {};
  let memberRoles = new Map<number, string>();
  if (scope === "mine") where.owner_id = userId;
  if (scope === "shared") {
    const rows = await ProjectMember.findAll({
      where: { user_id: userId, status: { [Op.ne]: "removed" }, role: { [Op.ne]: "owner" } },
    });
    memberRoles = new Map(rows.map((m) => [m.project_id, m.role]));
    where.id = { [Op.in]: [...memberRoles.keys()] };
    where.owner_id = { [Op.ne]: userId };
  }
  if (kind) where.kind = kind;
  if (archived === "exclude") where.archived_at = null;
  if (archived === "only") where.archived_at = { [Op.ne]: null };
  // Counts per status ignore the status filter, so the filter chips can show them.
  const countWhere = { ...where };
  if (status === "active") where.status = { [Op.ne]: "removed" };
  else if (status !== "all") where.status = status;
  if (q) where[Op.or as any] = [{ name: { [Op.like]: `%${q}%` } }, { description: { [Op.like]: `%${q}%` } }];

  const statusCounts: Record<ProjectStatus, number> = { draft: 0, submitted: 0, graded: 0, removed: 0 };
  if (!(scope === "shared" && memberRoles.size === 0)) {
    const grouped = (await Project.findAll({
      where: countWhere,
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
      group: ["status"],
      raw: true,
    })) as unknown as { status: ProjectStatus; n: number }[];
    for (const g of grouped) statusCounts[g.status] = Number(g.n);
  }

  const projects = scope === "shared" && memberRoles.size === 0
    ? []
    : await Project.findAll({
        where,
        order: [
          ["last_activity_at", "DESC"],
          ["updated_at", "DESC"],
        ],
        limit: 500,
      });
  const ids = projects.map((p) => p.id);
  const [owners, heads, presence, links, assignments] = await Promise.all([
    usersById(projects.map((p) => p.owner_id)),
    ids.length
      ? ProjectRevision.findAll({
          where: { id: { [Op.in]: projects.map((p) => p.head_revision_id).filter((x): x is number => !!x) } },
          attributes: { exclude: ["manifest_gz"] },
        })
      : [],
    ids.length ? ProjectPresence.findAll({ where: { project_id: { [Op.in]: ids } } }) : [],
    ids.length ? ProjectActivityLink.findAll({ where: { project_id: { [Op.in]: ids } } }) : [],
    assignmentBriefs(projects.map((p) => p.assignment_id)),
  ]);
  const headById = new Map(heads.map((r) => [r.id, r]));
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;

  const rows = projects.map((p) => {
    const myRole = p.owner_id === userId ? "owner" : memberRoles.get(p.id) ?? "admin";
    const head = p.head_revision_id ? headById.get(p.head_revision_id) : null;
    const pLinks = links.filter((l) => l.project_id === p.id);
    const assignment = p.assignment_id ? assignments.get(p.assignment_id) ?? null : null;
    // Admins (scope=all) don't see live status the owner chose not to share.
    const hidePresence = myRole === "admin" && p.share_presence === false;
    return {
      ...projectCore(p, userBrief(owners.get(p.owner_id), p.owner_id), myRole),
      assignment,
      read_only: isReadOnlyStatus(assignment?.status),
      head: head ? revisionJson(head) : null,
      presence: hidePresence
        ? { ...HIDDEN_PRESENCE }
        : presenceSummary(
            presence.filter((r) => r.project_id === p.id),
            now,
          ),
      links: {
        total: pLinks.length,
        submitted: pLinks.filter((l) => l.status === "submitted").length,
        items: pLinks.map((l) => ({
          id: l.id,
          activity_type: l.activity_type,
          activity_id: l.activity_id,
          question_id: l.question_id ?? null,
          status: l.status,
        })),
      },
    };
  });

  return res.status(200).json({
    projects: rows,
    stats: {
      total: rows.length,
      online: rows.filter((r) => r.presence.online).length,
      active_this_week: rows.filter((r) => r.last_activity_at && new Date(r.last_activity_at).getTime() >= weekAgo)
        .length,
      revisions: rows.reduce((n, r) => n + (r.head?.number ?? 0), 0),
      submissions: rows.reduce((n, r) => n + r.links.submitted, 0),
      by_status: statusCounts,
    },
  });
};

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional().nullable(),
  language: z.string().trim().max(60).optional().nullable(),
  kind: z.enum(["github", "tm"]).default("tm"),
  visibility: z.enum(["private", "course"]).default("private"),
  repo_url: repoUrlSchema.optional().nullable(),
  default_branch: z.string().trim().max(120).optional().nullable(),
  github_username: z.string().trim().regex(/^[A-Za-z0-9-]{1,39}$/).optional().nullable(),
  /** Optional: create it as the caller's work for this assignment (links it, sets assignment_id). */
  assignment_id: z.number().int().positive().optional().nullable(),
});

// @desc    Create a project (owner = the caller). With `assignment_id`, it is
//          created as the caller's work for that assignment: linked to it and
//          set as their workspace. The assignment must accept TMCode projects,
//          be open and in the caller's courses; an assignment with starter files
//          is started instead (POST /assignments/:id/start seeds them).
// @route   POST /api/tmcode/projects
export const createProject = async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const body = parsed.data;
  const userId = Number(req.user.id);
  const limits = projectLimits();

  const count = await Project.count({ where: { owner_id: userId } });
  if (count >= limits.maxProjectsPerUser) {
    return tmcodeError(res, 409, "QUOTA_EXCEEDED", `You can keep at most ${limits.maxProjectsPerUser} projects.`, {
      limit: "projects",
      max: limits.maxProjectsPerUser,
    });
  }
  if (body.kind === "tm" && body.repo_url) {
    return tmcodeError(res, 422, "PROJECT_KIND", "Only GitHub projects have a repository URL.");
  }

  let forAssignment: Awaited<ReturnType<typeof loadActivity>> = null;
  if (body.assignment_id) {
    forAssignment = await loadActivity("assignment", body.assignment_id);
    if (!forAssignment) return tmcodeError(res, 404, "ACTIVITY_NOT_FOUND", "Assignment not found.");
    if (!(await userMayUseActivity(req, forAssignment))) {
      return tmcodeError(res, 403, "ACTIVITY_NOT_IN_SCOPE", "This assignment isn't in your courses.");
    }
    if (isReadOnlyStatus(forAssignment.status)) {
      return tmcodeError(res, 409, "ASSIGNMENT_COMPLETED", "This assignment is completed; it can't be started any more.");
    }
    if (!forAssignment.open) return tmcodeError(res, 409, "ACTIVITY_CLOSED", "This assignment is closed.");
    const a = await Assignment.findByPk(body.assignment_id, { attributes: ["id", "submission_type"] });
    if (a?.submission_type !== "project") {
      return tmcodeError(res, 422, "NOT_A_PROJECT_ASSIGNMENT", "This assignment doesn't take a TMCode project.");
    }
    const tm = await AssignmentTmcode.findByPk(body.assignment_id).catch(() => null);
    if (tm?.tmcode_starter_project_id) {
      return tmcodeError(
        res,
        409,
        "USE_START",
        "This assignment comes with starter files from your teacher. Start it instead, to get them.",
        { assignment_id: body.assignment_id },
      );
    }
    const mine = await Project.findAll({ where: { owner_id: userId }, attributes: ["id", "assignment_id", "status"] });
    const already =
      mine.find((x) => x.assignment_id === body.assignment_id && x.status !== "removed") ??
      (mine.length
        ? await ProjectActivityLink.findOne({
            where: {
              activity_type: "assignment",
              activity_id: body.assignment_id,
              project_id: { [Op.in]: mine.filter((x) => x.status !== "removed").map((x) => x.id) },
            },
          })
        : null);
    if (already) {
      const projectId = "project_id" in already ? (already as ProjectActivityLink).project_id : (already as Project).id;
      return tmcodeError(res, 409, "ALREADY_LINKED", "You already have a project for this assignment.", {
        project_id: projectId,
      });
    }
  }

  const transaction = await sequelize.transaction();
  let project: Project;
  let event: ProjectEvent;
  try {
    project = await Project.create(
      {
        owner_id: userId,
        name: body.name,
        slug: await uniqueSlug(userId, body.name),
        description: body.description ?? null,
        language: body.language ?? null,
        kind: body.kind,
        visibility: body.visibility,
        repo_url: body.repo_url ?? null,
        repo_full_name: githubFullName(body.repo_url),
        default_branch: body.default_branch ?? null,
        last_activity_at: new Date(),
        assignment_id: forAssignment && body.kind === "tm" ? forAssignment.id : null,
        // a workspace is seen by the course's teachers
        ...(forAssignment ? { visibility: "course" } : {}),
      } as any,
      { transaction },
    );
    if (forAssignment) {
      await ProjectActivityLink.create(
        {
          project_id: project.id,
          activity_type: "assignment",
          activity_id: forAssignment.id,
          linked_by: userId,
          status: "linked",
        } as any,
        { transaction },
      );
    }
    await ProjectMember.create(
      {
        project_id: project.id,
        user_id: userId,
        role: "owner",
        github_username: body.github_username ?? null,
        invited_by: null,
        status: "active",
      } as any,
      { transaction },
    );
    event = await recordEvent(project.id, userId, "created", { kind: project.kind }, transaction);
    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  publishEvent(event);
  return res.status(201).json({ project: await projectDetails(req, (await Project.findByPk(project.id))!, "owner") });
};

/** May the owner turn "Share live status" off? Not for an open assignment's workspace. */
const presenceShareLocked = (assignment: AssignmentBrief | null) => !!assignment && presenceLocked(assignment.status);

/** Staff (admin / teacher) don't see the live status of a project that doesn't share it. */
const hidesPresenceFrom = (p: Project, myRole: string) =>
  p.share_presence === false && (myRole === "admin" || myRole === "teacher");

export async function projectDetails(req: Request, p: Project, myRole: string, access?: ProjectAccess) {
  const [members, links, events, rawPresence, head, briefs] = await Promise.all([
    ProjectMember.findAll({ where: { project_id: p.id, status: { [Op.ne]: "removed" } }, order: [["id", "ASC"]] }),
    ProjectActivityLink.findAll({ where: { project_id: p.id }, order: [["id", "ASC"]] }),
    ProjectEvent.findAll({ where: { project_id: p.id }, order: [["id", "DESC"]], limit: 20 }),
    ProjectPresence.findAll({ where: { project_id: p.id }, order: [["last_seen_at", "DESC"]] }),
    p.head_revision_id
      ? ProjectRevision.findByPk(p.head_revision_id, { attributes: { exclude: ["manifest_gz"] } })
      : null,
    assignmentBriefs([p.assignment_id]),
  ]);
  const presence = hidesPresenceFrom(p, myRole) ? [] : rawPresence;
  const assignment = p.assignment_id ? briefs.get(p.assignment_id) ?? null : null;
  const readOnly = isReadOnlyStatus(assignment?.status);
  const users = await usersById([
    p.owner_id,
    ...members.map((m) => m.user_id),
    ...events.map((e) => e.user_id),
    ...presence.map((r) => r.user_id),
    head?.author_id,
  ]);
  const revNumbers = new Map<number, number>();
  const frozen = links.map((l) => l.revision_id).filter((x): x is number => !!x);
  if (frozen.length) {
    (await ProjectRevision.findAll({ where: { id: frozen }, attributes: ["id", "number"] })).forEach((r) =>
      revNumbers.set(r.id, r.number),
    );
  }
  const activities = await Promise.all(links.map((l) => loadActivity(l.activity_type, l.activity_id)));
  const canSeeHead = !access || access.allRevisions;
  const now = Date.now();
  return {
    ...projectCore(p, userBrief(users.get(p.owner_id), p.owner_id), myRole),
    assignment,
    read_only: readOnly,
    head: head && canSeeHead ? revisionJson(head, users) : null,
    members: p.kind === "github" ? members.map((m) => memberJson(m, users)) : [],
    links: links.map((l, i) => linkJson(l, activities[i], l.revision_id ? revNumbers.get(l.revision_id) : null)),
    events: events.map((e) => eventJson(e, users)),
    presence: presence.map((r) => presenceJson(r, users, now)),
    presence_summary: presenceSummary(presence, now),
    can: {
      edit: myRole === "owner",
      save: myRole === "owner" && p.kind === "tm" && !p.archived_at && !readOnly,
      report_git: myRole === "owner" || myRole === "collaborator",
      read_all_revisions: canSeeHead,
      share_presence: myRole === "owner" && !presenceShareLocked(assignment),
    },
  };
}

// @desc    Details: members, links, last 20 events, presence.
// @route   GET /api/tmcode/projects/:id
export const getProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  return res.status(200).json({ project: await projectDetails(req, access.project, access.role, access) });
};

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).nullable().optional(),
  language: z.string().trim().max(60).nullable().optional(),
  visibility: z.enum(["private", "course"]).optional(),
  repo_url: repoUrlSchema.nullable().optional(),
  default_branch: z.string().trim().max(120).nullable().optional(),
  archived: z.boolean().optional(),
  share_presence: z.boolean().optional(),
});

// @desc    Rename, describe, change visibility, archive / unarchive (owner).
//          The slug never changes (TMCode keys local folders by it).
// @route   PATCH /api/tmcode/projects/:id
export const updateProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const body = parsed.data;
  const p = access.project;
  if (body.repo_url && p.kind !== "github") {
    return tmcodeError(res, 422, "PROJECT_KIND", "Only GitHub projects have a repository URL.");
  }

  const changed: string[] = [];
  for (const key of ["name", "description", "language", "visibility", "default_branch"] as const) {
    if (body[key] !== undefined && body[key] !== (p as any)[key]) {
      (p as any)[key] = body[key];
      changed.push(key);
    }
  }
  if (body.repo_url !== undefined && body.repo_url !== p.repo_url) {
    p.repo_url = body.repo_url;
    p.repo_full_name = githubFullName(body.repo_url);
    changed.push("repo_url");
  }
  if (body.share_presence !== undefined && body.share_presence !== (p.share_presence !== false)) {
    if (!body.share_presence && p.assignment_id) {
      const brief = (await assignmentBriefs([p.assignment_id])).get(p.assignment_id) ?? null;
      if (presenceShareLocked(brief)) {
        return tmcodeError(
          res,
          409,
          "PRESENCE_LOCKED",
          "Live status stays on while the assignment is open, so your teacher can follow the practical.",
        );
      }
    }
    p.share_presence = body.share_presence;
    changed.push("share_presence");
  }
  let type = "updated";
  if (body.archived !== undefined && body.archived !== !!p.archived_at) {
    p.archived_at = body.archived ? new Date() : null;
    type = body.archived ? "archived" : "unarchived";
    changed.push("archived");
  }
  if (changed.length === 0) {
    return res.status(200).json({ project: await projectDetails(req, p, access.role, access) });
  }
  p.last_activity_at = new Date();
  await p.save();
  if (changed.includes("share_presence") && !p.share_presence) withdrawPresence(p.id);
  const event = await recordEvent(p.id, req.user.id, type, { fields: changed });
  publishEvent(event);
  const details = await projectDetails(req, p, access.role, access);
  projectsBus.publish(projectTopic(p.id), "project", projectCore(p, details.owner, "owner"));
  return res.status(200).json({ project: details });
};

/** Set by deleteProject: the blob clean-up running after the response (tests await it). */
export let pendingBlobGc: Promise<number> | null = null;

// @desc    Delete a project (owner). Refused while a link is submitted (the
//          frozen revision is the teacher's copy) -- archive it instead.
//          Blobs no other revision uses are removed afterwards.
// @route   DELETE /api/tmcode/projects/:id
export const deleteProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  const submitted = await ProjectActivityLink.count({ where: { project_id: p.id, status: "submitted" } });
  if (submitted > 0 || p.status === "submitted" || p.status === "graded") {
    return tmcodeError(res, 409, "PROJECT_SUBMITTED", "This project was submitted for an activity. Archive it instead.");
  }

  // Removing is a soft delete (status "removed"): the work stays on record for the
  // teacher and the owner can restore it. Deleting for good is a second step, only
  // for an already-removed project (?permanent=1).
  const permanent = req.query.permanent === "1" || req.query.permanent === "true";
  if (!permanent) {
    if (p.status !== "removed") {
      await p.update({ status: "removed", status_changed_at: new Date(), status_changed_by: Number(req.user.id) });
      publishEvent(await recordEvent(p.id, req.user.id, "removed", {}));
    }
    return res.status(200).json({ ok: true, removed: true, status: "removed" });
  }
  if (p.status !== "removed") {
    return tmcodeError(res, 409, "REMOVE_FIRST", "Remove the project first; it can then be deleted for good.");
  }

  const revisions = await ProjectRevision.findAll({ where: { project_id: p.id }, attributes: ["id", "manifest_gz"] });
  const candidates = new Set<string>();
  revisions.forEach((r) => readManifest(r).forEach((f) => candidates.add(f.sha256)));

  await sequelize.transaction(async (transaction) => {
    const where = { project_id: p.id };
    await ProjectEvent.destroy({ where, transaction });
    await ProjectActivityLink.destroy({ where, transaction });
    await ProjectPresence.destroy({ where, transaction });
    await ProjectMember.destroy({ where, transaction });
    await ProjectRevision.destroy({ where, transaction });
    await p.destroy({ transaction });
  });
  forgetProjectCourses(p.id);
  projectsBus.publish(projectTopic(p.id), "deleted", { project_id: p.id });

  pendingBlobGc = collectUnusedBlobs(candidates).catch((e) => {
    console.error("[projects] blob clean-up failed:", e?.message);
    return 0;
  });
  return res.status(200).json({ ok: true });
};

// ─── Revisions ───────────────────────────────────────────────────────────────

// @desc    Revision list, newest first (?limit=50, max 200; ?before=<number>).
// @route   GET /api/tmcode/projects/:id/revisions
export const listRevisions = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const before = Number(req.query.before) || null;
  const where: any = { project_id: access.project.id };
  if (before) where.number = { [Op.lt]: before };
  if (!access.allRevisions) where.id = { [Op.in]: [...access.revisionIds] };
  const rows = await ProjectRevision.findAll({
    where,
    attributes: { exclude: ["manifest_gz"] },
    order: [["number", "DESC"]],
    limit,
  });
  const users = await usersById(rows.map((r) => r.author_id));
  return res.status(200).json({
    head_revision_id: access.allRevisions ? access.project.head_revision_id ?? null : null,
    revisions: rows.map((r) => revisionJson(r, users)),
  });
};

/** `rev` = a revision id or "head"; null when unknown, not this project's, or not readable. */
async function revisionFor(access: ProjectAccess, rev: unknown): Promise<ProjectRevision | null> {
  const id = rev === undefined || rev === "" || rev === "head" ? access.project.head_revision_id : Number(rev);
  if (!id || !Number.isInteger(id)) return null;
  const r = await ProjectRevision.findByPk(id);
  if (!r || r.project_id !== access.project.id || !canReadRevision(access, r.id)) return null;
  return r;
}

// @desc    One revision's file list.
// @route   GET /api/tmcode/projects/:id/revisions/:rev/manifest   (:rev = id or "head")
export const getManifest = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const rev = await revisionFor(access, req.params.rev);
  if (!rev) return tmcodeError(res, 404, "REVISION_NOT_FOUND", "Revision not found.");
  const users = await usersById([rev.author_id]);
  return res.status(200).json({ revision: revisionJson(rev, users), files: readManifest(rev) });
};

const commitSchema = z.object({
  base_revision_id: z.number().int().positive().nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  files: z.array(
    z.object({
      path: z.string(),
      sha256: z.string().regex(SHA256_RE, "lowercase sha256 hex"),
      size: z.number().int().min(0),
    }),
  ),
  source: z.enum(["save", "auto", "submit"]).default("save"),
});

// @desc    Commit a revision of a Task Mentor project. Every blob must be
//          uploaded first (422 BLOBS_MISSING); the base must be the current
//          head (409 REVISION_CONFLICT {head}). Same files as the head ->
//          200 {revision: head, unchanged: true}, no new revision.
// @route   POST /api/tmcode/projects/:id/revisions
export const commitRevision = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  if (p.kind !== "tm") {
    return tmcodeError(res, 409, "PROJECT_KIND", "GitHub projects keep their files on GitHub; push there instead.");
  }
  if (p.archived_at) return tmcodeError(res, 409, "PROJECT_ARCHIVED", "This project is archived. Unarchive it to save.");
  if (p.assignment_id) {
    const brief = (await assignmentBriefs([p.assignment_id])).get(p.assignment_id);
    if (isReadOnlyStatus(brief?.status)) {
      return tmcodeError(
        res,
        409,
        "ASSIGNMENT_READ_ONLY",
        "This assignment is completed. Its workspace is read-only.",
        { assignment_id: p.assignment_id },
      );
    }
  }
  const locked = lockReason(p.status);
  if (locked) return tmcodeError(res, 409, locked.code, locked.message, { status: p.status });

  const limits = projectLimits();
  const files = Array.isArray(req.body?.files) ? req.body.files : null;
  if (files && files.length > limits.maxFiles) {
    return tmcodeError(res, 413, "QUOTA_EXCEEDED", `A project may have at most ${limits.maxFiles} files.`, {
      limit: "files",
      max: limits.maxFiles,
    });
  }
  const parsed = commitSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const body = parsed.data;

  const seen = new Set<string>();
  let total = 0;
  for (const f of body.files) {
    const reason = invalidPathReason(f.path);
    if (reason) return tmcodeError(res, 422, "INVALID_PATH", `Invalid path: ${reason}.`, { path: f.path });
    if (seen.has(f.path)) return tmcodeError(res, 422, "DUPLICATE_PATH", "The same path is listed twice.", { path: f.path });
    seen.add(f.path);
    if (f.size > limits.maxFileBytes) {
      return tmcodeError(res, 413, "QUOTA_EXCEEDED", `A file may be at most ${limits.maxFileBytes} bytes.`, {
        limit: "file_size",
        max: limits.maxFileBytes,
        path: f.path,
      });
    }
    total += f.size;
  }
  if (total > limits.maxProjectBytes) {
    return tmcodeError(res, 413, "QUOTA_EXCEEDED", `A project may be at most ${limits.maxProjectBytes} bytes.`, {
      limit: "project_size",
      max: limits.maxProjectBytes,
    });
  }

  const shas = body.files.map((f) => f.sha256);
  const missing = await missingBlobs(shas);
  if (missing.length > 0) {
    return tmcodeError(res, 422, "BLOBS_MISSING", "Upload these blobs first.", { missing });
  }
  const sizes = await blobSizes(shas);
  const wrongSize = body.files.find((f) => sizes.get(f.sha256) !== f.size);
  if (wrongSize) {
    return tmcodeError(res, 422, "SIZE_MISMATCH", "A file's size does not match its stored content.", {
      path: wrongSize.path,
      size: sizes.get(wrongSize.sha256),
    });
  }

  const manifest: ManifestEntry[] = body.files
    .map((f) => ({ path: f.path, sha256: f.sha256, size: f.size }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const base = body.base_revision_id ?? null;

  const transaction = await sequelize.transaction();
  let revision: ProjectRevision;
  let event: ProjectEvent;
  try {
    const locked = await Project.findByPk(p.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!locked) {
      await transaction.rollback();
      return notFound(res);
    }
    const headId = locked.head_revision_id ?? null;
    const head = headId ? await ProjectRevision.findByPk(headId, { transaction }) : null;
    if (headId !== base) {
      await transaction.rollback();
      const users = await usersById([head?.author_id]);
      return tmcodeError(res, 409, "REVISION_CONFLICT", "Task Mentor has a newer revision. Pull it first.", {
        head: head ? revisionJson(head, users) : null,
      });
    }
    if (head && sameManifest(readManifest(head), manifest)) {
      await transaction.rollback();
      const users = await usersById([head.author_id]);
      return res.status(200).json({ revision: revisionJson(head, users), unchanged: true });
    }
    revision = await ProjectRevision.create(
      {
        project_id: p.id,
        number: (head?.number ?? 0) + 1,
        parent_id: head?.id ?? null,
        author_id: req.user.id,
        message: body.message?.trim() || null,
        manifest_gz: gzipManifest(manifest),
        file_count: manifest.length,
        size_bytes: total,
        source: body.source,
        created_at: new Date(),
      } as any,
      { transaction },
    );
    await Project.update(
      { head_revision_id: revision.id, size_bytes: total, file_count: manifest.length },
      { where: { id: p.id }, transaction },
    );
    event = await recordEvent(
      p.id,
      req.user.id,
      "saved",
      { revision_id: revision.id, number: revision.number, source: body.source, file_count: manifest.length },
      transaction,
    );
    await transaction.commit();
  } catch (e) {
    await transaction.rollback().catch(() => {});
    throw e;
  }

  const users = await usersById([revision.author_id]);
  const json = revisionJson(revision, users);
  projectsBus.publish(projectTopic(p.id), "revision", json);
  publishEvent(event);
  return res.status(201).json({ revision: json });
};

// ─── Blobs ───────────────────────────────────────────────────────────────────

// @desc    Which of these blobs does Task Mentor not have yet?
// @route   POST /api/tmcode/projects/:id/blobs/missing   {sha256: string[]} -> {missing}
export const blobsMissing = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const parsed = z
    .object({ sha256: z.array(z.string().regex(SHA256_RE, "lowercase sha256 hex")).max(20_000) })
    .safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  return res.status(200).json({ missing: await missingBlobs(parsed.data.sha256) });
};

// @desc    Upload one blob: the raw gzip'd file as the body
//          (Content-Type: application/gzip, no Content-Encoding). The server
//          gunzips it and checks the sha256 and size (X-Blob-Size or ?size=).
// @route   PUT /api/tmcode/projects/:id/blobs/:sha
export const putBlobHandler = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  if (access.project.kind !== "tm") {
    return tmcodeError(res, 409, "PROJECT_KIND", "GitHub projects keep their files on GitHub.");
  }
  if (access.project.archived_at) {
    return tmcodeError(res, 409, "PROJECT_ARCHIVED", "This project is archived. Unarchive it to save.");
  }
  const sizeRaw = req.headers["x-blob-size"] ?? req.query.size;
  const declared = sizeRaw === undefined || sizeRaw === "" ? null : Number(sizeRaw);
  if (declared !== null && (!Number.isInteger(declared) || declared < 0)) {
    return tmcodeError(res, 400, "VALIDATION_ERROR", "X-Blob-Size must be a whole number of bytes.");
  }
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  try {
    const out = await putBlob(String(req.params.sha), body, declared);
    return res.status(out.existed ? 200 : 201).json({
      sha256: out.sha256,
      size: out.size,
      stored: out.storage,
      existed: out.existed,
    });
  } catch (e) {
    if (e instanceof BlobError) return tmcodeError(res, e.status, e.code, e.message, e.extra);
    throw e;
  }
}

/** Is `sha` a file of a revision of this project the caller may read? */
async function blobReadable(access: ProjectAccess, sha: string): Promise<boolean> {
  const where: any = { project_id: access.project.id };
  if (!access.allRevisions) where.id = { [Op.in]: [...access.revisionIds] };
  // Head first: the common case (a pull) needs nothing older.
  const order: any = [
    [sequelize.literal(`id = ${Number(access.project.head_revision_id) || 0}`), "DESC"],
    ["id", "DESC"],
  ];
  let offset = 0;
  for (;;) {
    const batch = await ProjectRevision.findAll({ where, attributes: ["id", "manifest_gz"], order, limit: 50, offset });
    if (batch.length === 0) return false;
    if (batch.some((r) => readManifest(r).some((f) => f.sha256 === sha))) return true;
    offset += batch.length;
  }
}

// @desc    Download one blob (gzip body, Content-Type application/gzip).
// @route   GET /api/tmcode/projects/:id/blobs/:sha
export const getBlob = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const sha = String(req.params.sha);
  if (!SHA256_RE.test(sha) || !(await blobReadable(access, sha))) {
    return tmcodeError(res, 404, "BLOB_NOT_FOUND", "No such file in this project.");
  }
  const gz = await readBlobGz(sha);
  if (!gz) return tmcodeError(res, 404, "BLOB_NOT_FOUND", "The file's content is missing.");
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  return res.status(200).send(gz);
};

// @desc    One file's content at a revision (TM web viewer). ?rev=<id>|head.
// @route   GET /api/tmcode/projects/:id/files/*path
export const getFile = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const path = String((req.params as any)[0] ?? "");
  const reason = invalidPathReason(path);
  if (reason) return tmcodeError(res, 422, "INVALID_PATH", `Invalid path: ${reason}.`, { path });
  const rev = await revisionFor(access, req.query.rev);
  if (!rev) return tmcodeError(res, 404, "REVISION_NOT_FOUND", "Revision not found.");
  const entry = readManifest(rev).find((f) => f.path === path);
  if (!entry) return tmcodeError(res, 404, "FILE_NOT_FOUND", "No such file in this revision.");
  const gz = await readBlobGz(entry.sha256);
  if (!gz) return tmcodeError(res, 404, "FILE_NOT_FOUND", "The file's content is missing.");
  const raw = zlib.gunzipSync(gz);
  const binary = raw.subarray(0, 8000).includes(0);
  res.setHeader("Content-Type", binary ? "application/octet-stream" : "text/plain; charset=utf-8");
  res.setHeader("X-Revision-Id", String(rev.id));
  res.setHeader("X-Sha256", entry.sha256);
  res.setHeader("Cache-Control", "private, no-cache");
  return res.status(200).send(raw);
};

// ─── Presence and live streams ───────────────────────────────────────────────

const presenceSchema = z.object({
  device_id: z.string().trim().min(1).max(64),
  app_version: z.string().trim().max(20).nullable().optional(),
  state: z.record(z.string(), z.unknown()).default({}),
});

// @desc    TMCode heartbeat for an open project (every 20 s; {open:false} on
//          close). One row per (project, user, device).
// @route   PUT /api/tmcode/projects/:id/presence
export const putPresence = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.canPresence) return tmcodeError(res, 403, "FORBIDDEN", "Only the project's members report presence.");
  const parsed = presenceSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const { device_id, app_version } = parsed.data;
  const state = { open: true, ...parsed.data.state };
  if (JSON.stringify(state).length > 8192) {
    return tmcodeError(res, 413, "STATE_TOO_LARGE", "The presence state may be at most 8 KB.");
  }
  const p = access.project;
  const userId = Number(req.user.id);
  const key = { project_id: p.id, user_id: userId, device_id };
  const before = await ProjectPresence.findOne({ where: key });
  const now = new Date();
  await ProjectPresence.bulkCreate([{ ...key, app_version: app_version ?? null, state, last_seen_at: now } as any], {
    updateOnDuplicate: ["app_version", "state", "last_seen_at"],
  });
  const row = (await ProjectPresence.findOne({ where: key }))!;

  const wasOnline = before ? isOnline(before, now.getTime()) : false;
  if (state.open !== false && !wasOnline) {
    publishEvent(await recordEvent(p.id, userId, "opened", { device_id, file: (state as any).file ?? null }));
  }

  const all = await ProjectPresence.findAll({ where: { project_id: p.id }, order: [["last_seen_at", "DESC"]] });
  const users = await usersById([p.owner_id, ...all.map((r) => r.user_id)]);
  publishPresence(
    monitorProject(p, users.get(p.owner_id)),
    await projectCourseIds(p.id),
    presenceJson(row, users),
    p.share_presence !== false,
  );
  return res.status(200).json({ presence: all.map((r) => presenceJson(r, users)) });
};

// @desc    SSE: presence, revision, event, git, project, deleted for one project.
// @route   GET /api/tmcode/projects/:id/live
export const projectLive = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const p = access.project;
  const [presence, head] = await Promise.all([
    ProjectPresence.findAll({ where: { project_id: p.id } }),
    access.allRevisions && p.head_revision_id
      ? ProjectRevision.findByPk(p.head_revision_id, { attributes: { exclude: ["manifest_gz"] } })
      : null,
  ]);
  const users = await usersById([...presence.map((r) => r.user_id), head?.author_id]);
  // Staff stop seeing presence as soon as the owner stops sharing it.
  const staff = access.role === "admin" || access.role === "teacher";
  let hidden = staff && p.share_presence === false;

  const stream = openSse(req, res);
  stream.send("hello", {
    project_id: p.id,
    head: head ? revisionJson(head, users) : null,
    git: p.git_state ?? null,
    presence: hidden ? [] : presence.map((r) => presenceJson(r, users)),
  });
  const unsubscribe = projectsBus.subscribe(projectTopic(p.id), (event, data: any) => {
    // A teacher limited to frozen revisions doesn't follow the head.
    if (event === "revision" && !access.allRevisions) return;
    if (event === "project" && staff && typeof data?.share_presence === "boolean") hidden = !data.share_presence;
    if (event === "presence" && hidden) return;
    stream.send(event, data);
    if (event === "deleted") stream.close();
  });
  stream.onClose(unsubscribe);
};

// @desc    SSE for teachers: live presence of projects linked to activities
//          in their scoped courses (PROJECTS_VIEW_ALL: every project).
// @route   GET /api/tmcode/monitor/live
export const monitorLive = async (req: Request, res: Response) => {
  const scope = has(req, "PROJECTS_VIEW_ALL") ? null : await scopedCourseIds(req);
  const visible = (courseIds: number[]) => scope === null || courseIds.some((id) => scope.has(id));

  const since = new Date(Date.now() - presenceStaleMs());
  const rows = await ProjectPresence.findAll({ where: { last_seen_at: { [Op.gte]: since } } });
  const online = rows.filter((r) => isOnline(r));
  const projects = online.length
    ? await Project.findAll({ where: { id: { [Op.in]: [...new Set(online.map((r) => r.project_id))] } } })
    : [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const users = await usersById([...online.map((r) => r.user_id), ...projects.map((p) => p.owner_id)]);
  const entries: MonitorEntry[] = [];
  for (const r of online) {
    const p = byId.get(r.project_id);
    if (!p || p.share_presence === false) continue;
    const courseIds = await projectCourseIds(p.id);
    if (!visible(courseIds)) continue;
    entries.push({ project: monitorProject(p, users.get(p.owner_id)), course_ids: courseIds, presence: presenceJson(r, users) });
  }

  const stream = openSse(req, res);
  stream.send("hello", {
    scope: scope === null ? "all" : "courses",
    course_ids: scope === null ? null : [...scope].sort((a, b) => a - b),
    online: entries,
  });
  const unsubscribe = projectsBus.subscribe(MONITOR_TOPIC, (event, data: MonitorEntry) => {
    if (visible(data?.course_ids ?? [])) stream.send(event, data);
  });
  stream.onClose(unsubscribe);
};

// ─── Git (github projects) ───────────────────────────────────────────────────

const gitSchema = z.object({
  branch: z.string().max(200).nullable().optional(),
  head_commit: z.string().regex(/^[0-9a-f]{7,64}$/i).nullable().optional(),
  ahead: z.number().int().min(0).optional(),
  behind: z.number().int().min(0).optional(),
  changes: z.number().int().min(0).optional(),
  remote_url: z.string().max(500).nullable().optional(),
  pushed: z
    .object({ commit: z.string().regex(/^[0-9a-f]{7,64}$/i), message: z.string().max(500).nullable().optional() })
    .nullable()
    .optional(),
});

// @desc    TMCode reports git state (after commit/push/pull/fetch, every 2 min).
// @route   POST /api/tmcode/projects/:id/git
export const reportGit = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.canReportGit) return tmcodeError(res, 403, "FORBIDDEN", "Only the owner and collaborators report git state.");
  const p = access.project;
  if (p.kind !== "github") return tmcodeError(res, 409, "PROJECT_KIND", "Only GitHub projects report git state.");
  const parsed = gitSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const b = parsed.data;
  const now = new Date();
  const git = {
    branch: b.branch ?? null,
    head_commit: b.head_commit ?? null,
    ahead: b.ahead ?? 0,
    behind: b.behind ?? 0,
    changes: b.changes ?? 0,
    remote_url: b.remote_url ?? null,
    last_push: b.pushed
      ? { commit: b.pushed.commit, message: b.pushed.message ?? null, at: now.toISOString() }
      : p.git_state?.last_push ?? null,
    reported_at: now.toISOString(),
  };
  p.git_state = git;
  p.last_activity_at = now;
  if (!p.repo_url && b.remote_url && /^(https:\/\/|git@)/.test(b.remote_url)) {
    p.repo_url = b.remote_url;
    p.repo_full_name = githubFullName(b.remote_url);
  }
  if (!p.default_branch && b.branch) p.default_branch = b.branch;
  await p.save();
  if (b.pushed) {
    publishEvent(
      await recordEvent(p.id, req.user.id, "pushed", {
        commit: b.pushed.commit,
        message: b.pushed.message ?? null,
        branch: git.branch,
      }),
    );
  }
  projectsBus.publish(projectTopic(p.id), "git", { project_id: p.id, git });
  return res.status(200).json({ git });
};

// ─── Members (github projects only) ──────────────────────────────────────────

const memberSchema = z
  .object({
    user_id: z.number().int().positive().optional(),
    email: z.string().trim().email().optional(),
    github_username: z.string().trim().regex(/^[A-Za-z0-9-]{1,39}$/, "not a GitHub username").nullable().optional(),
    role: z.enum(["collaborator", "viewer"]).default("collaborator"),
  })
  .refine((b) => b.user_id || b.email, { message: "user_id or email is required" });

// @desc    Add (or update) a member. GitHub projects only; TMCode grants the
//          GitHub access itself with the owner's token.
// @route   POST /api/tmcode/projects/:id/members
export const addMember = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  if (p.kind !== "github") {
    return tmcodeError(res, 422, "MEMBERS_GITHUB_ONLY", "Only GitHub projects have collaborators.");
  }
  const parsed = memberSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const b = parsed.data;
  const user = b.user_id ? await User.findByPk(b.user_id) : await User.findOne({ where: { email: b.email! } });
  if (!user) return tmcodeError(res, 404, "USER_NOT_FOUND", "No Task Mentor user with that id or email.");
  if (user.id === p.owner_id) return tmcodeError(res, 422, "ALREADY_OWNER", "The owner is already on the project.");

  const existing = await ProjectMember.findOne({ where: { project_id: p.id, user_id: user.id } });
  let member: ProjectMember;
  if (existing) {
    existing.role = b.role;
    existing.status = "active";
    if (b.github_username !== undefined) existing.github_username = b.github_username;
    existing.invited_by = req.user.id;
    member = await existing.save();
  } else {
    member = await ProjectMember.create({
      project_id: p.id,
      user_id: user.id,
      role: b.role,
      github_username: b.github_username ?? null,
      invited_by: req.user.id,
      status: "active",
    } as any);
  }
  publishEvent(
    await recordEvent(p.id, req.user.id, "member_added", {
      user_id: user.id,
      role: b.role,
      github_username: member.github_username ?? null,
    }),
  );
  return res.status(existing ? 200 : 201).json({ member: memberJson(member, new Map([[user.id, user]])) });
};

// @desc    Remove a member (owner), or leave the project (the member).
// @route   DELETE /api/tmcode/projects/:id/members/:userId
export const removeMember = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const target = Number(req.params.userId);
  const self = target === Number(req.user.id);
  if (!access.isOwner && !self) return ownerOnly(res);
  if (target === access.project.owner_id) {
    return tmcodeError(res, 422, "ALREADY_OWNER", "The owner can't be removed from their project.");
  }
  const member = await ProjectMember.findOne({
    where: { project_id: access.project.id, user_id: target, status: { [Op.ne]: "removed" } },
  });
  if (!member) return tmcodeError(res, 404, "MEMBER_NOT_FOUND", "Not a member of this project.");
  member.status = "removed";
  await member.save();
  publishEvent(await recordEvent(access.project.id, req.user.id, "member_removed", { user_id: target }));
  return res.status(200).json({ ok: true });
};

// @desc    The tmcode:// deep link that opens the project in TMCode.
// @route   GET /api/tmcode/projects/:id/open-link
export const openLink = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  const api = encodeURIComponent(apiOrigin(req));
  return res.status(200).json({ deeplink: `tmcode://project?id=${access.project.id}&api=${api}` });
};

// ─── Activity links ──────────────────────────────────────────────────────────

// @desc    The caller's open quizzes, assignments and recorded assessments,
//          scoped as the TM pages are (needs the MIS token: the misToken
//          cookie on the web, X-MIS-Token from TMCode).
// @route   GET /api/tmcode/activities/linkable
export const linkableActivities = async (req: Request, res: Response) => {
  const { scope, subjects } = await getScopedSubjects(req);
  const names = new Map(subjects.map((s) => [Number(s.id), s.name]));
  const courseWhere = scope === "all" ? {} : { course_id: { [Op.in]: [...names.keys()] } };
  if (scope !== "all" && names.size === 0) return res.status(200).json({ activities: [] });
  const now = new Date();
  const [assignments, quizzes, manual] = await Promise.all([
    Assignment.findAll({ where: { ...courseWhere, status: "published" }, order: [["due_date", "ASC"]], limit: 200 }),
    Quiz.findAll({
      where: { ...courseWhere, status: "published", [Op.or]: [{ end_date: null }, { end_date: { [Op.gt]: now } }] } as any,
      order: [["created_at", "DESC"]],
      limit: 200,
    }),
    ManualAssessment.findAll({ where: courseWhere, order: [["created_at", "DESC"]], limit: 100 }),
  ]);
  const practicals = await practicalQuestionsOf(quizzes.map((q) => q.id));
  const course = (id: number | null | undefined) => ({
    course_id: id ?? null,
    course_name: id != null ? names.get(Number(id)) ?? null : null,
  });
  return res.status(200).json({
    activities: [
      ...assignments.map((a) => ({
        type: "assignment" as const,
        id: a.id,
        title: a.title,
        ...course(a.course_id),
        due_date: a.due_date ? new Date(a.due_date).toISOString() : null,
        submission_type: a.submission_type,
      })),
      ...quizzes.map((q) => ({
        type: "quiz" as const,
        id: q.id,
        title: q.title,
        ...course(q.course_id),
        due_date: q.end_date ? new Date(q.end_date).toISOString() : null,
        // TMCode practical questions in this quiz (link with question_id).
        practical_questions: practicals.get(q.id) ?? [],
      })),
      ...manual.map((m) => ({
        type: "manual_assessment" as const,
        id: m.id,
        title: m.title,
        ...course(m.course_id),
        due_date: m.assessment_date ? new Date(m.assessment_date).toISOString() : null,
      })),
    ],
  });
};

const linkSchema = z.object({
  activity_type: z.enum(["quiz", "assignment", "manual_assessment"]),
  activity_id: z.number().int().positive(),
  /** Quizzes: the TMCode practical question (quiz_questions.id) the project answers. */
  question_id: z.number().int().positive().optional().nullable(),
});

// @desc    Link the project to an activity (owner; the activity must be open
//          and in the owner's courses; one project per activity per owner).
// @route   POST /api/tmcode/projects/:id/links
export const createLink = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  if (p.archived_at) return tmcodeError(res, 409, "PROJECT_ARCHIVED", "This project is archived.");
  const parsed = linkSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const { activity_type, activity_id } = parsed.data;
  const questionId = activity_type === "quiz" ? parsed.data.question_id ?? null : null;
  if (questionId && !(await loadQuizPractical(activity_id, questionId))) {
    return tmcodeError(res, 422, "NOT_A_PRACTICAL", "That question isn't a TMCode practical of this quiz.");
  }

  const activity = await loadActivity(activity_type, activity_id);
  if (!activity) return tmcodeError(res, 404, "ACTIVITY_NOT_FOUND", "Activity not found.");
  if (!(await userMayUseActivity(req, activity))) {
    return tmcodeError(res, 403, "ACTIVITY_NOT_IN_SCOPE", "This activity isn't in your courses.");
  }
  if (!activity.open) return tmcodeError(res, 409, "ACTIVITY_CLOSED", "This activity is closed.");

  const mine = await Project.findAll({ where: { owner_id: p.owner_id }, attributes: ["id"] });
  const existing = await ProjectActivityLink.findOne({
    where: {
      activity_type,
      activity_id,
      // one project per practical question (a quiz can have several)
      ...(questionId ? { question_id: questionId } : {}),
      project_id: { [Op.in]: mine.map((x) => x.id) },
    },
  });
  if (existing) {
    return tmcodeError(
      res,
      409,
      "ALREADY_LINKED",
      existing.project_id === p.id ? "Already linked." : "Another of your projects is linked to this activity.",
      { link: linkJson(existing, activity) },
    );
  }
  const link = await ProjectActivityLink.create({
    project_id: p.id,
    activity_type,
    activity_id,
    question_id: questionId,
    linked_by: req.user.id,
    status: "linked",
  } as any);
  forgetProjectCourses(p.id);
  publishEvent(await recordEvent(p.id, req.user.id, "linked", { link_id: link.id, activity_type, activity_id, title: activity.title }));
  return res.status(201).json({ link: linkJson(link, activity) });
};

async function linkOr404(req: Request, res: Response, access: ProjectAccess) {
  const link = await ProjectActivityLink.findByPk(Number(req.params.linkId));
  if (!link || link.project_id !== access.project.id) {
    tmcodeError(res, 404, "LINK_NOT_FOUND", "Link not found.");
    return null;
  }
  return link;
}

const submitSchema = z.object({ git_commit: z.string().regex(/^[0-9a-f]{7,64}$/i).optional() });

// @desc    Submit: freeze the head revision (tm) or the git commit (github)
//          on the link. For an assignment also create/update the owner's
//          `submissions` row (status submitted/resubmitted, is_late,
//          project_ref = the frozen revision/commit). Re-submitting moves the
//          freeze while the activity is open and the work isn't graded.
// @route   POST /api/tmcode/projects/:id/links/:linkId/submit
export const submitLink = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const link = await linkOr404(req, res, access);
  if (!link) return;
  const parsed = submitSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const p = access.project;

  if (p.status === "removed") {
    return tmcodeError(res, 409, "PROJECT_REMOVED", "This project was removed. Restore it to submit it.");
  }
  const activity = await loadActivity(link.activity_type, link.activity_id);
  if (!activity) return tmcodeError(res, 404, "ACTIVITY_NOT_FOUND", "The activity no longer exists.");
  if (activity.type === "assignment" && isReadOnlyStatus(activity.status)) {
    return tmcodeError(res, 409, "ASSIGNMENT_COMPLETED", "This assignment is completed; it no longer accepts submissions.");
  }
  if (!activity.open) return tmcodeError(res, 409, "ACTIVITY_CLOSED", "This activity is closed.");

  let revision: ProjectRevision | null = null;
  let commit: string | null = null;
  if (p.kind === "tm") {
    revision = p.head_revision_id ? await ProjectRevision.findByPk(p.head_revision_id) : null;
    if (!revision) return tmcodeError(res, 422, "NOTHING_TO_SUBMIT", "Save the project to Task Mentor first.");
  } else {
    commit = parsed.data.git_commit ?? p.git_state?.head_commit ?? null;
    if (!commit) return tmcodeError(res, 422, "NO_COMMIT", "Commit and push your work first.");
  }

  const now = new Date();
  let submission: { id: number; status: string; is_late: boolean } | null = null;
  const refused = await sequelize.transaction(async (transaction) => {
    if (link.activity_type === "assignment") {
      const studentId = p.owner_id;
      const [row] = await sequelize.query<{ id: number; status: string; project_ref: unknown }>(
        "SELECT id, status, project_ref FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1 FOR UPDATE",
        { replacements: [activity.id, studentId], type: QueryTypes.SELECT, transaction },
      );
      if (row?.status === "graded") return "ALREADY_GRADED";
      const isLate = !!activity.due_date && now.getTime() > new Date(activity.due_date).getTime();
      // Handing in again — including after a withdraw or a teacher's return,
      // which leave a draft row that already carries a project — is a resubmission.
      const handedInBefore =
        !!row && (["submitted", "late", "resubmitted"].includes(row.status) || (row.status === "draft" && !!row.project_ref));
      const status = handedInBefore ? "resubmitted" : "submitted";
      const text = revision
        ? `TMCode project "${p.name}", revision #${revision.number}`
        : `TMCode project "${p.name}", commit ${commit!.slice(0, 12)}${p.repo_url ? ` (${p.repo_url})` : ""}`;
      const ref = JSON.stringify({
        project_id: p.id,
        link_id: link.id,
        kind: p.kind,
        revision_id: revision?.id ?? null,
        revision_number: revision?.number ?? null,
        git_commit: commit,
        repo_url: p.repo_url ?? null,
        submitted_at: now.toISOString(),
      });
      if (row) {
        await sequelize.query(
          `UPDATE submissions SET status = ?, submitted_at = ?, submitted_by = ?, text_submission = ?,
             is_late = ?, project_ref = ?, updated_at = ? WHERE id = ?`,
          { replacements: [status, now, req.user.id, text, isLate, ref, now, row.id], transaction },
        );
        submission = { id: row.id, status, is_late: isLate };
      } else {
        const [insertId] = await sequelize.query(
          `INSERT INTO submissions (assignment_id, student_id, submitted_by, status, submitted_at, text_submission,
             file_submissions, resubmissions, is_late, comments, project_ref, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', ?, '[]', ?, ?, ?)`,
          {
            replacements: [activity.id, studentId, req.user.id, status, now, text, isLate, ref, now, now],
            type: QueryTypes.INSERT,
            transaction,
          },
        );
        submission = { id: Number(insertId), status, is_late: isLate };
      }
    }
    if (link.activity_type === "quiz" && link.question_id) {
      // A quiz practical: the frozen project is the student's answer to that
      // question in the quiz they have open (it waits for the teacher).
      const [open] = await sequelize.query<{ id: number }>(
        "SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1",
        { replacements: [link.activity_id, p.owner_id], type: QueryTypes.SELECT, transaction },
      );
      if (open) {
        const answer = {
          project_id: p.id,
          link_id: link.id,
          revision_id: revision?.id ?? null,
          revision_number: revision?.number ?? null,
        };
        const details = { grade_status: "pending", pending_reason: "Awaiting the teacher's grading", practical: answer };
        const [attempt] = await sequelize.query<{ id: number; details: unknown }>(
          "SELECT id, grading_details AS details FROM quiz_attempts WHERE submission_id = ? AND question_id = ? LIMIT 1 FOR UPDATE",
          { replacements: [open.id, link.question_id], type: QueryTypes.SELECT, transaction },
        );
        const prev = typeof attempt?.details === "string" ? JSON.parse(attempt.details) : (attempt?.details as any);
        if (prev?.manual) return "ALREADY_GRADED";
        if (attempt) {
          await sequelize.query(
            "UPDATE quiz_attempts SET submitted_answer = ?, grading_details = ?, is_correct = 0, points_earned = 0, updated_at = ? WHERE id = ?",
            { replacements: [JSON.stringify(answer), JSON.stringify(details), now, attempt.id], transaction },
          );
        } else {
          await sequelize.query(
            `INSERT INTO quiz_attempts (quiz_id, question_id, student_id, submission_id, submitted_answer, grading_details,
               is_correct, points_earned, status, started_at, completed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'in_progress', ?, NULL, ?, ?)`,
            {
              replacements: [link.activity_id, link.question_id, p.owner_id, open.id, JSON.stringify(answer), JSON.stringify(details), now, now, now],
              transaction,
            },
          );
        }
      }
    }
    await link.update(
      { status: "submitted", submitted_at: now, revision_id: revision?.id ?? null, git_commit: commit },
      { transaction },
    );
    return null;
  });
  if (refused === "ALREADY_GRADED") {
    return tmcodeError(
      res,
      409,
      "ALREADY_GRADED",
      link.activity_type === "quiz"
        ? "This practical was already graded; it can't be resubmitted."
        : "This assignment was already graded; it can't be resubmitted.",
    );
  }
  publishEvent(
    await recordEvent(p.id, req.user.id, "submitted", {
      link_id: link.id,
      activity_type: link.activity_type,
      activity_id: link.activity_id,
      title: activity.title,
      revision_id: revision?.id ?? null,
      revision_number: revision?.number ?? null,
      git_commit: commit,
    }),
  );
  const projectStatus = await syncProjectStatus(p.id, Number(req.user.id));
  return res
    .status(200)
    .json({ link: linkJson(link, activity, revision?.number ?? null), submission, project_status: projectStatus });
};

// @desc    Unlink (owner), only while not submitted.
// @route   DELETE /api/tmcode/projects/:id/links/:linkId
export const deleteLink = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const link = await linkOr404(req, res, access);
  if (!link) return;
  if (link.status === "submitted") {
    return tmcodeError(res, 409, "LINK_SUBMITTED", "A submitted link can't be removed.");
  }
  await link.destroy();
  forgetProjectCourses(access.project.id);
  publishEvent(
    await recordEvent(access.project.id, req.user.id, "unlinked", {
      link_id: link.id,
      activity_type: link.activity_type,
      activity_id: link.activity_id,
    }),
  );
  return res.status(200).json({ ok: true });
};

// @desc    Teacher view: the projects linked to an activity, with their
//          frozen revisions (read them with /projects/:id/revisions/:rev/manifest
//          and /projects/:id/files/*?rev=).
// @route   GET /api/tmcode/activities/:type/:id/projects
export const activityProjects = async (req: Request, res: Response) => {
  const type = req.params.type as ActivityType;
  if (!ACTIVITY_TYPES.includes(type)) {
    return tmcodeError(res, 400, "VALIDATION_ERROR", "type must be quiz, assignment or manual_assessment.");
  }
  const activity = await loadActivity(type, Number(req.params.id));
  if (!activity) return tmcodeError(res, 404, "ACTIVITY_NOT_FOUND", "Activity not found.");
  if (!(await teacherCanSeeActivity(req, activity))) {
    return tmcodeError(res, 403, "FORBIDDEN", "This activity isn't in your courses.");
  }
  const links = await ProjectActivityLink.findAll({
    where: { activity_type: type, activity_id: activity.id },
    order: [["id", "ASC"]],
  });
  const projects = links.length
    ? await Project.findAll({ where: { id: { [Op.in]: links.map((l) => l.project_id) } } })
    : [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  const frozenIds = links.map((l) => l.revision_id).filter((x): x is number => !!x);
  const frozen = frozenIds.length
    ? await ProjectRevision.findAll({ where: { id: frozenIds }, attributes: { exclude: ["manifest_gz"] } })
    : [];
  const revById = new Map(frozen.map((r) => [r.id, r]));
  const presence = projects.length
    ? await ProjectPresence.findAll({ where: { project_id: { [Op.in]: projects.map((p) => p.id) } } })
    : [];
  const users = await usersById([...projects.map((p) => p.owner_id), ...frozen.map((r) => r.author_id)]);
  const now = Date.now();

  return res.status(200).json({
    activity: {
      type: activity.type,
      id: activity.id,
      title: activity.title,
      course_id: activity.course_id,
      open: activity.open,
      due_date: activity.due_date ? new Date(activity.due_date).toISOString() : null,
    },
    projects: links
      .filter((l) => byId.has(l.project_id))
      .map((l) => {
        const p = byId.get(l.project_id)!;
        const rev = l.revision_id ? revById.get(l.revision_id) : null;
        return {
          link: linkJson(l, activity, rev?.number ?? null),
          project: {
            id: p.id,
            name: p.name,
            status: p.status,
            kind: p.kind,
            language: p.language ?? null,
            visibility: p.visibility,
            repo_url: p.repo_url ?? null,
            git: p.git_state ?? null,
            share_presence: p.share_presence !== false,
            assignment_id: p.assignment_id ?? null,
          },
          owner: userBrief(users.get(p.owner_id), p.owner_id),
          frozen_revision: rev ? revisionJson(rev, users) : null,
          presence:
            p.share_presence === false
              ? { ...HIDDEN_PRESENCE }
              : presenceSummary(
                  presence.filter((r) => r.project_id === p.id),
                  now,
                ),
        };
      }),
  });
};


// ─── Status lifecycle (draft -> submitted -> graded, removed) ────────────────

/** The link a project-level Submit / Withdraw acts on: its assignment. */
async function assignmentLinkOf(p: Project): Promise<ProjectActivityLink | null> {
  const links = await ProjectActivityLink.findAll({ where: { project_id: p.id, activity_type: "assignment" } });
  if (p.assignment_id) return links.find((l) => l.activity_id === p.assignment_id) ?? null;
  return links.length === 1 ? links[0] : null;
}

// @desc    Submit the project (owner): submits its assignment link, which
//          freezes the latest saved version and hands it in. The project is
//          then locked until withdrawn or returned.
// @route   POST /api/tmcode/projects/:id/submit
export const submitProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const link = await assignmentLinkOf(access.project);
  if (!link) {
    return tmcodeError(
      res,
      422,
      "NO_ASSIGNMENT",
      "Link this project to an assignment first; submitting hands it in for that assignment.",
    );
  }
  req.params.linkId = String(link.id);
  return submitLink(req, res);
};

// @desc    Withdraw a submission (owner): back to draft so the student can keep
//          working, then submit again. Only while the assignment is open and the
//          work isn't graded.
// @route   POST /api/tmcode/projects/:id/withdraw
export const withdrawProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  const link = await assignmentLinkOf(p);
  if (link) {
    const activity = await loadActivity("assignment", link.activity_id);
    if (activity && isReadOnlyStatus(activity.status)) {
      return tmcodeError(res, 409, "ASSIGNMENT_COMPLETED", "This assignment is completed; it can't be changed any more.");
    }
    if (activity && !activity.open) return tmcodeError(res, 409, "ACTIVITY_CLOSED", "This assignment is closed.");
  }
  const result = await reopenProject(p, Number(req.user.id));
  if (!result.ok) return tmcodeError(res, 409, result.code, result.message);
  publishEvent(await recordEvent(p.id, req.user.id, "withdrawn", { link_ids: result.links.map((l) => l.id) }));
  await p.reload();
  // `project` has the GET /projects/:id shape (TMCode reads it); `status` for the web.
  return res.status(200).json({ status: p.status, project: await projectDetails(req, p, access.role, access) });
};

const returnSchema = z.object({ message: z.string().trim().max(2000).optional().nullable() });

// @desc    Return a submitted project to the student for changes (teacher of
//          its assignment): back to draft, the submission leaves the to-grade
//          list, and the message is recorded on the project's activity.
// @route   POST /api/tmcode/projects/:id/return
export const returnProject = async (req: Request, res: Response) => {
  const p = await Project.findByPk(Number(req.params.id));
  if (!p) return tmcodeError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
  const parsed = returnSchema.safeParse(req.body ?? {});
  if (!parsed.success) return validation(res, parsed.error);
  const link = await assignmentLinkOf(p);
  const activity = link ? await loadActivity("assignment", link.activity_id) : null;
  if (!activity || !(await teacherCanSeeActivity(req, activity))) {
    // Same answer for "not there" and "not yours".
    return tmcodeError(res, 404, "PROJECT_NOT_FOUND", "Project not found.");
  }
  const result = await reopenProject(p, Number(req.user.id));
  if (!result.ok) return tmcodeError(res, 409, result.code, result.message);
  publishEvent(
    await recordEvent(p.id, req.user.id, "returned", {
      assignment_id: activity.id,
      title: activity.title,
      message: parsed.data.message ?? null,
    }),
  );
  await p.reload();
  const access = await resolveProjectAccess(req, p.id);
  return res.status(200).json({
    status: p.status,
    project: access ? await projectDetails(req, p, access.role, access) : null,
  });
};

// @desc    Restore a removed project (owner): back to draft (or to whatever its
//          links and grades say, if it had been handed in).
// @route   POST /api/tmcode/projects/:id/restore
export const restoreProject = async (req: Request, res: Response) => {
  const access = await accessOr404(req, res);
  if (!access) return;
  if (!access.isOwner) return ownerOnly(res);
  const p = access.project;
  if (p.status !== "removed") return res.status(200).json({ status: p.status });
  await p.update({ status: "draft", status_changed_at: new Date(), status_changed_by: Number(req.user.id) });
  const status = await syncProjectStatus(p.id, Number(req.user.id));
  publishEvent(await recordEvent(p.id, req.user.id, "restored", {}));
  await p.reload();
  return res.status(200).json({ status, project: await projectDetails(req, p, access.role, access) });
};
