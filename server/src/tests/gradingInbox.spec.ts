import { gradingInboxItems } from "../services/gradingInbox.service";
import type { GradingQueueItem } from "../services/instructorOverview.service";

const item = (over: Partial<GradingQueueItem>): GradingQueueItem => ({
  id: 1,
  kind: "assignment" as GradingQueueItem["kind"],
  title: "Lab",
  subject_id: 7,
  subject_code: "CS",
  subject_name: "Programming",
  pending: 3,
  late: 1,
  due_at: "2026-10-10T21:59:00.000Z",
  oldest_at: "2026-10-09T08:00:00.000Z",
  waiting_days: 3,
  url: "/assignments/1",
  ...over,
});

describe("To grade inbox items", () => {
  it("code assignments open Grading; other work keeps its own page", () => {
    const items = gradingInboxItems(
      [item({ id: 1 }), item({ id: 2, url: "/assignments/2" }), item({ id: 9, kind: "quiz" as GradingQueueItem["kind"], url: "/quizzes/9/submissions" })],
      new Set([1]),
      new Set([9]),
    );
    expect(items[0]).toMatchObject({ code: true, grade_url: "/grading/assignment/1", to_grade: 3, late: 1 });
    expect(items[1]).toMatchObject({ code: false, grade_url: "/assignments/2" });
    expect(items[2]).toMatchObject({ code: true, grade_url: "/quizzes/9/submissions", subject: { id: 7, name: "Programming", code: "CS" } });
  });
});
