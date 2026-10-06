import { describe, it, expect, vi, beforeEach } from "vitest";

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock, API_BASE_URL: "http://api.test/api" }));

import {
  assignmentAllowsProject,
  computeStats,
  courseLabel,
  isPresenceLive,
  monitorLiveUrl,
  normalizeActivityProjects,
  normalizeEvent,
  normalizeLinkable,
  normalizeMonitorEntry,
  normalizePresence,
  normalizeProject,
  normalizeProjectDetail,
  normalizeProjectList,
  normalizeRevision,
  projectsApi,
  projectsLiveUrl,
  unwrap,
} from "../services/projectsApi";
import {
  makeActivityProjects,
  makeLinkable,
  makeMonitorHello,
  makeProjectDetails,
  makeProjectList,
  makeRevisions,
} from "./fixtures/projects";

describe("projectsApi (server PROJECTS_API.md shapes)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unwraps the { success, data } envelope and passes bare payloads through", () => {
    expect(unwrap({ success: true, data: [1, 2] })).toEqual([1, 2]);
    expect(unwrap({ data: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrap({ projects: [] })).toEqual({ projects: [] });
  });

  it("lists projects (archived included) with the server's stats and presence summaries", async () => {
    axiosMock.get.mockResolvedValue({ data: makeProjectList() });
    const list = await projectsApi.list("shared");
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/projects", { params: { scope: "shared", archived: "include" } });
    expect(list.projects).toHaveLength(3);
    expect(list.projects[0]).toMatchObject({
      id: 1,
      kind: "tm",
      my_role: "owner",
      head: { number: 3, author: { name: "John Doe" } },
      presence: [],
      presence_summary: { online: true, devices_online: 1, file: "src/main.cpp", dirty: 2 },
      links: { total: 1, submitted: 0 },
    });
    expect(list.stats).toEqual({ total: 3, active_this_week: 2, revisions: 4, submissions: 1, live_now: 1 });
  });

  it("computes the stats strip when the server sends none", () => {
    const { projects } = makeProjectList();
    expect(normalizeProjectList({ projects }).stats).toEqual({ total: 3, active_this_week: 2, revisions: 4, submissions: 1, live_now: 1 });
    expect(normalizeProjectList(projects).projects.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(computeStats([]).live_now).toBe(0);
  });

  it("reads project details: flat members, links with `activity`, events with user_name, capabilities", () => {
    const d = normalizeProjectDetail(makeProjectDetails(2));
    expect(d.members.map((m) => [m.user.name, m.role, m.github_username])).toEqual([
      ["John Doe", "owner", "johndoe"],
      ["Grace Uwase", "collaborator", "grace-u"],
    ]);
    expect(d.links[0]).toMatchObject({ activity_title: "Web portfolio", course: { id: 12, title: null }, activity_open: true, status: "submitted" });
    expect(d.git).toMatchObject({ branch: "main", ahead: 1, last_push: { message: "Contact form" } });
    expect(d.git?.updated_at).toBeTruthy();
    expect(d.can).toEqual({ edit: true, save: false, report_git: true, read_all_revisions: true });

    const one = normalizeProjectDetail(makeProjectDetails(1));
    expect(one.presence[0]).toMatchObject({ user: { name: "John Doe" }, device_name: "MacBook", online: true });
    expect(one.presence_summary.online).toBe(true);
    expect(one.events[0]).toMatchObject({ type: "opened", user: { id: 201, name: "John Doe" } });
  });

  it("normalises missing fields to safe defaults", () => {
    const p = normalizeProject({ id: "7", name: "", kind: "weird", owner: { first_name: "Ada", last_name: "L" } });
    expect(p).toMatchObject({ id: 7, name: "Untitled project", kind: "tm", visibility: "private", my_role: null, head: null, presence: [] });
    expect(p.owner.name).toBe("Ada L");
    expect(p.presence_summary.online).toBe(false);
    expect(normalizeProjectDetail({ project: { id: 1, my_role: "teacher" } }).can.edit).toBe(false);
    expect(normalizeRevision(makeRevisions()[1])?.author?.name).toBe("John Doe");
    expect(normalizeEvent({ id: 1, type: "saved", data: "{\"number\":2}" }).data).toEqual({ number: 2 });
  });

  it("judges presence: server `online:false` wins, `open` defaults to true, stale rows are closed", () => {
    const now = Date.now();
    const recent = new Date(now - 10_000).toISOString();
    expect(isPresenceLive(normalizePresence({ project_id: 1, user_id: 1, device_id: "d", state: {}, last_seen_at: recent }), now)).toBe(true);
    expect(isPresenceLive(normalizePresence({ project_id: 1, user_id: 1, device_id: "d", state: {}, last_seen_at: recent, online: false }), now)).toBe(false);
    expect(isPresenceLive(normalizePresence({ project_id: 1, user_id: 1, device_id: "d", state: { open: false }, last_seen_at: recent }), now)).toBe(false);
    expect(isPresenceLive(normalizePresence({ project_id: 1, user_id: 1, device_id: "d", state: {}, last_seen_at: new Date(now - 120_000).toISOString() }), now)).toBe(false);
  });

  it("reads linkable activities ({ activities: [{type, id, course_id, course_name}] })", () => {
    const items = normalizeLinkable(makeLinkable());
    expect(items.map((a) => `${a.activity_type}:${a.activity_id}`)).toEqual(["assignment:77", "assignment:79", "quiz:31", "manual_assessment:41"]);
    expect(items[0]).toMatchObject({ title: "Sorting lab", course: { id: 11, title: "Computer Science S5" }, submission_type: "project" });
    // Older grouped shape still works.
    expect(normalizeLinkable({ quizzes: [{ id: 5, title: "Q" }] })[0]).toMatchObject({ activity_type: "quiz", activity_id: 5 });
  });

  it("reads the teacher view with frozen revisions", () => {
    const rows = normalizeActivityProjects(makeActivityProjects());
    expect(rows[0]).toMatchObject({ link: { status: "submitted", revision_id: 9003 }, project: { id: 1 }, owner: { name: "John Doe" }, revision: { number: 3 } });
    expect(rows[1]).toMatchObject({ project: { kind: "github", repo_url: "https://github.com/johndoe/portfolio" }, revision: null });
  });

  it("reads monitor entries: {project{owner}, course_ids, presence}", () => {
    const e = normalizeMonitorEntry(makeMonitorHello().online[2]);
    expect(e).toMatchObject({
      project_id: 2,
      user_id: 202,
      user: { name: "Grace Uwase" },
      project: { name: "Portfolio site", owner: { name: "Grace Uwase" } },
      courses: [{ id: 12, title: null }],
      state: { branch: "main", open: true },
      online: true,
    });
    expect(courseLabel(e.courses[0])).toBe("Course #12");
    expect(courseLabel(e.courses[0], new Map([[12, "WEB — Web Development"]]))).toBe("WEB — Web Development");
  });

  it("calls the link, submit, unlink and member endpoints", async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { link: { id: 5, project_id: 1, activity_type: "quiz", activity_id: 31, activity: { title: "Q", course_id: 11, open: true, due_date: null }, status: "linked" } } });
    const link = await projectsApi.link(1, "quiz", 31);
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/1/links", { activity_type: "quiz", activity_id: 31 });
    expect(link).toMatchObject({ id: 5, status: "linked", activity_title: "Q" });

    axiosMock.post.mockResolvedValueOnce({ data: { link: { id: 5, status: "submitted", revision_id: 9003, revision_number: 3 }, submission: { id: 70, status: "submitted", is_late: false } } });
    const submitted = await projectsApi.submit(1, 5);
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/1/links/5/submit");
    expect(submitted).toMatchObject({ status: "submitted", revision_number: 3 });

    axiosMock.delete.mockResolvedValue({ data: { ok: true } });
    await projectsApi.unlink(1, 5);
    expect(axiosMock.delete).toHaveBeenLastCalledWith("/tmcode/projects/1/links/5");

    axiosMock.post.mockResolvedValueOnce({ data: { member: { user_id: 9, name: "Kim", avatar_url: null, role: "collaborator", github_username: "kim", status: "active" } } });
    const m = await projectsApi.addMember(2, { email: "kim@x", github_username: "kim", role: "collaborator" });
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/2/members", { email: "kim@x", github_username: "kim", role: "collaborator" });
    expect(m).toMatchObject({ user_id: 9, user: { name: "Kim" }, status: "active" });
  });

  it("creates and updates through { project: ProjectDetails }", async () => {
    axiosMock.post.mockResolvedValueOnce({ data: makeProjectDetails(1) });
    expect(await projectsApi.create({ name: "x", kind: "tm" })).toMatchObject({ id: 1, can: { edit: true } });
    axiosMock.patch.mockResolvedValueOnce({ data: makeProjectDetails(2) });
    expect((await projectsApi.update(2, { archived: true })).name).toBe("Portfolio site");
    expect(axiosMock.patch).toHaveBeenCalledWith("/tmcode/projects/2", { archived: true });
  });

  it("fetches file content by encoded path at a revision (head by default), flagging binaries", async () => {
    axiosMock.get.mockResolvedValue({ data: "int main() {}", headers: { "content-type": "text/plain; charset=utf-8" } });
    expect(await projectsApi.fileContent(1, "src/my file.cpp", 9003)).toEqual({ text: "int main() {}", binary: false });
    expect(axiosMock.get.mock.calls[0][0]).toBe("/tmcode/projects/1/files/src/my%20file.cpp");
    expect(axiosMock.get.mock.calls[0][1].params).toEqual({ rev: 9003 });

    await projectsApi.fileContent(1, "a.py");
    expect(axiosMock.get.mock.calls[1][1].params).toEqual({ rev: "head" });

    axiosMock.get.mockResolvedValue({ data: "\u0089PNG", headers: { "content-type": "application/octet-stream" } });
    expect(await projectsApi.fileContent(1, "logo.png")).toEqual({ text: "", binary: true });
  });

  it("reads revisions, the manifest and the open link", async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { head_revision_id: 9003, revisions: makeRevisions() } });
    expect((await projectsApi.revisions(1)).map((r) => r.number)).toEqual([3, 2, 1]);
    axiosMock.get.mockResolvedValueOnce({ data: { revision: makeRevisions()[0], files: [{ path: "a.cpp", sha256: "x", size: 12 }] } });
    const m = await projectsApi.manifest(1, "head");
    expect(axiosMock.get).toHaveBeenLastCalledWith("/tmcode/projects/1/revisions/head/manifest");
    expect(m.files).toEqual([{ path: "a.cpp", sha256: "x", size: 12 }]);

    axiosMock.get.mockResolvedValueOnce({ data: { deeplink: "tmcode://project?id=1&api=x" } });
    expect(await projectsApi.openLink(1)).toBe("tmcode://project?id=1&api=x");
    axiosMock.get.mockResolvedValueOnce({ data: {} });
    await expect(projectsApi.openLink(1)).rejects.toThrow();
  });

  it("builds SSE URLs on the API origin", () => {
    expect(projectsLiveUrl(4)).toBe("http://api.test/api/tmcode/projects/4/live");
    expect(monitorLiveUrl()).toBe("http://api.test/api/tmcode/monitor/live");
  });

  it("knows which assignment submission types accept a project", () => {
    expect(assignmentAllowsProject("project")).toBe(true);
    expect(assignmentAllowsProject("file,project")).toBe(true);
    expect(assignmentAllowsProject("any")).toBe(true);
    expect(assignmentAllowsProject("both")).toBe(false);
    expect(assignmentAllowsProject(undefined)).toBe(false);
  });
});
