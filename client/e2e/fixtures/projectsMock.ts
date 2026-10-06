import type { Page, Route } from "@playwright/test";
import { CORS_HEADERS } from "../helpers/auth";
import {
  COURSES,
  FILE_CONTENT,
  MANIFESTS,
  makeActivityProjects,
  makeLinkable,
  makeMonitorHello,
  makeProjectDetails,
  makeProjectList,
  makeRevisions,
} from "../../src/tests/fixtures/projects";

/**
 * Dev mock of the TMCode Projects API for Playwright, in the server's shapes
 * (server/src/tmcode/PROJECTS_API.md): a small in-memory server behind
 * page.route("**\/api/tmcode/**"), plus a scriptable EventSource so the SSE
 * live views can be driven from the test (window.__sse.emit / drop / count).
 * Used only by e2e; the app itself never ships a mock.
 */

type Json = Record<string, unknown>;

export interface ProjectsMockState {
  /** ProjectDetails by id (the list rows are derived from them). */
  details: Map<number, Json>;
  calls: { method: string; path: string; body: unknown }[];
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS_HEADERS, body: JSON.stringify(body) });

const err = (route: Route, status: number, error_code: string, message: string) => json(route, status, { error_code, message });

export async function installProjectsMock(page: Page): Promise<ProjectsMockState> {
  const now = Date.now();
  const state: ProjectsMockState = { details: new Map(), calls: [] };
  for (const row of makeProjectList(now).projects) state.details.set(row.id, makeProjectDetails(row.id, now).project as unknown as Json);
  const revisions = makeRevisions(now);
  let nextId = 1000;

  const listRow = (d: Json) => {
    const links = (d.links as Json[]) ?? [];
    return {
      ...d,
      presence: d.presence_summary,
      links: {
        total: links.length,
        submitted: links.filter((l) => l.status === "submitted").length,
        items: links.map((l) => ({ id: l.id, activity_type: l.activity_type, activity_id: l.activity_id, status: l.status })),
      },
      members: undefined,
      events: undefined,
      can: undefined,
      presence_summary: undefined,
    };
  };

  await page.route("**/api/tmcode/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^.*\/api\/tmcode/, "");
    const method = req.method();
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS_HEADERS });
    state.calls.push({ method, path, body });

    if (method === "GET" && path === "/projects") {
      const scope = url.searchParams.get("scope") ?? "mine";
      const rows = scope === "shared" ? [] : [...state.details.values()].map(listRow);
      const live = rows.filter((r) => (r.presence as Json)?.online).length;
      return json(route, 200, {
        projects: rows,
        stats: { total: rows.length, online: live, active_this_week: Math.min(rows.length, 2), revisions: 4, submissions: rows.reduce((n, r) => n + Number((r.links as Json).submitted), 0) },
      });
    }
    if (method === "POST" && path === "/projects") {
      const b = body as Json;
      const id = ++nextId;
      const d = {
        ...(makeProjectDetails(1, now).project as unknown as Json),
        id,
        name: b.name,
        slug: String(b.name).toLowerCase().replace(/\W+/g, "-"),
        description: b.description ?? null,
        language: b.language ?? null,
        kind: b.kind,
        repo_url: b.repo_url ?? null,
        repo_full_name: b.repo_url ? String(b.repo_url).replace("https://github.com/", "") : null,
        visibility: b.visibility ?? "private",
        head: null,
        head_revision_id: null,
        size_bytes: 0,
        file_count: 0,
        git: null,
        presence: [],
        presence_summary: { online: false, devices_online: 0, last_seen_at: null, file: null, dirty: 0 },
        links: [],
        members: [],
        events: [{ id: 1, project_id: id, user_id: 201, user_name: "John Doe", type: "created", data: {}, created_at: new Date().toISOString() }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };
      state.details.set(id, d);
      return json(route, 201, { project: d });
    }
    if (method === "GET" && path === "/activities/linkable") return json(route, 200, makeLinkable(now));
    let m = path.match(/^\/activities\/(\w+)\/(\d+)\/projects$/);
    if (m && method === "GET") return json(route, 200, m[1] === "assignment" ? makeActivityProjects(now) : { activity: null, projects: [] });

    m = path.match(/^\/projects\/(\d+)(\/.*)?$/);
    if (!m) return err(route, 404, "NOT_FOUND", "Not found");
    const id = Number(m[1]);
    const rest = m[2] ?? "";
    const d = state.details.get(id);
    if (!d) return err(route, 404, "PROJECT_NOT_FOUND", "Project not found");
    const links = d.links as Json[];

    if (rest === "" && method === "GET") return json(route, 200, { project: d });
    if (rest === "" && method === "PATCH") {
      const b = body as Json;
      if (b.name) d.name = b.name;
      if (b.description !== undefined) d.description = b.description;
      if (b.visibility) d.visibility = b.visibility;
      if (b.archived !== undefined) d.archived_at = b.archived ? new Date().toISOString() : null;
      return json(route, 200, { project: d });
    }
    if (rest === "" && method === "DELETE") {
      if (links.some((l) => l.status === "submitted")) return err(route, 409, "PROJECT_SUBMITTED", "A submitted project can't be deleted. Archive it instead.");
      state.details.delete(id);
      return json(route, 200, { ok: true });
    }
    if (rest === "/open-link") return json(route, 200, { deeplink: `tmcode://project?id=${id}&api=${encodeURIComponent("http://localhost:5002")}` });
    if (rest.startsWith("/revisions") && method === "GET") {
      const mm = rest.match(/^\/revisions\/(\w+)\/manifest$/);
      if (mm) {
        const revId = mm[1] === "head" ? (d.head_revision_id as number) : Number(mm[1]);
        return json(route, 200, { revision: revisions.find((r) => r.id === revId) ?? null, files: MANIFESTS[revId] ?? [] });
      }
      return json(route, 200, { head_revision_id: d.head_revision_id ?? null, revisions: id === 1 ? revisions : [] });
    }
    if (rest.startsWith("/files/")) {
      const file = decodeURIComponent(rest.slice("/files/".length));
      const text = FILE_CONTENT[file];
      return text === undefined
        ? err(route, 404, "FILE_NOT_FOUND", "No such file")
        : route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: text, headers: { ...CORS_HEADERS, "X-Revision-Id": url.searchParams.get("rev") ?? "head" } });
    }
    if (rest === "/links" && method === "POST") {
      const b = body as Json;
      const act = makeLinkable(now).activities.find((a) => a.type === b.activity_type && a.id === b.activity_id);
      if (!act) return err(route, 403, "ACTIVITY_NOT_IN_SCOPE", "That activity isn't in your courses.");
      const link = {
        id: ++nextId, project_id: id, activity_type: b.activity_type, activity_id: b.activity_id,
        activity: { title: act.title, course_id: act.course_id, open: true, due_date: act.due_date },
        status: "linked", revision_id: null, revision_number: null, git_commit: null, submitted_at: null, linked_by: 201, created_at: new Date().toISOString(),
      };
      links.push(link);
      return json(route, 201, { link });
    }
    let lm = rest.match(/^\/links\/(\d+)\/submit$/);
    if (lm && method === "POST") {
      const link = links.find((l) => l.id === Number(lm![1]));
      if (!link) return err(route, 404, "LINK_NOT_FOUND", "Link not found");
      const head = d.head as Json | null;
      Object.assign(link, {
        status: "submitted",
        submitted_at: new Date().toISOString(),
        ...(d.kind === "tm" ? { revision_id: head?.id, revision_number: head?.number } : { git_commit: (d.git as Json)?.head_commit }),
      });
      return json(route, 200, { link, submission: link.activity_type === "assignment" ? { id: 70, status: "submitted", is_late: false } : null });
    }
    lm = rest.match(/^\/links\/(\d+)$/);
    if (lm && method === "DELETE") {
      const i = links.findIndex((l) => l.id === Number(lm![1]));
      if (i >= 0 && links[i].status === "submitted") return err(route, 409, "LINK_SUBMITTED", "A submitted link can't be removed.");
      if (i >= 0) links.splice(i, 1);
      return json(route, 200, { ok: true });
    }
    if (rest === "/members" && method === "POST") {
      const b = body as Json;
      const member = {
        user_id: ++nextId,
        name: String(b.email ?? "Member").split("@")[0].split(".").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
        avatar_url: null,
        role: b.role ?? "collaborator",
        github_username: b.github_username ?? null,
        status: "active",
        invited_by: 201,
        created_at: new Date().toISOString(),
      };
      (d.members as Json[]).push(member);
      return json(route, 201, { member });
    }
    const mem = rest.match(/^\/members\/(\d+)$/);
    if (mem && method === "DELETE") {
      d.members = (d.members as Json[]).filter((x) => x.user_id !== Number(mem[1]));
      return json(route, 200, { ok: true });
    }
    return err(route, 404, "NOT_FOUND", `Unmocked ${method} ${path}`);
  });

  return state;
}

/** GET /api/courses, so the monitor can name course ids. */
export async function mockCourses(page: Page) {
  await page.route("**/api/courses", (route) =>
    json(route, 200, { success: true, count: 2, data: Object.values(COURSES) }),
  );
}

/**
 * Replaces window.EventSource with a scriptable fake. Streams open on their
 * own after ~50 ms and replay any `seed` events whose URL contains the key.
 * From the test: window.__sse.emit(urlPart, event, data), .drop(urlPart)
 * (server closed the stream), .count(urlPart).
 */
export async function installFakeEventSource(page: Page, seed: Record<string, { event: string; data: unknown }[]> = {}) {
  await page.addInitScript((seedArg) => {
    type L = (e: MessageEvent) => void;
    class FakeES {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;
      url: string;
      withCredentials: boolean;
      readyState = 0;
      onopen: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      onmessage: L | null = null;
      private ls = new Map<string, L[]>();
      constructor(url: string, init?: { withCredentials?: boolean }) {
        this.url = url;
        this.withCredentials = !!init?.withCredentials;
        registry.push(this);
        setTimeout(() => {
          if (this.readyState === 2) return;
          this.readyState = 1;
          this.onopen?.(new Event("open"));
          for (const [part, evs] of Object.entries(seedArg)) {
            if (this.url.includes(part)) evs.forEach((e) => this.dispatch(e.event, e.data));
          }
        }, 50);
      }
      addEventListener(name: string, fn: L) {
        this.ls.set(name, [...(this.ls.get(name) ?? []), fn]);
      }
      removeEventListener() {}
      close() {
        this.readyState = 2;
      }
      dispatch(name: string, data: unknown) {
        if (this.readyState !== 1) return;
        const ev = new MessageEvent(name, { data: JSON.stringify(data) });
        if (name === "message") this.onmessage?.(ev);
        else this.ls.get(name)?.forEach((fn) => fn(ev));
      }
    }
    const registry: FakeES[] = [];
    const live = (part: string) => registry.filter((e) => e.url.includes(part) && e.readyState !== 2);
    (window as unknown as { EventSource: unknown }).EventSource = FakeES;
    (window as unknown as { __sse: unknown }).__sse = {
      emit: (part: string, event: string, data: unknown) => live(part).forEach((e) => e.dispatch(event, data)),
      drop: (part: string) =>
        live(part).forEach((e) => {
          e.readyState = 2;
          e.onerror?.(new Event("error"));
        }),
      count: (part: string) => registry.filter((e) => e.url.includes(part)).length,
    };
  }, seed);
}

export const monitorSeed = () => ({ "/monitor/live": [{ event: "hello", data: makeMonitorHello() }] });
