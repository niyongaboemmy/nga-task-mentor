import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RecordedAssessmentsPanel from "../components/Courses/RecordedAssessmentsPanel";
import {
  buildSubjectReport,
  type SubjectGradesPayload,
} from "../services/subjectReportApi";
import type { RecordedAssessmentsState } from "../components/Courses/useRecordedAssessments";

// The panel is fed by useRecordedAssessments, which the course page owns; these
// tests hand it the state directly so both roles' views can be checked.

const payload: SubjectGradesPayload = {
  course_id: 10,
  // A quiz exists too — it must NOT appear on this tab.
  quizzes: [{ id: 1, title: "Unit quiz", max_score: 20, date: "2026-09-09" }],
  assignments: [],
  assessments: [
    {
      id: 3,
      title: "Midterm",
      max_score: 100,
      assessment_type: "midterm",
      assessment_number: 1,
      assessment_date: "2026-09-18",
      counts_to_final: true,
    },
    {
      id: 4,
      title: "Homework",
      max_score: 20,
      assessment_type: "homework",
      assessment_number: 2,
      assessment_date: "2026-09-22",
      counts_to_final: true,
    },
  ],
  students: [
    {
      student: { id: 1, name: "Ada Byron", email: "ada@nga.ac.rw" },
      quizzes: [{ quiz_id: 1, score: 18, submitted: true, max_score: 20 }],
      assignments: [],
      assessments: [
        { assessment_id: 3, score: 80, recorded: true, max_score: 100 },
        { assessment_id: 4, score: null, recorded: false, max_score: 20 },
      ],
      summary: {
        total_points_earned: 80,
        total_max_points: 100,
        total_percentage: 80,
        assignment_percentage: 0,
        quiz_percentage: 90,
        assessment_percentage: 80,
      },
    },
    {
      student: { id: 2, name: "Grace Hopper", email: "grace@nga.ac.rw" },
      quizzes: [],
      assignments: [],
      assessments: [
        { assessment_id: 3, score: 40, recorded: true, max_score: 100 },
        { assessment_id: 4, score: null, recorded: false, max_score: 20 },
      ],
      summary: {
        total_points_earned: 40,
        total_max_points: 100,
        total_percentage: 40,
        assignment_percentage: 0,
        quiz_percentage: 0,
        assessment_percentage: 40,
      },
    },
  ],
};

const stateFor = (p: SubjectGradesPayload): RecordedAssessmentsState => {
  const report = buildSubjectReport(p);
  return {
    report,
    recorded: report.assessments.filter((a) => a.kind === "manual"),
    loading: false,
    refreshing: false,
    error: null,
    reload: vi.fn(),
  };
};

/** A summary tile, addressed by its label. */
const statCard = (label: string) =>
  screen.getByText(label).closest("div")!.parentElement as HTMLElement;

const renderPanel = (props: Partial<Parameters<typeof RecordedAssessmentsPanel>[0]> = {}) =>
  render(
    <MemoryRouter>
      <RecordedAssessmentsPanel
        canViewAll
        canEdit
        state={stateFor(payload)}
        {...props}
      />
    </MemoryRouter>,
  );

describe("RecordedAssessmentsPanel", () => {
  it("lists only hand-recorded assessments, never quizzes or assignments", () => {
    renderPanel();
    expect(screen.getByText("Midterm 1")).toBeInTheDocument();
    expect(screen.getByText("Homework 2")).toBeInTheDocument();
    expect(screen.queryByText("Unit quiz")).not.toBeInTheDocument();
  });

  it("summarises the class for a teacher", () => {
    renderPanel();
    // Midterm averages (80 + 40) / 2 = 60, and it is the only marked one, so
    // the class-average stat reads 60% too.
    expect(within(statCard("Class average")).getByText("60%")).toBeInTheDocument();
    expect(screen.getAllByText("Not marked").length).toBeGreaterThan(0);
    // 2 assessments × 2 students − 2 marks entered = 2 outstanding.
    expect(within(statCard("Marks outstanding")).getByText("2")).toBeInTheDocument();
  });

  it("opens an assessment to show every student's mark, unmarked first", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Midterm 1/ }));

    expect(screen.getByText("Ada Byron")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit marks/ })).toHaveAttribute(
      "href",
      "/grades/3/marks",
    );
  });

  it("filters the student list inside an open assessment", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Midterm 1/ }));
    fireEvent.change(screen.getByPlaceholderText("Search students"), {
      target: { value: "grace" },
    });
    expect(screen.queryByText("Ada Byron")).not.toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  it("shows a student only their own marks and average", () => {
    const own = { ...payload, students: [payload.students[0]] };
    renderPanel({ canViewAll: false, canEdit: false, state: stateFor(own) });

    expect(screen.getByText("Your average")).toBeInTheDocument();
    expect(within(statCard("Your average")).getByText("80%")).toBeInTheDocument();
    // No class-wide affordances leak into the student view.
    expect(screen.queryByText("Marks outstanding")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /marks/i })).not.toBeInTheDocument();
    expect(screen.getByText("Awaiting marks")).toBeInTheDocument();
  });

  it("explains itself when nothing has been recorded", () => {
    const empty = { ...payload, assessments: [] };
    renderPanel({ state: stateFor(empty) });
    expect(screen.getByText("No recorded assessments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Add an assessment/ })).toBeInTheDocument();
  });

  it("offers a retry when the marks could not be loaded", () => {
    const reload = vi.fn();
    renderPanel({
      state: { ...stateFor(payload), error: "Could not load recorded marks.", reload },
    });
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(reload).toHaveBeenCalled();
  });
});

describe("student view detail", () => {
  it("marks an un-entered assessment as awaiting rather than zero", () => {
    const own = { ...payload, students: [payload.students[0]] };
    render(
      <MemoryRouter>
        <RecordedAssessmentsPanel canViewAll={false} canEdit={false} state={stateFor(own)} />
      </MemoryRouter>,
    );
    const homework = screen.getByText("Homework 2").closest("li")!;
    expect(within(homework).getByText("Not marked")).toBeInTheDocument();
  });
});
