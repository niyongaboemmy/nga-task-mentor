/**
 * Server-shaped TMCode Projects payloads (PROJECTS_PLAN.md §3), shared by the
 * vitest suites and the Playwright mock API (e2e/fixtures/projectsMock.ts).
 * Times are relative to `now` so "live" and "this week" stay true.
 */

export const minutesAgo = (m: number, now = Date.now()) => new Date(now - m * 60_000).toISOString();

export const USERS = {
  student: { id: 201, name: "John Doe", email: "john.doe@student.com", avatar_url: null },
  classmate: { id: 202, name: "Grace Uwase", email: "grace@student.com", avatar_url: null },
  teacher: { id: 101, name: "Alice Johnson", email: "alice.johnson@teacher.com", avatar_url: null },
};

export const COURSES = {
  cs: { id: 11, title: "Computer Science S5", code: "CS5" },
  web: { id: 12, title: "Web Development", code: "WEB" },
};

export function makeProjects(now = Date.now()) {
  const sortingHead = {
    id: 9003,
    number: 3,
    message: "Add merge sort",
    author: USERS.student,
    file_count: 4,
    size_bytes: 6120,
    source: "save",
    git_commit: null,
    created_at: minutesAgo(25, now),
  };
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
      owner: USERS.student,
      my_role: "owner",
      size_bytes: 6120,
      file_count: 4,
      archived_at: null,
      created_at: minutesAgo(60 * 24 * 3, now),
      updated_at: minutesAgo(25, now),
      last_activity_at: minutesAgo(1, now),
      head: sortingHead,
      presence: [
        {
          project_id: 1,
          user_id: USERS.student.id,
          user: USERS.student,
          device_id: "dev-mac",
          device_name: "MacBook",
          app_version: "0.4.0",
          state: { open: true, file: "src/main.cpp", dirty: 2, sync: "local_changes", last_run: { at: minutesAgo(3, now), status: "ok" } },
          last_seen_at: new Date(now - 5_000).toISOString(),
        },
      ],
      links: {
        total: 1,
        submitted: 0,
        items: [{ id: 501, activity_type: "assignment", activity_id: 77, status: "linked", activity_title: "Sorting lab" }],
      },
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
      owner: USERS.student,
      my_role: "owner",
      size_bytes: 0,
      file_count: 0,
      archived_at: null,
      created_at: minutesAgo(60 * 24 * 20, now),
      updated_at: minutesAgo(60 * 24 * 2, now),
      last_activity_at: minutesAgo(60 * 24 * 2, now),
      head: null,
      presence: [],
      links: { total: 1, submitted: 1, items: [{ id: 502, activity_type: "assignment", activity_id: 78, status: "submitted", submitted_at: minutesAgo(60 * 24 * 2, now), activity_title: "Web portfolio" }] },
      git: {
        branch: "main",
        head_commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
        ahead: 1,
        behind: 0,
        changes: 2,
        remote_url: "https://github.com/johndoe/portfolio.git",
        updated_at: minutesAgo(60 * 24 * 2, now),
        pushes: [
          { commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39", message: "Contact form", at: minutesAgo(60 * 24 * 2, now), user: USERS.student },
          { commit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", message: "Initial commit", at: minutesAgo(60 * 24 * 5, now), user: USERS.student },
        ],
      },
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
      owner: USERS.student,
      my_role: "owner",
      size_bytes: 2048,
      file_count: 2,
      archived_at: minutesAgo(60 * 24 * 30, now),
      created_at: minutesAgo(60 * 24 * 60, now),
      updated_at: minutesAgo(60 * 24 * 30, now),
      last_activity_at: minutesAgo(60 * 24 * 30, now),
      head: { ...sortingHead, id: 9100, number: 1, message: "Snake", created_at: minutesAgo(60 * 24 * 40, now) },
      presence: [],
      links: { total: 0, submitted: 0, items: [] },
    },
  ];
}

export function makeRevisions(now = Date.now()) {
  return [
    { id: 9003, number: 3, message: "Add merge sort", author: USERS.student, file_count: 4, size_bytes: 6120, source: "save", git_commit: null, created_at: minutesAgo(25, now) },
    { id: 9002, number: 2, message: null, author: USERS.student, file_count: 3, size_bytes: 4100, source: "auto", git_commit: null, created_at: minutesAgo(60 * 5, now) },
    { id: 9001, number: 1, message: "First version", author: USERS.student, file_count: 2, size_bytes: 1900, source: "save", git_commit: null, created_at: minutesAgo(60 * 24 * 3, now) },
  ];
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
  "src/sort.hpp":
    "#pragma once\n#include <vector>\n\nvoid merge_sort(std::vector<int>& v);\nvoid bubble_sort(std::vector<int>& v);\n",
};

export function makeEvents(now = Date.now()) {
  return [
    { id: 7005, type: "opened", user: USERS.student, data: { device_name: "MacBook" }, created_at: minutesAgo(10, now) },
    { id: 7004, type: "saved", user: USERS.student, data: { number: 3, message: "Add merge sort" }, created_at: minutesAgo(25, now) },
    { id: 7003, type: "linked", user: USERS.student, data: { activity_title: "Sorting lab" }, created_at: minutesAgo(60 * 4, now) },
    { id: 7002, type: "saved", user: USERS.student, data: { number: 1, message: "First version" }, created_at: minutesAgo(60 * 24 * 3, now) },
    { id: 7001, type: "created", user: USERS.student, data: {}, created_at: minutesAgo(60 * 24 * 3 + 5, now) },
  ];
}

export function makeLinkable() {
  return {
    assignments: [
      { id: 77, title: "Sorting lab", course: COURSES.cs, due_date: minutesAgo(-60 * 24 * 2) },
      { id: 79, title: "Recursion exercises", course: COURSES.cs, due_date: minutesAgo(-60 * 24 * 6) },
    ],
    quizzes: [{ id: 31, title: "C++ practical quiz", course: COURSES.cs, due_date: null }],
    manual_assessments: [{ id: 41, title: "Term project demo", course: COURSES.web, assessment_date: minutesAgo(-60 * 24 * 9) }],
  };
}

export function makeActivityProjects(now = Date.now()) {
  return [
    {
      link: { id: 601, project_id: 1, activity_type: "assignment", activity_id: 77, status: "submitted", revision_id: 9003, revision_number: 3, submitted_at: minutesAgo(30, now) },
      project: { id: 1, name: "Sorting algorithms", kind: "tm", language: "cpp" },
      owner: USERS.student,
      revision: { id: 9003, number: 3, file_count: 4, size_bytes: 6120, source: "submit", created_at: minutesAgo(30, now) },
    },
    {
      link: { id: 602, project_id: 2, activity_type: "assignment", activity_id: 77, status: "submitted", git_commit: "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39", submitted_at: minutesAgo(90, now) },
      project: { id: 2, name: "Portfolio site", kind: "github", language: "react", repo_url: "https://github.com/johndoe/portfolio" },
      owner: USERS.classmate,
      revision: null,
    },
    {
      link: { id: 603, project_id: 5, activity_type: "assignment", activity_id: 77, status: "linked" },
      project: { id: 5, name: "Sort practice", kind: "tm", language: "cpp" },
      owner: { id: 203, name: "Eric Mugisha", email: "eric@student.com" },
      revision: null,
    },
  ];
}

export function makeMonitorSnapshot(now = Date.now()) {
  const row = (
    project_id: number,
    user: { id: number; name: string },
    project: { id: number; name: string; kind: string; language: string },
    courses: { id: number; title: string; code: string }[],
    state: Record<string, unknown>,
    secondsAgo: number,
    device_name: string,
  ) => ({
    project_id,
    user_id: user.id,
    user,
    device_id: `dev-${user.id}-${project_id}`,
    device_name,
    app_version: "0.4.0",
    state,
    last_seen_at: new Date(now - secondsAgo * 1000).toISOString(),
    project,
    courses,
  });
  return {
    items: [
      row(1, USERS.student, { id: 1, name: "Sorting algorithms", kind: "tm", language: "cpp" }, [COURSES.cs], { open: true, file: "src/main.cpp", dirty: 2, sync: "local_changes", last_run: { at: minutesAgo(2, now), status: "ok" } }, 8, "MacBook"),
      row(5, { id: 203, name: "Eric Mugisha" }, { id: 5, name: "Sort practice", kind: "tm", language: "cpp" }, [COURSES.cs], { open: true, file: "main.cpp", dirty: 0, sync: "conflict", last_run: { at: minutesAgo(1, now), status: "error" } }, 12, "Lab PC 14"),
      row(2, USERS.classmate, { id: 2, name: "Portfolio site", kind: "github", language: "react" }, [COURSES.web], { open: true, file: "src/App.tsx", dirty: 1, branch: "main", ahead: 1, behind: 0, changes: 3 }, 4, "Lab PC 03"),
      row(6, { id: 204, name: "Aline Keza" }, { id: 6, name: "Calculator", kind: "tm", language: "python" }, [COURSES.cs], { open: false, file: null, dirty: 0, sync: "synced" }, 60 * 12, "Lab PC 07"),
    ],
  };
}
