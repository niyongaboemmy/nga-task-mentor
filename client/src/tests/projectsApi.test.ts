import { describe, it, expect, vi, beforeEach } from "vitest";

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock, API_BASE_URL: "http://api.test/api" }));

import {
  assignmentAllowsProject,
  computeStats,
  isPresenceLive,
  monitorLiveUrl,
  normalizeActivityProjects,
  normalizeLinkable,
  normalizeMonitorEntry,
  normalizeProject,
  normalizeProjectList,
  projectsApi,
  projectsLiveUrl,
  unwrap,
} from "../services/projectsApi";
import { makeActivityProjects, makeLinkable, makeMonitorSnapshot, makeProjects } from "./fixtures/projects";

describe("projectsApi (TMCode Projects §3 contract)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unwraps the { success, data } envelope and passes bare payloads through", () => {
    expect(unwrap({ success: true, data: [1, 2] })).toEqual([1, 2]);
    expect(unwrap({ data: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrap({ projects: [] })).toEqual({ projects: [] });
  });

  it("lists projects by scope and computes the stats strip when the server sends none", async () => {
    const now = Date.now();
    axiosMock.get.mockResolvedValue({ data: { success: true, data: { projects: makeProjects(now) } } });
    const list = await projectsApi.list("shared");
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/projects", { params: { scope: "shared" } });
    expect(list.projects).toHaveLength(3);
    expect(list.projects[0]).toMatchObject({ id: 1, kind: "tm", my_role: "owner", head: { number: 3 } });
    expect(list.stats).toEqual({ total: 3, active_this_week: 2, revisions: 4, submissions: 1, live_now: 1 });
  });

  it("prefers the server's stats and accepts a bare array", () => {
    const projects = makeProjects();
    expect(normalizeProjectList({ projects, stats: { revisions: 99 } }).stats.revisions).toBe(99);
    expect(normalizeProjectList(projects).projects.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("normalises missing fields to safe defaults", () => {
    const p = normalizeProject({ id: "7", name: "", kind: "weird", owner: { first_name: "Ada", last_name: "L" } });
    expect(p).toMatchObject({ id: 7, name: "Untitled project", kind: "tm", visibility: "private", my_role: null, head: null, presence: [] });
    expect(p.owner.name).toBe("Ada L");
    expect(p.links).toEqual({ total: 0, submitted: 0, items: [] });
  });

  it("treats presence older than the heartbeat window as closed", () => {
    const now = Date.now();
    const base = { project_id: 1, user_id: 1, device_id: "d", state: { open: true } };
    expect(isPresenceLive({ ...base, last_seen_at: new Date(now - 10_000).toISOString() }, now)).toBe(true);
    expect(isPresenceLive({ ...base, last_seen_at: new Date(now - 120_000).toISOString() }, now)).toBe(false);
    expect(isPresenceLive({ ...base, state: { open: false }, last_seen_at: new Date(now).toISOString() }, now)).toBe(false);
    expect(computeStats([]).live_now).toBe(0);
  });

  it("flattens grouped linkable activities", () => {
    const items = normalizeLinkable({ success: true, data: makeLinkable() });
    expect(items.map((a) => `${a.activity_type}:${a.activity_id}`)).toEqual([
      "quiz:31",
      "assignment:77",
      "assignment:79",
      "manual_assessment:41",
    ]);
    expect(items[3].due_date).toBeTruthy();
    expect(normalizeLinkable([{ activity_type: "quiz", activity_id: 5, title: "Q" }])[0]).toMatchObject({ activity_id: 5 });
  });

  it("reads the teacher view in both nested and flat shapes", () => {
    const nested = normalizeActivityProjects({ projects: makeActivityProjects() });
    expect(nested[0]).toMatchObject({ link: { status: "submitted", revision_id: 9003 }, project: { id: 1 }, owner: { name: "John Doe" } });
    const flat = normalizeActivityProjects([
      { id: 9, project_id: 4, activity_type: "quiz", activity_id: 3, status: "linked", project: { id: 4, name: "X", owner: { id: 8, name: "Kim" } } },
    ]);
    expect(flat[0]).toMatchObject({ link: { id: 9, project_id: 4 }, project: { name: "X" }, owner: { name: "Kim" } });
  });

  it("reads monitor rows with their courses", () => {
    const e = normalizeMonitorEntry(makeMonitorSnapshot().items[2]);
    expect(e).toMatchObject({ project_id: 2, project: { name: "Portfolio site" }, courses: [{ code: "WEB" }], state: { branch: "main", open: true } });
    expect(normalizeMonitorEntry({ project_id: 3, user_id: 1, course: { id: 1, title: "A" }, state: "{\"open\":true}" }).state.open).toBe(true);
  });

  it("calls the link, submit, unlink and member endpoints", async () => {
    axiosMock.post.mockResolvedValueOnce({ data: { link: { id: 5, project_id: 1, activity_type: "quiz", activity_id: 31, status: "linked" } } });
    const link = await projectsApi.link(1, "quiz", 31);
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/1/links", { activity_type: "quiz", activity_id: 31 });
    expect(link).toMatchObject({ id: 5, status: "linked" });

    axiosMock.post.mockResolvedValueOnce({ data: { success: true, data: { id: 5, status: "submitted", revision_id: 9003, revision: { number: 3 } } } });
    const submitted = await projectsApi.submit(1, 5);
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/1/links/5/submit");
    expect(submitted).toMatchObject({ status: "submitted", revision_number: 3 });

    axiosMock.delete.mockResolvedValue({ data: {} });
    await projectsApi.unlink(1, 5);
    expect(axiosMock.delete).toHaveBeenLastCalledWith("/tmcode/projects/1/links/5");

    axiosMock.post.mockResolvedValueOnce({ data: { member: { user_id: 9, user: { id: 9, name: "Kim" }, role: "collaborator", github_username: "kim", status: "invited" } } });
    const m = await projectsApi.addMember(2, { email: "kim@x", github_username: "kim", role: "collaborator" });
    expect(axiosMock.post).toHaveBeenLastCalledWith("/tmcode/projects/2/members", { email: "kim@x", github_username: "kim", role: "collaborator" });
    expect(m).toMatchObject({ user_id: 9, status: "invited" });
  });

  it("encodes file paths and passes the revision", async () => {
    axiosMock.get.mockResolvedValue({ data: "int main() {}", headers: { "content-type": "text/plain" } });
    const text = await projectsApi.fileContent(1, "src/my file.cpp", 9003);
    expect(text).toBe("int main() {}");
    expect(axiosMock.get.mock.calls[0][0]).toBe("/tmcode/projects/1/files/src/my%20file.cpp");
    expect(axiosMock.get.mock.calls[0][1].params).toEqual({ rev: 9003 });

    axiosMock.get.mockResolvedValue({ data: JSON.stringify({ content: "x = 1" }), headers: { "content-type": "application/json" } });
    expect(await projectsApi.fileContent(1, "a.py")).toBe("x = 1");
  });

  it("reads the manifest and the open link", async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { revision: { id: 9003, number: 3 }, files: [{ path: "a.cpp", sha256: "x", size: "12" }] } });
    const m = await projectsApi.manifest(1, 9003);
    expect(axiosMock.get).toHaveBeenLastCalledWith("/tmcode/projects/1/revisions/9003/manifest");
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
