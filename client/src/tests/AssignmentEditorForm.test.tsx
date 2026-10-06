import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";

/** Assignment create/edit form: attachments, AI rubric, upload progress. */

const post = vi.fn();
vi.mock("../utils/axiosConfig", () => ({
  default: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
  isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
}));
// The real editor opens a Tiptap modal; a textarea is enough to drive the form.
vi.mock("../components/Assignments/AssignmentDescriptionEditor", () => ({
  default: ({ description, onChange }: { description: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Description" value={description} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import AssignmentEditorForm, { type AssignmentFormValues } from "../components/Assignments/form/AssignmentEditorForm";
import { pickOption, selectValue, optionValues } from "./helpers/select";

const future = () => {
  const d = new Date(Date.now() + 3 * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
};

const initial = (extra: Partial<AssignmentFormValues> = {}): AssignmentFormValues => ({
  title: "Practical Task: UI Design Implementation Using HTML & CSS",
  description: "<p>Pick one design and build it.</p><p>Marking: Layout 40%, Styling 30%, Responsiveness 30%</p>",
  due_date: future(),
  max_score: 10,
  submission_type: "file",
  allowed_file_types: ["zip"],
  rubric: [],
  course_id: "12",
  status: "draft",
  ...extra,
});

const pngFile = (name = "design-1.png") => new File([new Uint8Array(2048)], name, { type: "image/png", lastModified: 1 });

beforeEach(() => {
  post.mockReset();
  // jsdom has no layout
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as never;
});

describe("attachments", () => {
  it("accepts a design image even when students may only submit .zip", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<AssignmentEditorForm mode="create" initial={initial()} courses={[{ id: "12", title: "Web", code: "SOD" }]} submit={submit} />);

    const input = screen.getByTestId("file-dropzone-input") as HTMLInputElement;
    // a valid accept list (".zip" style) that includes images
    expect(input.accept).toContain(".png");
    expect(input.accept.split(",").every((t) => t.startsWith("."))).toBe(true);

    fireEvent.change(input, { target: { files: [pngFile()] } });
    expect(await screen.findByText("design-1.png")).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [pngFile("design-2.png")] } });
    expect(await screen.findByText("design-2.png")).toBeInTheDocument();
    expect(screen.getByText("design-1.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create assignment/i }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const fd: FormData = submit.mock.calls[0][0];
    expect((fd.getAll("attachments") as File[]).map((f) => f.name)).toEqual(["design-1.png", "design-2.png"]);
    expect(fd.get("allowed_file_types")).toBe(JSON.stringify(["zip"]));
    expect(fd.get("course_id")).toBe("12");
  });

  it("explains why an unsupported file was not added", async () => {
    render(<AssignmentEditorForm mode="create" initial={initial()} courses={[]} submit={vi.fn()} />);
    fireEvent.change(screen.getByTestId("file-dropzone-input"), {
      target: { files: [new File(["x"], "setup.exe", { lastModified: 1 })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/setup\.exe.*\.exe files aren't allowed/);
  });

  it("shows upload progress, then keeps the form when the server refuses", async () => {
    let finish: (e: unknown) => void = () => {};
    const submit = vi.fn(
      (_fd: FormData, onProgress: (e: { loaded: number; total: number }) => void) =>
        new Promise<void>((_res, rej) => {
          onProgress({ loaded: 1024, total: 2048 });
          finish = rej;
        }),
    );
    render(<AssignmentEditorForm mode="create" initial={initial()} courses={[]} submit={submit as never} />);
    fireEvent.change(screen.getByTestId("file-dropzone-input"), { target: { files: [pngFile()] } });
    fireEvent.click(screen.getByRole("button", { name: /create assignment/i }));

    const overlay = await screen.findByTestId("upload-progress");
    expect(overlay).toHaveTextContent("50%");
    expect(overlay).toHaveTextContent(/Uploading 1 file/);

    await act(async () => finish({ response: { data: { message: "Course not found" } } }));
    await waitFor(() => expect(screen.queryByTestId("upload-progress")).not.toBeInTheDocument());
    expect(screen.getAllByRole("alert").some((a) => /Course not found/.test(a.textContent || ""))).toBe(true);
    expect(screen.getByText("design-1.png")).toBeInTheDocument();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toMatch(/UI Design/);
  });

  it("keeps or removes existing attachments in edit mode", async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <AssignmentEditorForm
        mode="edit"
        initial={initial()}
        existingAttachments={[
          { name: "brief.pdf", url: "/uploads/assignments/a.pdf", type: "application/pdf", size: 100 },
          { name: "old.png", url: "/uploads/assignments/b.png", type: "image/png", size: 100 },
        ]}
        submit={submit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove old.png" }));
    expect(screen.getByText(/Will be removed when you save/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const fd: FormData = submit.mock.calls[0][0];
    expect(JSON.parse(fd.get("existing_attachments") as string).map((a: { name: string }) => a.name)).toEqual(["brief.pdf"]);
    expect(fd.get("status")).toBe("draft");
  });
});

describe("AI rubric", () => {
  it("asks for the marks, reads the description and applies a rubric that adds up", async () => {
    post.mockResolvedValue({
      data: {
        data: {
          source: "description",
          total: 20,
          note: "Taken from the Marking line.",
          provider_used: "gemini",
          criteria: [
            { criteria: "Layout", description: "Matches the design", max_score: 8 },
            { criteria: "Styling", description: "Colours & type", max_score: 6 },
            { criteria: "Responsiveness", description: "Phones", max_score: 6 },
          ],
        },
      },
    });
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<AssignmentEditorForm mode="create" initial={initial()} courses={[]} submit={submit} />);

    fireEvent.click(screen.getAllByRole("button", { name: /generate/i })[0]);
    const panel = await screen.findByTestId("rubric-ai-panel");
    expect(panel).toHaveTextContent(/read your description/);

    const marks = within(panel).getByLabelText("Marks to distribute") as HTMLInputElement;
    expect(marks.value).toBe("10");
    fireEvent.change(marks, { target: { value: "20" } });
    pickOption(within(panel).getByRole("combobox"), "3");
    fireEvent.click(within(panel).getByRole("button", { name: /generate rubric/i }));

    const preview = await screen.findByTestId("rubric-ai-preview");
    expect(preview).toHaveTextContent("Found in your description");
    expect(post).toHaveBeenCalledWith(
      "/assignments/ai/rubric",
      expect.objectContaining({ max_score: 20, criteria_count: 3, description: expect.stringContaining("Marking") }),
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("button", { name: /use this rubric/i }));
    await waitFor(() => expect(screen.queryByTestId("rubric-ai-panel")).not.toBeInTheDocument());
    expect(screen.getByTestId("rubric-total")).toHaveTextContent("20 / 20");
    expect((screen.getByLabelText("Max score") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Criterion 1 name") as HTMLInputElement).value).toBe("Layout");

    fireEvent.click(screen.getByRole("button", { name: /create assignment/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const fd: FormData = submit.mock.calls[0][0];
    expect(fd.get("max_score")).toBe("20");
    expect(JSON.parse(fd.get("rubric") as string)).toHaveLength(3);
  });

  it("shows the AI's error message", async () => {
    post.mockRejectedValue({ isAxiosError: true, response: { data: { message: "All AI providers are busy." } } });
    render(<AssignmentEditorForm mode="create" initial={initial()} courses={[]} submit={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /generate/i })[0]);
    fireEvent.click(await screen.findByRole("button", { name: /generate rubric/i }));
    expect(await screen.findByText(/All AI providers are busy/)).toBeInTheDocument();
  });

  it("blocks saving a rubric worth more than the max score and offers to scale it", async () => {
    const submit = vi.fn();
    render(
      <AssignmentEditorForm
        mode="create"
        initial={initial({ rubric: [{ criteria: "A", max_score: 8 }, { criteria: "B", max_score: 8 }] })}
        courses={[]}
        submit={submit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /create assignment/i }));
    expect(await screen.findByText(/add up to 16, more than the max score/)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /scale to 10/i }));
    expect(screen.getByTestId("rubric-total")).toHaveTextContent("10 / 10");
  });
});
