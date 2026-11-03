import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/** Marks status: the form picker, the badge, and the in-place menu on an existing assignment. */

const patch = vi.fn();
vi.mock("../utils/axiosConfig", () => ({
  default: { patch: (...a: unknown[]) => patch(...a), post: vi.fn(), get: vi.fn() },
  isAxiosError: () => false,
}));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../components/Assignments/AssignmentDescriptionEditor", () => ({
  default: ({ description, onChange }: { description: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Description" value={description} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import AssignmentEditorForm from "../components/Assignments/form/AssignmentEditorForm";
import { MarksScopeBadge, MarksScopeMenu } from "../components/Assignments/MarksScope";

const future = () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
};

beforeEach(() => {
  patch.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
});

describe("marks status", () => {
  it("the form sends part_of with what it is part of", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <AssignmentEditorForm
        mode="create"
        courses={[{ id: "12", title: "Web", code: "SOD" }]}
        initial={{
          title: "Exam: Section C",
          description: "<p>Build the page</p>",
          due_date: future(),
          max_score: 20,
          submission_type: "text",
          allowed_file_types: [],
          rubric: [],
          course_id: "12",
          status: "draft",
          marks_scope: "counted",
          part_of_title: "",
        }}
        tmcodeEnabled={false}
        submit={submit}
      />,
    );
    expect(screen.queryByLabelText(/What is it part of/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Part of another assessment/ }));
    fireEvent.change(await screen.findByLabelText(/What is it part of/), { target: { value: " Term exam " } });
    fireEvent.submit(screen.getByTestId("assignment-form"));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const fd = submit.mock.calls[0][0] as FormData;
    expect(fd.get("marks_scope")).toBe("part_of");
    expect(fd.get("part_of_title")).toBe("Term exam");
  });

  it("the badge shows only for part_of", () => {
    const { rerender } = render(<MarksScopeBadge scope="counted" />);
    expect(screen.queryByTestId("marks-scope-badge")).not.toBeInTheDocument();
    rerender(<MarksScopeBadge scope="part_of" partOfTitle="Term exam" />);
    expect(screen.getByTestId("marks-scope-badge")).toHaveTextContent("Part of Term exam");
  });

  it("the menu changes an existing assignment in place", async () => {
    patch.mockResolvedValue({ data: { data: { id: 7, marks_scope: "part_of", part_of_title: "Mock exam" } } });
    const onChanged = vi.fn();
    render(<MarksScopeMenu assignmentId={7} scope="counted" onChanged={onChanged} />);
    fireEvent.click(screen.getByTestId("marks-scope-menu"));
    expect(screen.getByTestId("marks-scope-save")).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Part of another assessment/ }));
    fireEvent.change(screen.getByLabelText(/What is it part of/), { target: { value: "Mock exam" } });
    fireEvent.click(screen.getByTestId("marks-scope-save"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith("part_of", "Mock exam"));
    expect(patch).toHaveBeenCalledWith("/assignments/7/marks-scope", { marks_scope: "part_of", part_of_title: "Mock exam" });
  });
});
