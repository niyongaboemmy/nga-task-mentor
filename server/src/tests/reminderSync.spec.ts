/**
 * Task Mentor -> MIS Reminder Hub push (services/reminderSync.ts).
 * No DB: the builders take plain objects and the model lookups are mocked;
 * the HTTP layer is swapped with setReminderTransport.
 */
jest.mock("../models", () => ({
  Quiz: { findByPk: jest.fn(), findAll: jest.fn() },
  Assignment: { findByPk: jest.fn(), findAll: jest.fn() },
}));

import { Assignment, Quiz } from "../models";
import {
  buildAssignmentPlan,
  buildQuizPlan,
  cancelAssignment,
  cancelQuiz,
  reminderSyncDisabledReason,
  ReminderRequest,
  sendItems,
  setReminderTransport,
  sweepReminders,
  syncAssignment,
  syncQuiz,
} from "../services/reminderSync";

const NOW = new Date("2026-09-30T08:00:00Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * 3600000);
const BASE = "https://taskmentor.amashuri.com";

const quizFind = Quiz.findByPk as jest.Mock;
const quizAll = Quiz.findAll as jest.Mock;
const asgFind = Assignment.findByPk as jest.Mock;
const asgAll = Assignment.findAll as jest.Mock;

let calls: ReminderRequest[];
const okBatch = (req: ReminderRequest) => ({
  status: 200,
  body: {
    success: true,
    data: { results: ((req.body as any)?.items ?? []).map((i: any) => ({ external_id: i.external_id, ok: true })) },
  },
});

const savedEnv = { ...process.env };
beforeEach(() => {
  calls = [];
  process.env.NGA_MIS_BASE_URL = "https://api.amashuri.com/";
  process.env.SSO_CLIENT_ID = "taskmentor_app";
  process.env.SSO_CLIENT_SECRET = "s3cret";
  process.env.FRONTEND_URL = `${BASE}/`;
  delete process.env.REMINDERS_SYNC;
  setReminderTransport(async (req) => {
    calls.push(req);
    return req.method === "PUT" ? okBatch(req) : { status: 204, body: null };
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  setReminderTransport(null);
  process.env = { ...savedEnv };
  jest.restoreAllMocks();
});

describe("buildQuizPlan", () => {
  const quiz = { id: 812, title: "Algebra", status: "published", start_date: at(2), end_date: at(26), course_id: 14 };

  it("sends open + close with UTC instants, flags, subject audience and take link", () => {
    const plan = buildQuizPlan(quiz, NOW, BASE);
    expect(plan.cancel).toEqual([]);
    expect(plan.send).toEqual([
      {
        source_app: "taskmentor",
        source_type: "quiz_open",
        external_id: "quiz-812-open",
        title: "Algebra",
        starts_at: "2026-09-30T10:00:00.000Z",
        ends_at: null,
        link: `${BASE}/quizzes/812/take`,
        location: null,
        critical: false,
        audience_subject_id: 14,
      },
      expect.objectContaining({
        source_type: "quiz_close",
        external_id: "quiz-812-close",
        starts_at: "2026-10-01T10:00:00.000Z",
        critical: true,
        audience_subject_id: 14,
      }),
    ]);
    expect(plan.send[1]).not.toHaveProperty("audience_user_ids");
  });

  it("accepts date strings (raw rows) and normalises them to UTC ISO", () => {
    const plan = buildQuizPlan({ ...quiz, start_date: "2026-10-02T09:30:00+02:00", end_date: null }, NOW, BASE);
    expect(plan.send.map((i) => i.starts_at)).toEqual(["2026-10-02T07:30:00.000Z"]);
  });

  it("no start date -> only quiz_close (and cancels a stale open)", () => {
    const plan = buildQuizPlan({ ...quiz, start_date: null }, NOW, BASE);
    expect(plan.send.map((i) => i.external_id)).toEqual(["quiz-812-close"]);
    expect(plan.cancel).toEqual([{ source_type: "quiz_open", external_id: "quiz-812-open" }]);
  });

  it("no end date -> only quiz_open", () => {
    const plan = buildQuizPlan({ ...quiz, end_date: undefined }, NOW, BASE);
    expect(plan.send.map((i) => i.source_type)).toEqual(["quiz_open"]);
    expect(plan.cancel.map((r) => r.source_type)).toEqual(["quiz_close"]);
  });

  it("skips past times without cancelling them", () => {
    const plan = buildQuizPlan({ ...quiz, start_date: at(-3) }, NOW, BASE);
    expect(plan.send.map((i) => i.source_type)).toEqual(["quiz_close"]);
    expect(plan.cancel).toEqual([]);
  });

  it.each(["draft", "completed"])("%s quiz -> cancel both, send nothing", (status) => {
    const plan = buildQuizPlan({ ...quiz, status }, NOW, BASE);
    expect(plan.send).toEqual([]);
    expect(plan.cancel.map((r) => r.external_id)).toEqual(["quiz-812-open", "quiz-812-close"]);
  });

  it("no subject (course_id) -> no audience -> cancel", () => {
    const plan = buildQuizPlan({ ...quiz, course_id: null }, NOW, BASE);
    expect(plan.send).toEqual([]);
    expect(plan.cancel).toHaveLength(2);
  });
});

describe("buildAssignmentPlan", () => {
  const a = { id: 55, title: "Essay", status: "published", due_date: at(48), course_id: 7 };

  it("sends a critical assignment_due linking to the assignment page", () => {
    const plan = buildAssignmentPlan(a, NOW, BASE);
    expect(plan.send).toEqual([
      expect.objectContaining({
        source_type: "assignment_due",
        external_id: "assignment-55-due",
        starts_at: "2026-10-02T08:00:00.000Z",
        critical: true,
        link: `${BASE}/assignments/55`,
        audience_subject_id: 7,
      }),
    ]);
  });

  it.each(["draft", "completed", "removed"])("%s -> cancel", (status) => {
    const plan = buildAssignmentPlan({ ...a, status }, NOW, BASE);
    expect(plan.send).toEqual([]);
    expect(plan.cancel).toEqual([{ source_type: "assignment_due", external_id: "assignment-55-due" }]);
  });

  it("past due -> nothing at all", () => {
    expect(buildAssignmentPlan({ ...a, due_date: at(-1) }, NOW, BASE)).toEqual({ send: [], cancel: [] });
  });
});

describe("transport + entry points", () => {
  it("PUTs the batch endpoint with the SSO client's Basic auth", async () => {
    const plan = buildAssignmentPlan({ id: 1, title: "X", status: "published", due_date: at(5), course_id: 3 }, NOW, BASE);
    await sendItems(plan.send);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe("https://api.amashuri.com/reminders/sources/batch");
    expect(calls[0].headers.Authorization).toBe(
      `Basic ${Buffer.from("taskmentor_app:s3cret").toString("base64")}`,
    );
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect((calls[0].body as any).items).toHaveLength(1);
  });

  it("chunks batches at 200 items", async () => {
    const items = Array.from({ length: 450 }, (_, i) =>
      buildAssignmentPlan({ id: i + 1, title: `A${i}`, status: "published", due_date: at(5), course_id: 3 }, NOW, BASE).send[0],
    );
    const accepted = await sendItems(items);
    expect(calls.map((c) => (c.body as any).items.length)).toEqual([200, 200, 50]);
    expect(accepted).toBe(450);
  });

  it("syncQuiz loads the row and sends its items", async () => {
    quizFind.mockResolvedValue({ id: 9, title: "Q", status: "published", start_date: at(1e4), end_date: at(2e4), course_id: 4 });
    await syncQuiz(9);
    expect(quizFind).toHaveBeenCalledWith(9, expect.objectContaining({ raw: true }));
    expect((calls[0].body as any).items.map((i: any) => i.external_id)).toEqual(["quiz-9-open", "quiz-9-close"]);
  });

  it("unpublishing (draft) cancels via DELETE; a 404 is ignored quietly", async () => {
    setReminderTransport(async (req) => {
      calls.push(req);
      return { status: 404, body: { success: false } };
    });
    quizFind.mockResolvedValue({ id: 9, title: "Q", status: "draft", start_date: at(5), end_date: at(9), course_id: 4 });
    await syncQuiz(9);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "DELETE https://api.amashuri.com/reminders/sources/taskmentor/quiz_open/quiz-9-open",
      "DELETE https://api.amashuri.com/reminders/sources/taskmentor/quiz_close/quiz-9-close",
    ]);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("a deleted row (findByPk null) cancels", async () => {
    asgFind.mockResolvedValue(null);
    await syncAssignment(55);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.amashuri.com/reminders/sources/taskmentor/assignment_due/assignment-55-due",
    ]);
  });

  it("cancelQuiz / cancelAssignment DELETE every side", async () => {
    await cancelQuiz(3);
    await cancelAssignment(4);
    expect(calls.map((c) => c.method)).toEqual(["DELETE", "DELETE", "DELETE"]);
    expect(calls[2].url).toMatch(/assignment_due\/assignment-4-due$/);
  });

  it("never throws when MIS is down, just warns", async () => {
    setReminderTransport(async () => {
      throw new Error("ECONNREFUSED");
    });
    quizFind.mockResolvedValue({ id: 9, title: "Q", status: "published", start_date: at(1e4), end_date: null, course_id: 4 });
    await expect(syncQuiz(9)).resolves.toBeUndefined();
    await expect(cancelAssignment(1)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it("logs per-item rejections from the batch result", async () => {
    setReminderTransport(async (req) => {
      calls.push(req);
      return { status: 200, body: { success: true, data: { results: [{ external_id: "assignment-1-due", ok: false, error: "bad" }] } } };
    });
    const plan = buildAssignmentPlan({ id: 1, title: "X", status: "published", due_date: at(5), course_id: 3 }, NOW, BASE);
    expect(await sendItems(plan.send)).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("assignment-1-due rejected: bad"));
  });

  it("sweep: queries the 14-day window and sends upserts only", async () => {
    quizAll.mockResolvedValue([
      { id: 1, title: "Q1", status: "published", start_date: at(-1), end_date: at(24), course_id: 2 },
    ]);
    asgAll.mockResolvedValue([{ id: 2, title: "A2", status: "published", due_date: at(30), course_id: 2 }]);
    const sent = await sweepReminders(NOW);
    expect(sent).toBe(2);
    expect(calls).toHaveLength(1);
    expect((calls[0].body as any).items.map((i: any) => i.external_id)).toEqual(["quiz-1-close", "assignment-2-due"]);
    expect(quizAll.mock.calls[0][0].where.status).toBe("published");
  });
});

describe("disabled", () => {
  it("REMINDERS_SYNC=false turns everything off", async () => {
    process.env.REMINDERS_SYNC = "false";
    expect(reminderSyncDisabledReason()).toBe("REMINDERS_SYNC=false");
    await cancelQuiz(1);
    expect(await sweepReminders(NOW)).toBe(0);
    expect(calls).toEqual([]);
  });

  it("missing credentials -> off", () => {
    delete process.env.SSO_CLIENT_SECRET;
    expect(reminderSyncDisabledReason()).toMatch(/SSO_CLIENT/);
  });

  it("NODE_ENV=test without an injected transport -> off", () => {
    setReminderTransport(null);
    expect(process.env.NODE_ENV).toBe("test");
    expect(reminderSyncDisabledReason()).toBe("NODE_ENV=test");
  });
});
