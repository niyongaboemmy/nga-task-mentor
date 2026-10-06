import api, { API_BASE_URL } from "../utils/axiosConfig";

/**
 * TMCode Projects — the Task Mentor web client's side of PROJECTS_PLAN.md §3
 * (everything under /api/tmcode). Students and teachers keep personal coding
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
  title: string;
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

export interface ProjectPresence {
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
  activity_title?: string | null;
  course?: CourseLite | null;
  due_date?: string | null;
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
  items: Pick<ProjectLink, "id" | "activity_type" | "activity_id" | "status" | "submitted_at" | "activity_title">[];
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
  updated_at?: string | null;
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

export interface ProjectSummary {
  id: number;
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
  /** The caller's role on this project; null for read-only access (VIEW_ALL / monitor). */
  my_role: MemberRole | null;
  size_bytes: number;
  file_count: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  head: RevisionSummary | null;
  presence: ProjectPresence[];
  links: LinkSummary;
  git?: GitState | null;
}

export interface ProjectDetail extends Omit<ProjectSummary, "links"> {
  links: ProjectLink[];
  members: ProjectMember[];
  events: ProjectEvent[];
}

export interface ProjectStats {
  total: number;
  active_this_week: number;
  revisions: number;
  submissions: number;
  live_now: number;
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
}

/** One row of the teacher view of an activity (GET /activities/:type/:id/projects). */
export interface ActivityProject {
  link: ProjectLink;
  project: Pick<ProjectSummary, "id" | "name" | "kind" | "language" | "repo_url" | "repo_full_name">;
  owner: UserLite;
  revision: RevisionSummary | null;
}

/** A row of the teacher monitor: one student's project open on one device. */
export interface MonitorEntry extends ProjectPresence {
  project: Pick<ProjectSummary, "id" | "name" | "kind" | "language">;
  courses: CourseLite[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  language?: string;
  kind: ProjectKind;
  repo_url?: string;
  visibility?: ProjectVisibility;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  visibility?: ProjectVisibility;
  /** true archives, false restores. */
  archived?: boolean;
}

export interface AddMemberInput {
  user_id?: number;
  email?: string;
  github_username: string;
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
  if (!isObj(raw)) return null;
  return {
    id: num(raw.id ?? raw.course_id),
    title: str(raw.title) ?? str(raw.name) ?? "Course",
    code: str(raw.code),
  };
}

export function normalizePresenceState(raw: unknown): PresenceState {
  const s = isObj(raw) ? raw : {};
  return { ...(s as Partial<PresenceState>), open: s.open === true || s.open === 1 || s.open === "true" };
}

export function normalizePresence(raw: unknown): ProjectPresence {
  const p = isObj(raw) ? raw : {};
  return {
    project_id: num(p.project_id),
    user_id: num(p.user_id ?? (isObj(p.user) ? p.user.id : undefined)),
    user: userOrNull(p.user),
    device_id: String(p.device_id ?? "device"),
    device_name: str(p.device_name) ?? str(p.device_label),
    app_version: str(p.app_version),
    state: normalizePresenceState(typeof p.state === "string" ? safeJson(p.state) : p.state),
    last_seen_at: str(p.last_seen_at) ?? new Date(0).toISOString(),
  };
}

export function normalizeRevision(raw: unknown): RevisionSummary | null {
  if (!isObj(raw)) return null;
  return {
    id: num(raw.id),
    number: num(raw.number),
    message: str(raw.message),
    author: userOrNull(raw.author),
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
    activity_title: str(l.activity_title) ?? str(activity.title),
    course: normalizeCourse(l.course ?? activity.course),
    due_date: str(l.due_date) ?? str(activity.due_date),
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

function normalizeGit(raw: unknown): GitState | null {
  if (!isObj(raw)) return null;
  return {
    branch: str(raw.branch),
    head_commit: str(raw.head_commit),
    ahead: raw.ahead == null ? null : num(raw.ahead),
    behind: raw.behind == null ? null : num(raw.behind),
    changes: raw.changes == null ? null : num(raw.changes),
    remote_url: str(raw.remote_url),
    updated_at: str(raw.updated_at),
    pushes: Array.isArray(raw.pushes)
      ? raw.pushes.filter(isObj).map((p) => ({
          commit: String(p.commit ?? ""),
          message: str(p.message),
          at: str(p.at) ?? str(p.created_at) ?? new Date(0).toISOString(),
          user: userOrNull(p.user),
        }))
      : [],
  };
}

export function normalizeEvent(raw: unknown): ProjectEvent {
  const e = isObj(raw) ? raw : {};
  return {
    id: num(e.id),
    project_id: e.project_id == null ? undefined : num(e.project_id),
    type: str(e.type) ?? "event",
    user: userOrNull(e.user),
    data: isObj(e.data) ? e.data : typeof e.data === "string" ? (safeJson(e.data) as Json | null) : null,
    created_at: str(e.created_at) ?? new Date(0).toISOString(),
  };
}

function normalizeMember(raw: unknown): ProjectMember {
  const m = isObj(raw) ? raw : {};
  const user = normalizeUser(m.user ?? { id: m.user_id, email: m.email, name: m.name });
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
  return {
    id: num(p.id),
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
    presence: Array.isArray(p.presence) ? p.presence.map(normalizePresence) : [],
    links: normalizeLinkSummary(p.links),
    git: normalizeGit(p.git),
  };
}

export function normalizeProjectDetail(raw: unknown): ProjectDetail {
  const p = isObj(raw) ? (isObj(raw.project) ? { ...raw, ...raw.project } : raw) : {};
  const base = normalizeProject(p);
  const links = Array.isArray(p.links) ? p.links.map(normalizeLink) : base.links.items.map(normalizeLink);
  return {
    ...base,
    links,
    members: Array.isArray(p.members) ? p.members.map(normalizeMember) : [],
    events: Array.isArray(p.events) ? p.events.map(normalizeEvent) : [],
  };
}

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** TMCode heartbeats every 20 s; a row older than this is a closed window. */
export const PRESENCE_STALE_MS = 75_000;

export const isPresenceLive = (p: ProjectPresence, now = Date.now()): boolean =>
  p.state.open && now - new Date(p.last_seen_at).getTime() < PRESENCE_STALE_MS;

export function computeStats(projects: ProjectSummary[], now = Date.now()): ProjectStats {
  return {
    total: projects.length,
    active_this_week: projects.filter(
      (p) => p.last_activity_at && now - new Date(p.last_activity_at).getTime() < WEEK_MS,
    ).length,
    revisions: projects.reduce((n, p) => n + (p.head?.number ?? 0), 0),
    submissions: projects.reduce((n, p) => n + p.links.submitted, 0),
    live_now: projects.filter((p) => p.presence.some((x) => isPresenceLive(x, now))).length,
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
          live_now: num(serverStats.live_now, computed.live_now),
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
    return {
      activity_type: (str(raw.activity_type) as ActivityType) ?? type ?? "assignment",
      activity_id: num(raw.activity_id ?? raw.id),
      title: str(raw.title) ?? str(raw.name) ?? "Untitled",
      course: normalizeCourse(raw.course),
      due_date: str(raw.due_date) ?? str(raw.end_time) ?? str(raw.assessment_date),
    };
  };
  if (Array.isArray(data)) return data.map((r) => toItem(r)).filter((x): x is LinkableActivity => !!x);
  if (!isObj(data)) return [];
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
        kind: project.kind,
        language: project.language,
        repo_url: project.repo_url,
        repo_full_name: project.repo_full_name,
      },
      owner: normalizeUser(r.owner ?? (isObj(r.project) ? r.project.owner : undefined) ?? r.user),
      revision: normalizeRevision(r.revision),
    };
  });
}

export function normalizeMonitorEntry(raw: unknown): MonitorEntry {
  const e = isObj(raw) ? raw : {};
  const presence = normalizePresence(e);
  const project = normalizeProject(e.project ?? { id: presence.project_id });
  const courses = Array.isArray(e.courses)
    ? e.courses.map(normalizeCourse).filter((c): c is CourseLite => !!c)
    : e.course
      ? [normalizeCourse(e.course)].filter((c): c is CourseLite => !!c)
      : [];
  return {
    ...presence,
    project_id: presence.project_id || project.id,
    project: { id: project.id, name: project.name, kind: project.kind, language: project.language },
    courses,
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
  async list(scope: ProjectScope = "mine"): Promise<ProjectList> {
    const res = await api.get(`${BASE}/projects`, { params: { scope } });
    return normalizeProjectList(res.data);
  },

  async get(id: number): Promise<ProjectDetail> {
    const res = await api.get(`${BASE}/projects/${id}`);
    return normalizeProjectDetail(unwrap(res.data));
  },

  async create(input: CreateProjectInput): Promise<ProjectSummary> {
    const res = await api.post(`${BASE}/projects`, input);
    const data = unwrap<Json>(res.data);
    return normalizeProject(isObj(data) && isObj(data.project) ? data.project : data);
  },

  async update(id: number, input: UpdateProjectInput): Promise<ProjectSummary> {
    const res = await api.patch(`${BASE}/projects/${id}`, input);
    const data = unwrap<Json>(res.data);
    return normalizeProject(isObj(data) && isObj(data.project) ? data.project : data);
  },

  async remove(id: number): Promise<void> {
    await api.delete(`${BASE}/projects/${id}`);
  },

  async revisions(id: number, limit = 50): Promise<RevisionSummary[]> {
    const res = await api.get(`${BASE}/projects/${id}/revisions`, { params: { limit } });
    const data = unwrap<unknown>(res.data);
    const rows = Array.isArray(data) ? data : isObj(data) ? (data.revisions ?? data.items ?? []) : [];
    return (Array.isArray(rows) ? rows : [])
      .map(normalizeRevision)
      .filter((r): r is RevisionSummary => !!r);
  },

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

  /** One file's text at a revision (the server answers raw bytes, or `{ content }`). */
  async fileContent(id: number, path: string, rev?: number | null): Promise<string> {
    const res = await api.get(`${BASE}/projects/${id}/files/${path.split("/").map(enc).join("/")}`, {
      params: rev ? { rev } : undefined,
      responseType: "text",
      transformResponse: (d) => d,
    });
    const body = res.data as unknown;
    if (typeof body === "string") {
      const ct = String(res.headers?.["content-type"] ?? "");
      if (ct.includes("application/json")) {
        const parsed = unwrap<unknown>(safeJson(body));
        if (isObj(parsed) && typeof parsed.content === "string") return parsed.content;
      }
      return body;
    }
    const parsed = unwrap<unknown>(body);
    return isObj(parsed) && typeof parsed.content === "string" ? parsed.content : String(body ?? "");
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

  async submit(id: number, linkId: number): Promise<ProjectLink> {
    const res = await api.post(`${BASE}/projects/${id}/links/${linkId}/submit`);
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
