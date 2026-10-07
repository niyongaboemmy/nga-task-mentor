import api, { API_BASE_URL } from "../utils/axiosConfig";

/**
 * TMCode Projects — the Task Mentor web client's side of PROJECTS_PLAN.md §3
 * (everything under /api/tmcode), aligned with the server's
 * server/src/tmcode/PROJECTS_API.md. Students and teachers keep personal coding
 * projects in Task Mentor and work on them in TMCode; these pages list them,
 * show live presence (SSE), browse revisions, link them to activities and
 * submit.
 *
 * Every reader goes through a normaliser, so the pages accept both the
 * `{ success, data }` envelope the rest of the API uses and a bare payload,
 * and tolerate optional fields the server may not send yet.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectKind = "github" | "tm";
export type ProjectVisibility = "private" | "course";
export type ProjectScope = "mine" | "shared" | "all";
export type MemberRole = "owner" | "collaborator" | "viewer";
/** The caller's relation to a project; admin/teacher are read-only. */
export type ProjectRole = MemberRole | "admin" | "teacher";
export type MemberStatus = "invited" | "active" | "removed";
export type ActivityType = "quiz" | "assignment" | "manual_assessment";
export type LinkStatus = "linked" | "submitted";
export type RevisionSource = "save" | "auto" | "submit";
/** TMCode's folder sync state (plan §4.4). Unknown strings pass through. */
export type SyncState = "synced" | "local_changes" | "remote_newer" | "conflict" | "saving" | (string & {});

export interface UserLite {
  id: number;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
}

export interface CourseLite {
  id: number;
  /** The server often sends only course_id; pages resolve names from the course list. */
  title: string | null;
  code?: string | null;
}

export interface LastRun {
  at?: string | null;
  status?: "ok" | "error" | "running" | (string & {}) | null;
  command?: string | null;
  exit_code?: number | null;
}

export interface LastCommit {
  sha?: string | null;
  message?: string | null;
  at?: string | null;
}

/** `project_presence.state` — what TMCode reports every 20 s. */
export interface PresenceState {
  open: boolean;
  /** Optional, e.g. "MacBook" (shown in the live line). */
  device_name?: string | null;
  file?: string | null;
  /** Unsaved editor buffers: a count, or the list of paths. */
  dirty?: number | string[] | null;
  branch?: string | null;
  ahead?: number | null;
  behind?: number | null;
  /** Uncommitted (git) or unsaved-to-TM (tm) file changes. */
  changes?: number | null;
  last_commit?: LastCommit | string | null;
  last_run?: LastRun | null;
  sync?: SyncState | null;
}

/** One row per project in GET /projects. */
export interface PresenceSummary {
  online: boolean;
  devices_online: number;
  last_seen_at: string | null;
  file: string | null;
  dirty: number;
}

export interface ProjectPresence {
  /** Server-judged: open and a heartbeat within 60 s. */
  online?: boolean;
  project_id: number;
  user_id: number;
  user?: UserLite | null;
  device_id: string;
  device_name?: string | null;
  app_version?: string | null;
  state: PresenceState;
  last_seen_at: string;
}

export interface RevisionSummary {
  id: number;
  number: number;
  message?: string | null;
  author?: UserLite | null;
  file_count: number;
  size_bytes: number;
  source: RevisionSource;
  git_commit?: string | null;
  created_at: string;
}

export interface ManifestFile {
  path: string;
  sha256: string;
  size: number;
}

export interface RevisionManifest {
  revision: RevisionSummary | null;
  files: ManifestFile[];
}

export interface ProjectLink {
  id: number;
  project_id: number;
  activity_type: ActivityType;
  activity_id: number;
  /** Quiz links: the TMCode practical question (quiz_questions.id). */
  question_id?: number | null;
  activity_title?: string | null;
  course?: CourseLite | null;
  due_date?: string | null;
  /** The activity still accepts links/submissions. */
  activity_open?: boolean | null;
  status: LinkStatus;
  revision_id?: number | null;
  revision_number?: number | null;
  git_commit?: string | null;
  submitted_at?: string | null;
  linked_by?: number | null;
  created_at?: string | null;
}

export interface LinkSummary {
  total: number;
  submitted: number;
  items: Pick<ProjectLink, "id" | "activity_type" | "activity_id" | "question_id" | "status" | "submitted_at" | "activity_title">[];
}

export interface GitPush {
  commit: string;
  message?: string | null;
  at: string;
  user?: UserLite | null;
}

export interface GitState {
  branch?: string | null;
  head_commit?: string | null;
  ahead?: number | null;
  behind?: number | null;
  changes?: number | null;
  remote_url?: string | null;
  /** `reported_at` on the server. */
  updated_at?: string | null;
  last_push?: GitPush | null;
  pushes?: GitPush[];
}

export interface ProjectMember {
  user_id: number;
  user: UserLite;
  role: MemberRole;
  github_username?: string | null;
  status: MemberStatus;
  created_at?: string | null;
}

export interface ProjectEvent {
  id: number;
  project_id?: number;
  type: string;
  user?: UserLite | null;
  data?: Record<string, unknown> | null;
  created_at: string;
}

/** The TMCode assignment a workspace project belongs to (ASSIGNMENTS_PLAN.md). */
export interface ProjectAssignment {
  id: number;
  title: string;
  status: "draft" | "published" | "completed" | "removed";
  kind: "practical" | "case_study" | null;
}

/** draft -> submitted -> graded, or removed (server: tmcode/projects/status.ts). */
export type ProjectStatus = "draft" | "submitted" | "graded" | "removed";
export const PROJECT_STATUSES: ProjectStatus[] = ["draft", "submitted", "graded", "removed"];

export interface ProjectSummary {
  id: number;
  status: ProjectStatus;
  status_changed_at?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  language?: string | null;
  kind: ProjectKind;
  visibility: ProjectVisibility;
  repo_url?: string | null;
  repo_full_name?: string | null;
  default_branch?: string | null;
  owner: UserLite;
  /** The caller's role on this project ("admin"/"teacher" = read-only access). */
  my_role: ProjectRole | null;
  size_bytes: number;
  file_count: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  head: RevisionSummary | null;
  head_revision_id?: number | null;
  /** Device rows (project page, SSE); empty in list rows. */
  presence: ProjectPresence[];
  presence_summary: PresenceSummary;
  links: LinkSummary;
  git?: GitState | null;
  /** Set on a student's workspace for a TMCode assignment. */
  assignment: ProjectAssignment | null;
  /** The assignment is completed: viewable, no more saving or submitting. */
  read_only: boolean;
  /** Live status goes to teachers' monitors ("Share live status"). */
  share_presence: boolean;
}

export interface ProjectCapabilities {
  edit: boolean;
  save: boolean;
  report_git: boolean;
  read_all_revisions: boolean;
  /** The owner may turn Share live status off (not while the assignment is open). */
  share_presence: boolean;
}

export interface ProjectDetail extends Omit<ProjectSummary, "links"> {
  links: ProjectLink[];
  members: ProjectMember[];
  events: ProjectEvent[];
  can: ProjectCapabilities;
}

export interface ProjectStats {
  total: number;
  active_this_week: number;
  revisions: number;
  submissions: number;
  live_now: number;
  /** Counts per status (the list's status filter doesn't change them). */
  by_status: Record<ProjectStatus, number>;
}

export interface ProjectList {
  projects: ProjectSummary[];
  stats: ProjectStats;
}

export interface LinkableActivity {
  activity_type: ActivityType;
  activity_id: number;
  title: string;
  course?: CourseLite | null;
  due_date?: string | null;
  submission_type?: string | null;
  /** Quiz: its TMCode practical questions (question_id = quiz_questions.id). */
  practical_questions?: { question_id: number; title: string; points: number }[];
}

/** One row of the teacher view of an activity (GET /activities/:type/:id/projects). */
export interface ActivityProject {
  link: ProjectLink;
  project: Pick<ProjectSummary, "id" | "name" | "kind" | "language" | "repo_url" | "repo_full_name"> & {
    status?: ProjectStatus;
  };
  owner: UserLite;
  revision: RevisionSummary | null;
}

/** A row of the teacher monitor: one student's project open on one device. */
export interface MonitorEntry extends ProjectPresence {
  project: Pick<ProjectSummary, "id" | "name" | "kind" | "language"> & { owner?: UserLite | null };
  /** Only ids from the server (`course_ids`); titles are resolved by the page. */
  courses: CourseLite[];
  /** The owner stopped sharing live status: drop the row. */
  withdrawn?: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  language?: string;
  kind: ProjectKind;
  repo_url?: string;
  visibility?: ProjectVisibility;
  default_branch?: string;
  github_username?: string;
  /** Create it as the caller's work for this assignment (linked, in draft). */
  assignment_id?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  /** true archives, false restores. */
  archived?: boolean;
  share_presence?: boolean;
}

export interface AddMemberInput {
  user_id?: number;
  email?: string;
  github_username?: string;
  role: Exclude<MemberRole, "owner">;
}

// ─── Normalisers ──────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** `{ success, data }` → data; anything else unchanged. */
export function unwrap<T = unknown>(body: unknown): T {
  if (isObj(body) && "data" in body && ("success" in body || Object.keys(body).length === 1)) {
    return body.data as T;
  }
  return body as T;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function normalizeUser(raw: unknown): UserLite {
  const u = isObj(raw) ? raw : {};
  const first = str(u.first_name);
  const last = str(u.last_name);
  const name = str(u.name) ?? ([first, last].filter(Boolean).join(" ") || str(u.email) || "Unknown user");
  return {
    id: num(u.id ?? u.user_id),
    name,
    email: str(u.email),
    avatar_url: str(u.avatar_url) ?? str(u.profile_picture),
  };
}

const userOrNull = (raw: unknown): UserLite | null => (isObj(raw) ? normalizeUser(raw) : null);

export function normalizeCourse(raw: unknown): CourseLite | null {
  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw))) return { id: Number(raw), title: null, code: null };
  if (!isObj(raw)) return null;
  return {
    id: num(raw.id ?? raw.course_id),
    title: str(raw.title) ?? str(raw.name) ?? str(raw.course_name),
    code: str(raw.code),
  };
}

/** "CS5 — Computer Science", or "Course #11" when only the id is known. */
export const courseLabel = (c: CourseLite, names?: Map<number, string>): string =>
  names?.get(c.id) ?? (c.title ? (c.code ? `${c.code} — ${c.title}` : c.title) : `Course #${c.id}`);

/** `open` defaults to true, as on the server. */
export function normalizePresenceState(raw: unknown): PresenceState {
  const s = isObj(raw) ? raw : {};
  return { ...(s as Partial<PresenceState>), open: !(s.open === false || s.open === 0 || s.open === "false") };
}

export function normalizePresence(raw: unknown): ProjectPresence {
  const p = isObj(raw) ? raw : {};
  const userId = num(p.user_id ?? (isObj(p.user) ? p.user.id : undefined));
  const state = normalizePresenceState(typeof p.state === "string" ? safeJson(p.state) : p.state);
  return {
    ...(typeof p.online === "boolean" ? { online: p.online } : {}),
    project_id: num(p.project_id),
    user_id: userId,
    user: userOrNull(p.user) ?? (str(p.user_name) ? { id: userId, name: str(p.user_name)! } : null),
    device_id: String(p.device_id ?? "device"),
    app_version: str(p.app_version),
    state,
    // Not a server column: TMCode may report it inside `state`.
    device_name: str(p.device_name) ?? str(p.device_label) ?? str(state.device_name),
    last_seen_at: str(p.last_seen_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeRevision(raw: unknown): RevisionSummary | null {
  if (!isObj(raw)) return null;
  return {
    id: num(raw.id),
    number: num(raw.number),
    message: str(raw.message),
    author:
      userOrNull(raw.author) ??
      (str(raw.author_name) ? { id: num(raw.author_id), name: str(raw.author_name)! } : null),
    file_count: num(raw.file_count),
    size_bytes: num(raw.size_bytes),
    source: (str(raw.source) as RevisionSource) ?? "save",
    git_commit: str(raw.git_commit),
    created_at: str(raw.created_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeLink(raw: unknown): ProjectLink {
  const l = isObj(raw) ? raw : {};
  const activity = isObj(l.activity) ? l.activity : {};
  return {
    id: num(l.id),
    project_id: num(l.project_id),
    activity_type: (str(l.activity_type) as ActivityType) ?? "assignment",
    activity_id: num(l.activity_id),
    question_id: l.question_id == null ? null : num(l.question_id),
    activity_title: str(l.activity_title) ?? str(activity.title),
    course: normalizeCourse(l.course ?? activity.course ?? activity.course_id ?? l.course_id),
    due_date: str(l.due_date) ?? str(activity.due_date),
    activity_open: typeof activity.open === "boolean" ? activity.open : null,
    status: l.status === "submitted" ? "submitted" : "linked",
    revision_id: l.revision_id == null ? null : num(l.revision_id),
    revision_number:
      l.revision_number != null
        ? num(l.revision_number)
        : isObj(l.revision)
          ? num(l.revision.number)
          : null,
    git_commit: str(l.git_commit),
    submitted_at: str(l.submitted_at),
    linked_by: l.linked_by == null ? null : num(l.linked_by),
    created_at: str(l.created_at),
  };
}

function normalizeLinkSummary(raw: unknown): LinkSummary {
  if (Array.isArray(raw)) {
    const items = raw.map(normalizeLink);
    return { total: items.length, submitted: items.filter((l) => l.status === "submitted").length, items };
  }
  const s = isObj(raw) ? raw : {};
  const items = Array.isArray(s.items) ? s.items.map(normalizeLink) : [];
  return {
    total: num(s.total ?? s.count, items.length),
    submitted: num(s.submitted, items.filter((l) => l.status === "submitted").length),
    items,
  };
}

function normalizePush(raw: unknown): GitPush | null {
  if (!isObj(raw)) return null;
  return {
    commit: String(raw.commit ?? ""),
    message: str(raw.message),
    at: str(raw.at) ?? str(raw.created_at) ?? new Date(0).toISOString(),
    user: userOrNull(raw.user),
  };
}

function normalizeGit(raw: unknown): GitState | null {
  if (!isObj(raw)) return null;
  return {
    branch: str(raw.branch),
    head_commit: str(raw.head_commit),
    ahead: raw.ahead == null ? null : num(raw.ahead),
    behind: raw.behind == null ? null : num(raw.behind),
    changes: raw.changes == null ? null : num(raw.changes),
    remote_url: str(raw.remote_url),
    updated_at: str(raw.reported_at) ?? str(raw.updated_at),
    last_push: normalizePush(raw.last_push),
    pushes: Array.isArray(raw.pushes) ? raw.pushes.map(normalizePush).filter((x): x is GitPush => !!x) : [],
  };
}

export function normalizeEvent(raw: unknown): ProjectEvent {
  const e = isObj(raw) ? raw : {};
  return {
    id: num(e.id),
    project_id: e.project_id == null ? undefined : num(e.project_id),
    type: str(e.type) ?? "event",
    user: userOrNull(e.user) ?? (str(e.user_name) ? { id: num(e.user_id), name: str(e.user_name)! } : null),
    data: isObj(e.data) ? e.data : typeof e.data === "string" ? (safeJson(e.data) as Json | null) : null,
    created_at: str(e.created_at) ?? new Date(0).toISOString(),
  };
}

function normalizeMember(raw: unknown): ProjectMember {
  const m = isObj(raw) ? raw : {};
  const user = normalizeUser(m.user ?? { id: m.user_id, email: m.email, name: m.name, avatar_url: m.avatar_url });
  return {
    user_id: num(m.user_id, user.id),
    user,
    role: (str(m.role) as MemberRole) ?? "viewer",
    github_username: str(m.github_username),
    status: (str(m.status) as MemberStatus) ?? "active",
    created_at: str(m.created_at),
  };
}

export function normalizeProject(raw: unknown): ProjectSummary {
  const p = isObj(raw) ? raw : {};
  // List rows carry a summary object in `presence`; details carry device rows
  // in `presence` and the summary in `presence_summary`.
  const presence = Array.isArray(p.presence) ? p.presence.map(normalizePresence) : [];
  const summary = normalizeSummary(p.presence_summary) ?? normalizeSummary(p.presence) ?? summarizePresence(presence);
  return {
    id: num(p.id),
    status: (PROJECT_STATUSES as string[]).includes(String(p.status)) ? (p.status as ProjectStatus) : "draft",
    status_changed_at: str(p.status_changed_at),
    name: str(p.name) ?? "Untitled project",
    slug: str(p.slug) ?? String(p.id ?? ""),
    description: str(p.description),
    language: str(p.language),
    kind: p.kind === "github" ? "github" : "tm",
    visibility: p.visibility === "course" ? "course" : "private",
    repo_url: str(p.repo_url),
    repo_full_name: str(p.repo_full_name),
    default_branch: str(p.default_branch),
    owner: normalizeUser(p.owner ?? { id: p.owner_id }),
    my_role: (str(p.my_role) as MemberRole) ?? null,
    size_bytes: num(p.size_bytes),
    file_count: num(p.file_count),
    archived_at: str(p.archived_at),
    created_at: str(p.created_at) ?? new Date(0).toISOString(),
    updated_at: str(p.updated_at) ?? str(p.created_at) ?? new Date(0).toISOString(),
    last_activity_at: str(p.last_activity_at) ?? str(p.updated_at),
    head: normalizeRevision(p.head),
    head_revision_id: p.head_revision_id == null ? null : num(p.head_revision_id),
    presence,
    presence_summary: summary,
    links: normalizeLinkSummary(p.links),
    git: normalizeGit(p.git),
    assignment: normalizeProjectAssignment(p.assignment),
    read_only: p.read_only === true,
    share_presence: p.share_presence !== false,
  };
}

function normalizeProjectAssignment(raw: unknown): ProjectAssignment | null {
  if (!isObj(raw) || raw.id == null) return null;
  const kind = raw.kind === "practical" || raw.kind === "case_study" ? raw.kind : null;
  return {
    id: num(raw.id),
    title: str(raw.title) ?? `Assignment #${raw.id}`,
    status: (str(raw.status) as ProjectAssignment["status"]) ?? "published",
    kind,
  };
}

export function summarizePresence(rows: ProjectPresence[], now = Date.now()): PresenceSummary {
  const online = rows.filter((r) => isPresenceLive(r, now));
  const latest = [...rows].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];
  const first = online[0] ?? latest;
  return {
    online: online.length > 0,
    devices_online: online.length,
    last_seen_at: latest?.last_seen_at ?? null,
    file: first?.state.file ?? null,
    dirty: first ? dirtyOf(first.state.dirty) : 0,
  };
}

const dirtyOf = (d: PresenceState["dirty"]): number => (Array.isArray(d) ? d.length : Number(d) || 0);

function normalizeSummary(raw: unknown): PresenceSummary | null {
  if (!isObj(raw)) return null;
  return {
    online: raw.online === true,
    devices_online: num(raw.devices_online, raw.online ? 1 : 0),
    last_seen_at: str(raw.last_seen_at),
    file: str(raw.file),
    dirty: dirtyOf(raw.dirty as PresenceState["dirty"]),
  };
}

export function normalizeProjectDetail(raw: unknown): ProjectDetail {
  const p = isObj(raw) ? (isObj(raw.project) ? { ...raw, ...raw.project } : raw) : {};
  const base = normalizeProject(p);
  const links = Array.isArray(p.links) ? p.links.map(normalizeLink) : base.links.items.map(normalizeLink);
  const can = isObj(p.can) ? p.can : null;
  const owner = base.my_role === "owner";
  return {
    ...base,
    links,
    members: Array.isArray(p.members) ? p.members.map(normalizeMember) : [],
    events: Array.isArray(p.events) ? p.events.map(normalizeEvent) : [],
    can: {
      edit: can ? can.edit === true : owner,
      save: can ? can.save === true : owner,
      report_git: can ? can.report_git === true : owner || base.my_role === "collaborator",
      read_all_revisions: can ? can.read_all_revisions === true : true,
      share_presence: typeof can?.share_presence === "boolean" ? can.share_presence : owner,
    },
  };
}

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** TMCode heartbeats every 20 s; a row older than this is a closed window. */
export const PRESENCE_STALE_MS = 75_000;

export const isPresenceLive = (p: ProjectPresence, now = Date.now()): boolean =>
  p.online !== false && p.state.open && now - new Date(p.last_seen_at).getTime() < PRESENCE_STALE_MS;

export function computeStats(projects: ProjectSummary[], now = Date.now()): ProjectStats {
  return {
    total: projects.length,
    active_this_week: projects.filter(
      (p) => p.last_activity_at && now - new Date(p.last_activity_at).getTime() < WEEK_MS,
    ).length,
    revisions: projects.reduce((n, p) => n + (p.head?.number ?? 0), 0),
    submissions: projects.reduce((n, p) => n + p.links.submitted, 0),
    live_now: projects.filter((p) => p.presence_summary.online).length,
    by_status: {
      draft: projects.filter((p) => p.status === "draft").length,
      submitted: projects.filter((p) => p.status === "submitted").length,
      graded: projects.filter((p) => p.status === "graded").length,
      removed: projects.filter((p) => p.status === "removed").length,
    },
  };
}

export function normalizeProjectList(body: unknown): ProjectList {
  const data = unwrap<unknown>(body);
  const rawList = Array.isArray(data) ? data : isObj(data) ? (data.projects ?? data.items ?? []) : [];
  const projects = (Array.isArray(rawList) ? rawList : []).map(normalizeProject);
  const computed = computeStats(projects);
  const serverStats = isObj(data) && isObj(data.stats) ? data.stats : null;
  return {
    projects,
    stats: serverStats
      ? {
          total: num(serverStats.total, computed.total),
          active_this_week: num(serverStats.active_this_week, computed.active_this_week),
          revisions: num(serverStats.revisions, computed.revisions),
          submissions: num(serverStats.submissions, computed.submissions),
          live_now: num(serverStats.online ?? serverStats.live_now, computed.live_now),
          by_status: isObj(serverStats.by_status)
            ? {
                draft: num(serverStats.by_status.draft),
                submitted: num(serverStats.by_status.submitted),
                graded: num(serverStats.by_status.graded),
                removed: num(serverStats.by_status.removed),
              }
            : computed.by_status,
        }
      : computed,
  };
}

const ACTIVITY_GROUPS: Record<string, ActivityType> = {
  quizzes: "quiz",
  assignments: "assignment",
  manual_assessments: "manual_assessment",
  assessments: "manual_assessment",
};

export function normalizeLinkable(body: unknown): LinkableActivity[] {
  const data = unwrap<unknown>(body);
  const toItem = (raw: unknown, type?: ActivityType): LinkableActivity | null => {
    if (!isObj(raw)) return null;
    const course =
      normalizeCourse(raw.course) ??
      (raw.course_id != null ? { id: num(raw.course_id), title: str(raw.course_name), code: null } : null);
    return {
      activity_type: (str(raw.activity_type) as ActivityType) ?? (str(raw.type) as ActivityType) ?? type ?? "assignment",
      activity_id: num(raw.activity_id ?? raw.id),
      title: str(raw.title) ?? str(raw.name) ?? "Untitled",
      course,
      due_date: str(raw.due_date) ?? str(raw.end_time) ?? str(raw.assessment_date),
      submission_type: str(raw.submission_type),
      practical_questions: Array.isArray(raw.practical_questions)
        ? raw.practical_questions.filter(isObj).map((q) => ({
            question_id: num(q.question_id),
            title: str(q.title) ?? "TMCode practical",
            points: num(q.points),
          }))
        : undefined,
    };
  };
  if (Array.isArray(data)) return data.map((r) => toItem(r)).filter((x): x is LinkableActivity => !!x);
  if (!isObj(data)) return [];
  if (Array.isArray(data.activities)) return normalizeLinkable(data.activities);
  if (Array.isArray(data.items)) return normalizeLinkable(data.items);
  // Grouped shape: { quizzes: [], assignments: [], manual_assessments: [] }
  return Object.entries(ACTIVITY_GROUPS).flatMap(([key, type]) =>
    Array.isArray(data[key])
      ? (data[key] as unknown[]).map((r) => toItem(r, type)).filter((x): x is LinkableActivity => !!x)
      : [],
  );
}

export function normalizeActivityProjects(body: unknown): ActivityProject[] {
  const data = unwrap<unknown>(body);
  const rows = Array.isArray(data) ? data : isObj(data) ? (data.projects ?? data.items ?? []) : [];
  return (Array.isArray(rows) ? rows : []).filter(isObj).map((r) => {
    // Either { link, project, owner, revision } or a flat link row with `project` nested.
    const link = normalizeLink(isObj(r.link) ? r.link : r);
    const project = normalizeProject(r.project ?? { id: link.project_id });
    if (!link.project_id) link.project_id = project.id;
    return {
      link,
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        kind: project.kind,
        language: project.language,
        repo_url: project.repo_url,
        repo_full_name: project.repo_full_name,
      },
      owner: normalizeUser(r.owner ?? (isObj(r.project) ? r.project.owner : undefined) ?? r.user),
      revision: normalizeRevision(r.frozen_revision ?? r.revision),
    };
  });
}

/**
 * A monitor row: `{project: {id, name, kind, language, owner}, course_ids,
 * presence: Presence}` (also accepts the presence fields at the top level).
 */
export function normalizeMonitorEntry(raw: unknown): MonitorEntry {
  const e = isObj(raw) ? raw : {};
  const presence = normalizePresence(isObj(e.presence) ? e.presence : e);
  const rawProject = isObj(e.project) ? e.project : { id: presence.project_id };
  const project = normalizeProject(rawProject);
  const owner = isObj(rawProject.owner) ? normalizeUser(rawProject.owner) : null;
  const courseSrc: unknown[] = Array.isArray(e.course_ids)
    ? e.course_ids
    : Array.isArray(e.courses)
      ? e.courses
      : e.course != null
        ? [e.course]
        : [];
  const courses = courseSrc.map(normalizeCourse).filter((c): c is CourseLite => !!c);
  return {
    ...presence,
    // The device's user, else the project owner (students work on their own projects).
    user: presence.user ?? (owner && owner.id === presence.user_id ? owner : presence.user) ?? owner,
    project_id: presence.project_id || project.id,
    project: { id: project.id, name: project.name, kind: project.kind, language: project.language, owner },
    courses,
    ...(e.withdrawn === true ? { withdrawn: true } : {}),
  };
}

function safeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** The server's reason for a refusal, or a fallback sentence. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
  return e?.response?.data?.message || e?.response?.data?.error || fallback;
}

export function apiErrorCode(error: unknown): string | null {
  const e = error as { response?: { data?: { error_code?: string; code?: string } } };
  return e?.response?.data?.error_code || e?.response?.data?.code || null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE = "/tmcode";
const enc = encodeURIComponent;

export const projectsApi = {
  /** Archived and removed projects are included; pages filter them. */
  async list(scope: ProjectScope = "mine"): Promise<ProjectList> {
    const res = await api.get(`${BASE}/projects`, { params: { scope, archived: "include", status: "all" } });
    return normalizeProjectList(res.data);
  },

  async get(id: number): Promise<ProjectDetail> {
    const res = await api.get(`${BASE}/projects/${id}`);
    return normalizeProjectDetail(unwrap(res.data));
  },

  async create(input: CreateProjectInput): Promise<ProjectDetail> {
    const res = await api.post(`${BASE}/projects`, input);
    return normalizeProjectDetail(unwrap(res.data));
  },

  async update(id: number, input: UpdateProjectInput): Promise<ProjectDetail> {
    const res = await api.patch(`${BASE}/projects/${id}`, input);
    return normalizeProjectDetail(unwrap(res.data));
  },

  /** Soft delete: status "removed" (restorable). */
  async remove(id: number): Promise<void> {
    await api.delete(`${BASE}/projects/${id}`);
  },

  /** Delete for good — only an already-removed project that was never handed in. */
  async deleteForGood(id: number): Promise<void> {
    await api.delete(`${BASE}/projects/${id}`, { params: { permanent: 1 } });
  },

  async restore(id: number): Promise<ProjectStatus> {
    const res = await api.post(`${BASE}/projects/${id}/restore`);
    return (unwrap<Json>(res.data)?.status as ProjectStatus) ?? "draft";
  },

  /** Hand the project in for its assignment (freezes the latest saved version; locks saving). */
  async submitProject(id: number): Promise<{ status: ProjectStatus; link: ProjectLink | null }> {
    const res = await api.post(`${BASE}/projects/${id}/submit`);
    const data = unwrap<Json>(res.data);
    return {
      status: (data?.project_status as ProjectStatus) ?? "submitted",
      link: isObj(data) && isObj(data.link) ? normalizeLink(data.link) : null,
    };
  },

  /** Take a submission back (before grading, while the assignment is open). */
  async withdraw(id: number): Promise<ProjectStatus> {
    const res = await api.post(`${BASE}/projects/${id}/withdraw`);
    return (unwrap<Json>(res.data)?.status as ProjectStatus) ?? "draft";
  },

  /** Teacher: send a submitted project back to the student for changes. */
  async returnForChanges(id: number, message?: string): Promise<ProjectStatus> {
    const res = await api.post(`${BASE}/projects/${id}/return`, { message: message || null });
    return (unwrap<Json>(res.data)?.status as ProjectStatus) ?? "draft";
  },

  async revisions(id: number, limit = 50): Promise<RevisionSummary[]> {
    const res = await api.get(`${BASE}/projects/${id}/revisions`, { params: { limit } });
    const data = unwrap<unknown>(res.data);
    const rows = Array.isArray(data) ? data : isObj(data) ? (data.revisions ?? data.items ?? []) : [];
    return (Array.isArray(rows) ? rows : [])
      .map(normalizeRevision)
      .filter((r): r is RevisionSummary => !!r);
  },

  /** `rev` is a revision id or "head". */
  async manifest(id: number, rev: number | "head"): Promise<RevisionManifest> {
    const res = await api.get(`${BASE}/projects/${id}/revisions/${rev}/manifest`);
    const data = unwrap<unknown>(res.data);
    const files = Array.isArray(data) ? data : isObj(data) ? (data.files ?? data.manifest ?? []) : [];
    return {
      revision: isObj(data) ? normalizeRevision(data.revision) : null,
      files: (Array.isArray(files) ? files : []).filter(isObj).map((f) => ({
        path: String(f.path ?? ""),
        sha256: String(f.sha256 ?? f.sha ?? ""),
        size: num(f.size),
      })),
    };
  },

  /**
   * One file at a revision: the server answers raw bytes (text/plain or
   * application/octet-stream). Binary files come back flagged, not decoded.
   */
  async fileContent(id: number, path: string, rev?: number | null): Promise<{ text: string; binary: boolean }> {
    const res = await api.get(`${BASE}/projects/${id}/files/${path.split("/").map(enc).join("/")}`, {
      params: { rev: rev ?? "head" },
      responseType: "text",
      transformResponse: (d) => d,
    });
    const ct = String(res.headers?.["content-type"] ?? "");
    const body = res.data as unknown;
    if (ct.includes("application/octet-stream")) return { text: "", binary: true };
    let text: string;
    if (typeof body === "string") {
      const parsed = ct.includes("application/json") ? unwrap<unknown>(safeJson(body)) : null;
      text = isObj(parsed) && typeof parsed.content === "string" ? parsed.content : body;
    } else {
      const parsed = unwrap<unknown>(body);
      text = isObj(parsed) && typeof parsed.content === "string" ? parsed.content : String(body ?? "");
    }
    return { text, binary: text.includes("\u0000") };
  },

  async openLink(id: number): Promise<string> {
    const res = await api.get(`${BASE}/projects/${id}/open-link`);
    const data = unwrap<Json>(res.data);
    const link = isObj(data) ? str(data.deeplink) ?? str(data.url) : null;
    if (!link) throw new Error("No TMCode link in the response");
    return link;
  },

  async addMember(id: number, input: AddMemberInput): Promise<ProjectMember> {
    const res = await api.post(`${BASE}/projects/${id}/members`, input);
    const data = unwrap<Json>(res.data);
    return normalizeMember(isObj(data) && isObj(data.member) ? data.member : data);
  },

  async removeMember(id: number, userId: number): Promise<void> {
    await api.delete(`${BASE}/projects/${id}/members/${userId}`);
  },

  async linkable(): Promise<LinkableActivity[]> {
    const res = await api.get(`${BASE}/activities/linkable`);
    return normalizeLinkable(res.data);
  },

  async link(id: number, activity_type: ActivityType, activity_id: number): Promise<ProjectLink> {
    const res = await api.post(`${BASE}/projects/${id}/links`, { activity_type, activity_id });
    const data = unwrap<Json>(res.data);
    return normalizeLink(isObj(data) && isObj(data.link) ? data.link : data);
  },

  /** Freezes the head revision (tm) or the last reported commit (github). */
  async submit(id: number, linkId: number, gitCommit?: string): Promise<ProjectLink> {
    const res = gitCommit
      ? await api.post(`${BASE}/projects/${id}/links/${linkId}/submit`, { git_commit: gitCommit })
      : await api.post(`${BASE}/projects/${id}/links/${linkId}/submit`);
    const data = unwrap<Json>(res.data);
    return normalizeLink(isObj(data) && isObj(data.link) ? data.link : data);
  },

  async unlink(id: number, linkId: number): Promise<void> {
    await api.delete(`${BASE}/projects/${id}/links/${linkId}`);
  },

  async activityProjects(type: ActivityType, activityId: number): Promise<ActivityProject[]> {
    const res = await api.get(`${BASE}/activities/${type}/${activityId}/projects`);
    return normalizeActivityProjects(res.data);
  },
};

/** Absolute SSE URLs (EventSource doesn't go through axios). */
export const projectsLiveUrl = (id: number): string => `${API_BASE_URL}${BASE}/projects/${id}/live`;
export const monitorLiveUrl = (): string => `${API_BASE_URL}${BASE}/monitor/live`;

/**
 * Assignments accept a project when their submission_type names `project`
 * (`project`, or a combination such as `file,project` / `both+project`), or
 * is `any`.
 */
export const assignmentAllowsProject = (submissionType: string | null | undefined): boolean => {
  if (!submissionType) return false;
  const t = submissionType.toLowerCase();
  return t === "any" || t.split(/[\s,+|/]+/).includes("project");
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  quiz: "Quiz",
  assignment: "Assignment",
  manual_assessment: "Recorded assessment",
};
