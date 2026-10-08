// Learning outcomes on a quiz/assignment: hidden for non-graders, shows tags
// grouped by outcome, picker toggles whole outcomes and saves criteria ids.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const task = vi.fn();
const save = vi.fn();
const curriculum = vi.fn();
vi.mock("../services/competencyApi", () => ({
  competencyApi: {
    task: (...a: unknown[]) => task(...a),
    save: (...a: unknown[]) => save(...a),
    curriculum: (...a: unknown[]) => curriculum(...a),
  },
}));

import { LearningOutcomesPanel } from "../components/competency/LearningOutcomesPanel";

const OUTCOMES = [
  { competency_id: 71, element_number: 1, title: "Apply networking basics", criteria: [
    { criteria_id: 701, criteria_number: "1.1", description: "Identify network types" },
    { criteria_id: 702, criteria_number: "1.2", description: "Draw a topology" },
  ] },
  { competency_id: 72, element_number: 2, title: "Configure a router", criteria: [{ criteria_id: 703, criteria_number: "2.1", description: "Set interface addresses" }] },
];
const tag = (id: number, num: string, competency_id: number, n: number, title: string) => ({ criteria_id: id, criteria_number: num, competency_id, element_number: n, outcome_title: title, description: "" });

beforeEach(() => {
  task.mockReset();
  save.mockReset();
  curriculum.mockReset();
});

describe("LearningOutcomesPanel", () => {
  it("stays hidden for people who can't grade the task", async () => {
    task.mockImplementation(() => Promise.reject({ response: { status: 403 } }));
    const { container } = render(<LearningOutcomesPanel taskType="quiz" taskId={5} />);
    await waitFor(() => expect(task).toHaveBeenCalledWith("quiz", 5));
    expect(container.innerHTML).toBe("");
  });

  it("invites tagging, then saves a whole outcome plus one criterion", async () => {
    task.mockResolvedValue({ subject_id: 3, criteria: [], can_edit: true });
    curriculum.mockResolvedValue(OUTCOMES);
    save.mockResolvedValue({ subject_id: 3, can_edit: true, criteria: [tag(701, "1.1", 71, 1, "Apply networking basics"), tag(702, "1.2", 71, 1, "Apply networking basics"), tag(703, "2.1", 72, 2, "Configure a router")] });
    render(<LearningOutcomesPanel taskType="assignment" taskId={9} />);
    expect(await screen.findByText(/Not linked to the curriculum yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const picker = await screen.findByTestId("outcomes-picker");
    await within(picker).findByText("Identify network types");
    expect(curriculum).toHaveBeenCalledWith(3);
    fireEvent.click(within(picker).getByLabelText("All of LO1 Apply networking basics"));
    fireEvent.click(within(picker).getByLabelText(/2\.1/));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0]).toBe("assignment");
    expect([...save.mock.calls[0][2]].sort()).toEqual([701, 702, 703]);
    const panel = await screen.findByTestId("learning-outcomes");
    await waitFor(() => expect(panel).toHaveTextContent("LO1 Apply networking basics: 1.1, 1.2"));
    expect(panel).toHaveTextContent("LO2 Configure a router: 2.1");
  });

  it("shows why saving failed and keeps the picker open", async () => {
    task.mockResolvedValue({ subject_id: 3, criteria: [tag(701, "1.1", 71, 1, "Apply networking basics")], can_edit: true });
    curriculum.mockResolvedValue(OUTCOMES);
    save.mockImplementation(() => Promise.reject({ response: { data: { message: "MIS didn't return the learning outcomes. Try again." } } }));
    render(<LearningOutcomesPanel taskType="quiz" taskId={5} />);
    fireEvent.click(await screen.findByRole("button", { name: "Change" }));
    const picker = await screen.findByTestId("outcomes-picker");
    await within(picker).findByText("Draw a topology");
    expect((within(picker).getByLabelText(/1\.1/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await within(picker).findByRole("alert")).toHaveTextContent("MIS didn't return the learning outcomes");
  });
});
