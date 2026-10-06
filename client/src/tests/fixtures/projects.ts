/**
 * Server-shaped TMCode Projects payloads, exactly as documented in the
 * server's server/src/tmcode/PROJECTS_API.md ("Shapes"), shared by the vitest
 * suites and the Playwright mock API (e2e/fixtures/projectsMock.ts).
 * Times are relative to `now` so "online" and "this week" stay true.
 */

export const minutesAgo = (m: number, now = Date.now()) => new Date(now - m * 60_000).toISOString();

/** UserBrief = { id, name, avatar_url } */
export const USERS = {
  student: { id: 201, name: "John Doe", avatar_url: null },
  classmate: { id: 202, name: "Grace Uwase", avatar_url: null },
  eric: { id: 203, name: "Eric Mugisha", avatar_url: null },
  aline: { id: 204, name: "Aline Keza", avatar_url: null },
  teacher: { id: 101, name: "Alice Johnson", avatar_url: null },
};

export const COURSES = {
  cs: { id: 11, title: "Computer Science S5", code: "CS5" },
  web: { id: 12, title: "Web Development", code: "WEB" },
};

/** Revision */
export function makeRevisions(now = Date.now()) {
  const rev = (id: number, number: number, message: string | null, source: string, file_count: number, size_bytes: number, mins: number) => ({
    id,
    project_id: 1,
    number,
    parent_id: number > 1 ? id - 1 : null,
    author_id: USERS.student.id,
    author_name: USERS.student.name,
    message,
    file_count,
    size_bytes,
    source,
    git_commit: null,
    created_at: minutesAgo(mins, now),
  });
  return [
    rev(9003, 3, "Add merge sort", "save", 4, 6120, 25),
    rev(9002, 2, null, "auto", 3, 4100, 60 * 5),
    rev(9001, 1, "First version", "save", 2, 1900, 60 * 24 * 3),
  ];
}

const gitState = (now: number) => ({
  branch: "main",
  head_commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
  ahead: 1,
  behind: 0,
  changes: 2,
  remote_url: "https://github.com/johndoe/portfolio.git",
  last_push: { commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39", message: "Contact form", at: minutesAgo(60 * 24 * 2, now) },
  reported_at: minutesAgo(60 * 24 * 2, now),
});

/** ProjectCore */
export function makeCores(now = Date.now()) {
  return [
    {
      id: 1,
      name: "Sorting algorithms",
      slug: "sorting-algorithms",
      description: "Bubble, insertion and merge sort in C++ with timings.",
      language: "cpp",
      kind: "tm",
      visibility: "private",
      repo_url: null,
      repo_full_name: null,
      default_branch: null,
      head_revision_id: 9003,
      size_bytes: 6120,
      file_count: 4,
      git: null,
      archived_at: null,
      last_activity_at: minutesAgo(1, now),
      created_at: minutesAgo(60 * 24 * 3, now),
      updated_at: minutesAgo(25, now),
      owner: USERS.student,
      my_role: "owner",
    },
    {
      id: 2,
      name: "Portfolio site",
      slug: "portfolio-site",
      description: "My personal website.",
      language: "react",
      kind: "github",
      visibility: "course",
      repo_url: "https://github.com/johndoe/portfolio",
      repo_full_name: "johndoe/portfolio",
      default_branch: "main",
      head_revision_id: null,
      size_bytes: 0,
      file_count: 0,
      git: gitState(now),
      archived_at: null,
      last_activity_at: minutesAgo(60 * 24 * 2, now),
      created_at: minutesAgo(60 * 24 * 20, now),
      updated_at: minutesAgo(60 * 24 * 2, now),
      owner: USERS.student,
      my_role: "owner",
    },
    {
      id: 3,
      name: "Python games",
      slug: "python-games",
      description: null,
      language: "python",
      kind: "tm",
      visibility: "private",
      repo_url: null,
      repo_full_name: null,
      default_branch: null,
      head_revision_id: 9100,
      size_bytes: 2048,
      file_count: 2,
      git: null,
      archived_at: minutesAgo(60 * 24 * 30, now),
      last_activity_at: minutesAgo(60 * 24 * 30, now),
      created_at: minutesAgo(60 * 24 * 60, now),
      updated_at: minutesAgo(60 * 24 * 30, now),
      owner: USERS.student,
      my_role: "owner",
    },
  ];
}

/** Presence (one device row) */
export function makePresence(now = Date.now()) {
  return {
    project_id: 1,
    user_id: USERS.student.id,
    user_name: USERS.student.name,
    device_id: "dev-mac",
    app_version: "0.4.0",
    state: { open: true, file: "src/main.cpp", dirty: 2, sync: "local_changes", device_name: "MacBook", last_run: { at: minutesAgo(3, now), status: "ok" } },
    last_seen_at: new Date(now - 5_000).toISOString(),
    online: true,
  };
}

/** GET /projects → { projects: ProjectRow[], stats } */
export function makeProjectList(now = Date.now()) {
  const [sorting, portfolio, games] = makeCores(now);
  const revs = makeRevisions(now);
  const offline = { online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 };
  return {
    projects: [
      {
        ...sorting,
        head: revs[0],
        presence: { online: true, devices_online: 1, last_seen_at: new Date(now - 5_000).toISOString(), file: "src/main.cpp", dirty: 2 },
        links: { total: 1, submitted: 0, items: [{ id: 501, activity_type: "assignment", activity_id: 77, status: "linked" }] },
      },
      {
        ...portfolio,
        head: null,
        presence: { ...offline, last_seen_at: minutesAgo(60 * 24 * 2, now) },
        links: { total: 1, submitted: 1, items: [{ id: 502, activity_type: "assignment", activity_id: 78, status: "submitted" }] },
      },
      {
        ...games,
        head: { ...revs[2], id: 9100, project_id: 3, message: "Snake", created_at: minutesAgo(60 * 24 * 40, now) },
        presence: offline,
        links: { total: 0, submitted: 0, items: [] },
      },
    ],
    stats: { total: 3, online: 1, active_this_week: 2, revisions: 4, submissions: 1 },
  };
}

/** Link */
export function makeLinks(now = Date.now()): Record<number, Record<string, unknown>[]> {
  return {
    1: [
      {
        id: 501, project_id: 1, activity_type: "assignment", activity_id: 77,
        activity: { title: "Sorting lab", course_id: 11, open: true, due_date: new Date(now + 2 * 86400_000).toISOString() },
        status: "linked", revision_id: null, revision_number: null, git_commit: null, submitted_at: null, linked_by: 201, created_at: minutesAgo(60 * 4, now),
      },
    ],
    2: [
      {
        id: 502, project_id: 2, activity_type: "assignment", activity_id: 78,
        activity: { title: "Web portfolio", course_id: 12, open: true, due_date: null },
        status: "submitted", revision_id: null, revision_number: null, git_commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
        submitted_at: minutesAgo(60 * 24 * 2, now), linked_by: 201, created_at: minutesAgo(60 * 24 * 3, now),
      },
    ],
  };
}

/** Event (newest first) */
export function makeEvents(now = Date.now()) {
  const ev = (id: number, type: string, data: Record<string, unknown>, mins: number) => ({
    id, project_id: 1, user_id: USERS.student.id, user_name: USERS.student.name, type, data, created_at: minutesAgo(mins, now),
  });
  return [
    ev(7005, "opened", { device_id: "dev-mac", file: "src/main.cpp" }, 10),
    ev(7004, "saved", { revision_id: 9003, number: 3, source: "save", file_count: 4 }, 25),
    ev(7003, "linked", { title: "Sorting lab", activity_type: "assignment", activity_id: 77 }, 60 * 4),
    ev(7002, "saved", { revision_id: 9001, number: 1, source: "save", file_count: 2 }, 60 * 24 * 3),
    ev(7001, "created", {}, 60 * 24 * 3 + 5),
  ];
}

/** Member (github projects only) */
export function makeMembers(now = Date.now()) {
  return [
    { user_id: 201, name: USERS.student.name, avatar_url: null, role: "owner", github_username: "johndoe", status: "active", invited_by: null, created_at: minutesAgo(60 * 24 * 20, now) },
    { user_id: 202, name: USERS.classmate.name, avatar_url: null, role: "collaborator", github_username: "grace-u", status: "active", invited_by: 201, created_at: minutesAgo(60 * 24 * 10, now) },
  ];
}

/** GET /projects/:id → { project: ProjectDetails } */
export function makeProjectDetails(id: number, now = Date.now()) {
  const list = makeProjectList(now).projects;
  const row = list.find((p) => p.id === id)!;
  const presence = id === 1 ? [makePresence(now)] : [];
  return {
    project: {
      ...row,
      members: row.kind === "github" ? makeMembers(now) : [],
      links: makeLinks(now)[id] ?? [],
      events: id === 1 ? makeEvents(now) : [{ id: 1, project_id: id, user_id: 201, user_name: "John Doe", type: "created", data: {}, created_at: row.created_at }],
      presence,
      presence_summary: row.presence,
      can: { edit: true, save: row.kind === "tm", report_git: row.kind === "github", read_all_revisions: true },
    },
  };
}

export const MANIFESTS: Record<number, { path: string; sha256: string; size: number }[]> = {
  9003: [
    { path: "README.md", sha256: "r3", size: 220 },
    { path: "CMakeLists.txt", sha256: "c3", size: 180 },
    { path: "src/main.cpp", sha256: "m3", size: 2900 },
    { path: "src/sort.hpp", sha256: "s3", size: 2820 },
  ],
  9002: [
    { path: "README.md", sha256: "r3", size: 220 },
    { path: "src/main.cpp", sha256: "m2", size: 2100 },
    { path: "src/sort.hpp", sha256: "s2", size: 1780 },
  ],
  9001: [
    { path: "README.md", sha256: "r1", size: 120 },
    { path: "src/main.cpp", sha256: "m1", size: 1780 },
  ],
};

export const FILE_CONTENT: Record<string, string> = {
  "README.md": "# Sorting algorithms\n\nBubble, insertion and merge sort, timed on 10k numbers.\n",
  "CMakeLists.txt": "cmake_minimum_required(VERSION 3.16)\nproject(sorting CXX)\nadd_executable(sorting src/main.cpp)\n",
  "src/main.cpp":
    '#include <iostream>\n#include <vector>\n#include "sort.hpp"\n\nint main() {\n  std::vector<int> v{5, 3, 8, 1, 9, 2};\n  merge_sort(v);\n  for (int x : v) std::cout << x << " ";\n  std::cout << "\\n";\n  return 0;\n}\n',
  "src/sort.hpp": "#pragma once\n#include <vector>\n\nvoid merge_sort(std::vector<int>& v);\nvoid bubble_sort(std::vector<int>& v);\n",
};

/** GET /activities/linkable → { activities: [...] } */
export function makeLinkable(now = Date.now()) {
  return {
    activities: [
      { type: "assignment", id: 77, title: "Sorting lab", course_id: 11, course_name: "Computer Science S5", due_date: minutesAgo(-60 * 24 * 2, now), submission_type: "project" },
      { type: "assignment", id: 79, title: "Recursion exercises", course_id: 11, course_name: "Computer Science S5", due_date: minutesAgo(-60 * 24 * 6, now), submission_type: "both" },
      { type: "quiz", id: 31, title: "C++ practical quiz", course_id: 11, course_name: "Computer Science S5", due_date: null },
      { type: "manual_assessment", id: 41, title: "Term project demo", course_id: 12, course_name: "Web Development", due_date: minutesAgo(-60 * 24 * 9, now) },
    ],
  };
}

/** GET /activities/:type/:id/projects → { activity, projects } */
export function makeActivityProjects(now = Date.now()) {
  const offline = { online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 };
  return {
    activity: { type: "assignment", id: 77, title: "Sorting lab", course_id: 11, open: true, due_date: minutesAgo(-60 * 24 * 2, now) },
    projects: [
      {
        link: { id: 601, project_id: 1, activity_type: "assignment", activity_id: 77, activity: { title: "Sorting lab", course_id: 11, open: true, due_date: null }, status: "submitted", revision_id: 9003, revision_number: 3, git_commit: null, submitted_at: minutesAgo(30, now), linked_by: 201, created_at: minutesAgo(60, now) },
        project: { id: 1, name: "Sorting algorithms", kind: "tm", language: "cpp", visibility: "private", repo_url: null, git: null },
        owner: USERS.student,
        frozen_revision: makeRevisions(now)[0],
        presence: { online: true, devices_online: 1, last_seen_at: new Date(now - 5000).toISOString(), file: "src/main.cpp", dirty: 2 },
      },
      {
        link: { id: 602, project_id: 2, activity_type: "assignment", activity_id: 77, activity: { title: "Sorting lab", course_id: 11, open: true, due_date: null }, status: "submitted", revision_id: null, revision_number: null, git_commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39", submitted_at: minutesAgo(90, now), linked_by: 202, created_at: minutesAgo(120, now) },
        project: { id: 2, name: "Portfolio site", kind: "github", language: "react", visibility: "course", repo_url: "https://github.com/johndoe/portfolio", git: gitState(now) },
        owner: USERS.classmate,
        frozen_revision: null,
        presence: offline,
      },
      {
        link: { id: 603, project_id: 5, activity_type: "assignment", activity_id: 77, activity: { title: "Sorting lab", course_id: 11, open: true, due_date: null }, status: "linked", revision_id: null, revision_number: null, git_commit: null, submitted_at: null, linked_by: 203, created_at: minutesAgo(200, now) },
        project: { id: 5, name: "Sort practice", kind: "tm", language: "cpp", visibility: "private", repo_url: null, git: null },
        owner: USERS.eric,
        frozen_revision: null,
        presence: offline,
      },
    ],
  };
}

/** MonitorEntry = { project: {id, name, kind, language, owner}, course_ids, presence: Presence } */
export function makeMonitorEntry(
  project: { id: number; name: string; kind: string; language: string },
  owner: { id: number; name: string; avatar_url: null },
  course_ids: number[],
  state: Record<string, unknown>,
  secondsAgo: number,
  now = Date.now(),
  online = true,
) {
  return {
    project: { ...project, owner },
    course_ids,
    presence: {
      project_id: project.id,
      user_id: owner.id,
      user_name: owner.name,
      device_id: `dev-${owner.id}-${project.id}`,
      app_version: "0.4.0",
      state,
      last_seen_at: new Date(now - secondsAgo * 1000).toISOString(),
      online,
    },
  };
}

/** /monitor/live `hello` */
export function makeMonitorHello(now = Date.now()) {
  return {
    scope: "courses",
    course_ids: [11, 12],
    online: [
      makeMonitorEntry({ id: 1, name: "Sorting algorithms", kind: "tm", language: "cpp" }, USERS.student, [11], { open: true, file: "src/main.cpp", dirty: 2, sync: "local_changes", device_name: "MacBook", last_run: { at: minutesAgo(2, now), status: "ok" } }, 8, now),
      makeMonitorEntry({ id: 5, name: "Sort practice", kind: "tm", language: "cpp" }, USERS.eric, [11], { open: true, file: "main.cpp", dirty: 0, sync: "conflict", device_name: "Lab PC 14", last_run: { at: minutesAgo(1, now), status: "error" } }, 12, now),
      makeMonitorEntry({ id: 2, name: "Portfolio site", kind: "github", language: "react" }, USERS.classmate, [12], { open: true, file: "src/App.tsx", dirty: 1, branch: "main", ahead: 1, behind: 0, changes: 3, device_name: "Lab PC 03" }, 4, now),
    ],
  };
}
