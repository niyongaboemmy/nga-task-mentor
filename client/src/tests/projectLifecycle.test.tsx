import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { pickOption } from "./helpers/select";

/** Project status lifecycle on the web: Submit / Withdraw / Remove / Restore, create-for-assignment, Return. */

const api = {
  submitProject: vi.fn(),
  withdraw: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  deleteForGood: vi.fn(),
  create: vi.fn(),
  linkable: vi.fn(),
  returnForChanges: vi.fn(),
};
const start = vi.fn();
vi.mock("../services/projectsApi", async (orig) => ({
  ...(await orig<typeof import("../services/projectsApi")>()),
  projectsApi: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (api as any)[k](...a) }),
}));
vi.mock("../services/tmcodeAssignmentsApi", async (orig) => ({
  ...(await orig<typeof import("../services/tmcodeAssignmentsApi")>()),
  tmcodeAssignmentsApi: { start: (...a: unknown[]) => start(...a) },
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import ProjectLifecycle from "../components/Projects/ProjectLifecycle";
import NewProjectDialog from "../components/Projects/NewProjectDialog";
import ReturnForChangesDialog from "../components/Projects/ReturnForChangesDialog";

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  start.mockReset();
});

const lifecycle = (props: Partial<React.ComponentProps<typeof ProjectLifecycle>> = {}) => {
  const onChanged = vi.fn();
  render(
    <ProjectLifecycle
      projectId={5}
      status="draft"
      isOwner
      hasAssignment
      canSubmitNow
      onChanged={onChanged}
      {...props}
    />,
  );
  return { onChanged };
};

const confirm = async (label: string) => {
  const dialog = await screen.findByRole("alertdialog");
  await userEvent.click(within(dialog).getByRole("button", { name: label }));
};

describe("ProjectLifecycle", () => {
  it("shows Draft -> Submitted -> Graded with the current step", () => {
    lifecycle({ status: "submitted" });
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Submitted");
    expect(screen.getByText(/Locked while submitted/)).toBeInTheDocument();
  });

  it("submits a draft after confirming", async () => {
    api.submitProject.mockResolvedValue({ status: "submitted", link: null });
    const { onChanged } = lifecycle();
    await userEvent.click(screen.getByTestId("lifecycle-submit"));
    await confirm("Submit");
    await waitFor(() => expect(api.submitProject).toHaveBeenCalledWith(5));
    expect(onChanged).toHaveBeenCalledWith("submitted");
  });

  it("can't submit without an assignment, a saved version, or after the assignment closed", () => {
    const { unmount } = render(
      <ProjectLifecycle projectId={5} status="draft" isOwner hasAssignment={false} canSubmitNow onChanged={() => {}} />,
    );
    expect(screen.getByTestId("lifecycle-submit")).toBeDisabled();
    expect(screen.getByText(/Not linked to an assignment yet/)).toBeInTheDocument();
    unmount();
    render(<ProjectLifecycle projectId={5} status="draft" isOwner hasAssignment canSubmitNow={false} onChanged={() => {}} />);
    expect(screen.getByTestId("lifecycle-submit")).toHaveAttribute("title", "Save to Task Mentor first");
  });

  it("withdraws a submission", async () => {
    api.withdraw.mockResolvedValue("draft");
    const { onChanged } = lifecycle({ status: "submitted" });
    expect(screen.queryByTestId("lifecycle-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lifecycle-remove")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("lifecycle-withdraw"));
    await confirm("Withdraw");
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("draft"));
  });

  it("graded work has no actions", () => {
    lifecycle({ status: "graded" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/Graded — the project is locked/)).toBeInTheDocument();
  });

  it("removes, then restores or deletes for good", async () => {
    api.remove.mockResolvedValue(undefined);
    const first = lifecycle();
    await userEvent.click(screen.getByTestId("lifecycle-remove"));
    await confirm("Remove");
    await waitFor(() => expect(first.onChanged).toHaveBeenCalledWith("removed"));
  });

  it("a removed project offers Restore and Delete for good", async () => {
    api.restore.mockResolvedValue("draft");
    api.deleteForGood.mockResolvedValue(undefined);
    const { onChanged } = lifecycle({ status: "removed" });
    await userEvent.click(screen.getByTestId("lifecycle-restore"));
    await confirm("Restore");
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("draft"));
    await userEvent.click(screen.getByTestId("lifecycle-delete"));
    await confirm("Delete for good");
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("deleted"));
  });

  it("shows no owner actions to a teacher", () => {
    lifecycle({ status: "submitted", isOwner: false });
    expect(screen.queryByTestId("lifecycle-withdraw")).not.toBeInTheDocument();
  });
});

describe("NewProjectDialog — for an assignment", () => {
  const assignments = [
    { activity_type: "assignment", activity_id: 31, title: "Calculator", course: { id: 1, title: "Programming", code: null }, submission_type: "project" },
    { activity_type: "assignment", activity_id: 32, title: "Essay", course: null, submission_type: "file" },
    { activity_type: "quiz", activity_id: 9, title: "Quiz", course: null },
  ];

  it("offers only assignments that take a project, and links the new project", async () => {
    api.linkable.mockResolvedValue(assignments);
    api.create.mockResolvedValue({ id: 77, name: "Calculator" });
    const onCreated = vi.fn();
    render(<NewProjectDialog open onClose={() => {}} onCreated={onCreated} initialAssignmentId={31} />);
    const select = await screen.findByLabelText(/For an assignment/);
    await waitFor(() => expect(select).toHaveTextContent("Calculator · Programming"));
    // named after the assignment
    await waitFor(() => expect(screen.getByLabelText(/^Name/)).toHaveValue("Calculator"));
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ assignment_id: 31, name: "Calculator" })));
    expect(onCreated).toHaveBeenCalledWith({ id: 77, name: "Calculator" });
  });

  it("sends the student to Start when the assignment has starter files", async () => {
    api.linkable.mockResolvedValue(assignments);
    api.create.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { error_code: "USE_START", message: "Start it instead." } } });
    start.mockResolvedValue({ project: { id: 88, name: "Calculator" }, created: true });
    const onCreated = vi.fn();
    render(<NewProjectDialog open onClose={() => {}} onCreated={onCreated} />);
    pickOption(await screen.findByLabelText(/For an assignment/), "31");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByTestId("use-start")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Start with the starter files/ }));
    await waitFor(() => expect(start).toHaveBeenCalledWith(31));
    expect(onCreated).toHaveBeenCalledWith({ id: 88, name: "Calculator" });
  });
});

describe("ReturnForChangesDialog", () => {
  it("returns the project with the teacher's note", async () => {
    api.returnForChanges.mockResolvedValue("draft");
    const onReturned = vi.fn();
    render(
      <MemoryRouter>
        <ReturnForChangesDialog open projectId={5} studentName="Aline" onClose={() => {}} onReturned={onReturned} />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/What should they change/), "Handle empty input");
    await userEvent.click(screen.getByRole("button", { name: "Return to student" }));
    await waitFor(() => expect(api.returnForChanges).toHaveBeenCalledWith(5, "Handle empty input"));
    expect(onReturned).toHaveBeenCalled();
  });
});
