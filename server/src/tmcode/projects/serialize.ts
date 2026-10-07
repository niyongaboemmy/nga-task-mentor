import { Op } from "sequelize";
import {
  Project,
  ProjectActivityLink,
  ProjectEvent,
  ProjectMember,
  ProjectPresence,
  ProjectRevision,
  User,
} from "../../models";
import { ActivityInfo } from "./access";
import { presenceStaleMs } from "./limits";

/**
 * JSON shapes of the Projects API (the contract TMCode and the TM web client
 * code against -- server/src/tmcode/PROJECTS_API.md). Dates are ISO strings,
 * sizes are numbers of bytes, users are LOCAL ids.
 */

export interface UserBrief {
  id: number;
  name: string;
  avatar_url: string | null;
}

export const userName = (u: Pick<User, "first_name" | "last_name" | "email"> | null | undefined) =>
  u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email : null;

export const userBrief = (u: User | null | undefined, id?: number): UserBrief | null =>
  u ? { id: u.id, name: userName(u) as string, avatar_url: u.profile_image ?? null } : id ? { id, name: `User #${id}`, avatar_url: null } : null;

export async function usersById(ids: Array<number | null | undefined>): Promise<Map<number, User>> {
  const unique = [...new Set(ids.filter((n): n is number => !!n))];
  if (unique.length === 0) return new Map();
  const rows = await User.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ["id", "first_name", "last_name", "email", "profile_image"],
  });
  return new Map(rows.map((u) => [u.id, u]));
}

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export function revisionJson(rev: ProjectRevision, users?: Map<number, User>) {
  return {
    id: rev.id,
    project_id: rev.project_id,
    number: rev.number,
    parent_id: rev.parent_id ?? null,
    author_id: rev.author_id,
    author_name: users ? userName(users.get(rev.author_id)) : undefined,
    message: rev.message ?? null,
    file_count: rev.file_count,
    size_bytes: Number(rev.size_bytes),
    source: rev.source,
    git_commit: rev.git_commit ?? null,
    created_at: iso(rev.created_at),
  };
}
export type RevisionJson = ReturnType<typeof revisionJson>;

export const isOnline = (row: Pick<ProjectPresence, "state" | "last_seen_at">, now = Date.now()) =>
  row.state?.open !== false && now - new Date(row.last_seen_at).getTime() < presenceStaleMs();

export function presenceJson(row: ProjectPresence, users?: Map<number, User>, now = Date.now()) {
  return {
    project_id: row.project_id,
    user_id: row.user_id,
    user_name: users ? userName(users.get(row.user_id)) : undefined,
    device_id: row.device_id,
    app_version: row.app_version ?? null,
    state: row.state ?? {},
    last_seen_at: iso(row.last_seen_at),
    online: isOnline(row, now),
  };
}
export type PresenceJson = ReturnType<typeof presenceJson>;

export function linkJson(link: ProjectActivityLink, activity?: ActivityInfo | null, revisionNumber?: number | null) {
  return {
    id: link.id,
    project_id: link.project_id,
    activity_type: link.activity_type,
    activity_id: link.activity_id,
    question_id: link.question_id ?? null,
    activity: activity
      ? {
          title: activity.title,
          course_id: activity.course_id,
          open: activity.open,
          due_date: iso(activity.due_date),
        }
      : null,
    status: link.status,
    revision_id: link.revision_id ?? null,
    revision_number: revisionNumber ?? null,
    git_commit: link.git_commit ?? null,
    submitted_at: iso(link.submitted_at),
    linked_by: link.linked_by,
    created_at: iso(link.created_at),
  };
}

export function eventJson(e: ProjectEvent, users?: Map<number, User>) {
  return {
    id: Number(e.id),
    project_id: e.project_id,
    user_id: e.user_id ?? null,
    user_name: users && e.user_id ? userName(users.get(e.user_id)) : undefined,
    type: e.type,
    data: e.data ?? {},
    created_at: iso(e.created_at),
  };
}

export function memberJson(m: ProjectMember, users: Map<number, User>) {
  const u = users.get(m.user_id);
  return {
    user_id: m.user_id,
    name: userName(u) ?? `User #${m.user_id}`,
    avatar_url: u?.profile_image ?? null,
    role: m.role,
    github_username: m.github_username ?? null,
    status: m.status,
    invited_by: m.invited_by ?? null,
    created_at: iso(m.created_at),
  };
}

/** The fields every project view shares (list rows and details). */
export function projectCore(p: Project, owner: UserBrief | null, myRole: string) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description ?? null,
    language: p.language ?? null,
    kind: p.kind,
    visibility: p.visibility,
    repo_url: p.repo_url ?? null,
    repo_full_name: p.repo_full_name ?? null,
    default_branch: p.default_branch ?? null,
    head_revision_id: p.head_revision_id ?? null,
    size_bytes: Number(p.size_bytes),
    file_count: p.file_count,
    git: p.git_state ?? null,
    archived_at: iso(p.archived_at),
    status: p.status ?? "draft",
    status_changed_at: iso(p.status_changed_at),
    share_presence: p.share_presence !== false,
    last_activity_at: iso(p.last_activity_at),
    created_at: iso(p.created_at),
    updated_at: iso(p.updated_at),
    owner,
    my_role: myRole,
  };
}

/** What a teacher sees of a project whose owner doesn't share live status. */
export const HIDDEN_PRESENCE = {
  online: false,
  devices_online: 0,
  last_seen_at: null as string | null,
  file: null as string | null,
  dirty: 0,
};

/** Presence of one project boiled down for a list row. */
export function presenceSummary(rows: ProjectPresence[], now = Date.now()) {
  const online = rows.filter((r) => isOnline(r, now));
  const latest = [...(online.length ? online : rows)].sort(
    (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
  )[0];
  const dirty = latest?.state?.dirty;
  return {
    online: online.length > 0,
    devices_online: online.length,
    last_seen_at: iso(latest?.last_seen_at),
    file: online.length ? (latest?.state?.file ?? null) : null,
    dirty: online.length ? (Array.isArray(dirty) ? dirty.length : Number(dirty) || 0) : 0,
  };
}
