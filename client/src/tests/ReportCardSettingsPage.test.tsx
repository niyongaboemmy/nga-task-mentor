import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportCardSettingsPage, { validateBands, validateScheme } from "../pages/ReportCardSettingsPage";
import { ReportCardWorkflowApi, NGA_BANDS } from "../services/reportCardWorkflowApi";
import { CourseApiService } from "../services/courseApi";
import type { Course } from "../types/course.types";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../services/reportCardWorkflowApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardWorkflowApi")>();
  return {
    ...orig,
    ReportCardWorkflowApi: { scheme: vi.fn(), saveScheme: vi.fn(), saveBands: vi.fn() },
  };
});

vi.mock("../services/courseApi", () => ({
  CourseApiService: { getCourses: vi.fn() },
}));

const SCHEME = {
  category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
  pass_mark: 50,
  attributes: ["Punctuality", "Obedience", "Neatness"],
  subject_groups: [{ name: "Core modules", subject_ids: [11] }],
  show_position: true,
  show_class_average: true,
  show_subject_teacher: false,
  head_title: "Principal",
  require_distinct_approver: false,
};

const BANDS = [
  { min: 90, letter: "A", remark: "Distinction" },
  { min: 75, letter: "B", remark: "Merit" },
  { min: 0, letter: "F", remark: "Fail" },
];

const COURSES = [
  { id: 11, title: "Mathematics", code: "MAT" },
  { id: 12, title: "English", code: "ENG" },
  { id: 13, title: "Physics", code: "" },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <ReportCardSettingsPage />
    </MemoryRouter>,
  );

const loaded = async () => {
  await screen.findByRole("heading", { name: "Grading scale" });
};

describe("ReportCardSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportCardWorkflowApi.scheme).mockResolvedValue({
      success: true,
      data: { scheme: structuredClone(SCHEME), bands: structuredClone(BANDS) },
    });
    vi.mocked(ReportCardWorkflowApi.saveScheme).mockImplementation(async (scheme) => ({ success: true, data: { scheme } }));
    vi.mocked(ReportCardWorkflowApi.saveBands).mockImplementation(async (bands) => ({ success: true, bands }));
    vi.mocked(CourseApiService.getCourses).mockResolvedValue({ success: true, count: 3, data: COURSES as unknown as Course[] });
  });

  it("shows skeletons while loading, then the settings", async () => {
    let resolve: (v: Awaited<ReturnType<typeof ReportCardWorkflowApi.scheme>>) => void = () => {};
    vi.mocked(ReportCardWorkflowApi.scheme).mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    expect(screen.getByTestId("settings-skeleton")).toBeInTheDocument();
    resolve({ success: true, data: { scheme: SCHEME, bands: BANDS } });
    await loaded();
    expect(screen.queryByTestId("settings-skeleton")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Band 1 letter")).toHaveValue("A");
    expect(screen.getByLabelText("EOT weight")).toHaveValue(50);
    expect(screen.getByLabelText("Pass mark")).toHaveValue(50);
    expect(screen.getByLabelText("Attribute 3")).toHaveValue("Neatness");
    expect(screen.getByLabelText("Group 1 name")).toHaveValue("Core modules");
    expect(
      await within(screen.getByTestId("group-0")).findByRole("button", { name: "Remove Mathematics (MAT) from Core modules" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Head of school title")).toHaveValue("Principal");
    expect(screen.getByRole("switch", { name: "Show position in class" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Show subject teacher" })).toHaveAttribute("aria-checked", "false");
  });

  it("shows an error with a retry when loading fails", async () => {
    const { toast } = await import("react-toastify");
    vi.mocked(ReportCardWorkflowApi.scheme).mockRejectedValueOnce({ response: { data: { message: "Not allowed." } } });
    renderPage();
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Not allowed.");
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await loaded();
  });

  // ── Bands ──

  it("applies the NGA preset and saves the bands", async () => {
    const { toast } = await import("react-toastify");
    renderPage();
    await loaded();
    expect(screen.getByTestId("save-bands")).toBeDisabled(); // nothing changed yet
    fireEvent.click(screen.getByTestId("nga-preset"));
    expect(within(screen.getByTestId("band-rows")).getAllByRole("listitem")).toHaveLength(NGA_BANDS.length);
    expect(screen.getByLabelText("Band 1 letter")).toHaveValue("A*");
    fireEvent.click(screen.getByTestId("save-bands"));
    await waitFor(() => expect(ReportCardWorkflowApi.saveBands).toHaveBeenCalledWith(NGA_BANDS));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Grading scale saved."));
  });

  it("validates band rows live and blocks the save", async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText("Band 3 minimum percent"), { target: { value: "75" } });
    const errors = screen.getByTestId("band-errors");
    expect(errors).toHaveTextContent("Each band needs a different minimum.");
    expect(errors).toHaveTextContent("One band must start at 0");
    fireEvent.change(screen.getByLabelText("Band 1 letter"), { target: { value: "ABCDE" } });
    expect(screen.getByTestId("band-errors")).toHaveTextContent("Row 1: the letter is at most 4 characters.");
    expect(screen.getByTestId("save-bands")).toBeDisabled();
  });

  it("adds and removes band rows", async () => {
    renderPage();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: /Add band/ }));
    expect(within(screen.getByTestId("band-rows")).getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Remove band 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove band 2" }));
    expect(within(screen.getByTestId("band-rows")).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Band 2 letter")).toHaveValue("F");
  });

  it("toasts the server's message when saving bands fails", async () => {
    const { toast } = await import("react-toastify");
    vi.mocked(ReportCardWorkflowApi.saveBands).mockRejectedValueOnce({ response: { data: { message: "Grade bands need a letter." } } });
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText("Band 2 remark"), { target: { value: "Good" } });
    fireEvent.click(screen.getByTestId("save-bands"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Grade bands need a letter."));
  });

  // ── Scheme ──

  it("keeps a running weight total and blocks the save unless it is 100", async () => {
    renderPage();
    await loaded();
    expect(screen.getByTestId("weight-total")).toHaveTextContent("Total: 100 / 100");
    fireEvent.change(screen.getByLabelText("CW weight"), { target: { value: "20" } });
    expect(screen.getByTestId("weight-total")).toHaveTextContent("Total: 105 / 100");
    expect(screen.getByTestId("scheme-errors")).toHaveTextContent("Category weights must add up to 100 (they add up to 105).");
    expect(screen.getByTestId("save-scheme")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("EOT weight"), { target: { value: "45" } });
    expect(screen.queryByTestId("scheme-errors")).not.toBeInTheDocument();
    expect(screen.getByTestId("save-scheme")).not.toBeDisabled();
  });

  it("edits, reorders and removes attributes, groups subjects, flips toggles and saves the scheme", async () => {
    const { toast } = await import("react-toastify");
    renderPage();
    await loaded();
    await within(screen.getByTestId("group-0")).findByRole("button", { name: "Remove Mathematics (MAT) from Core modules" });

    // Attributes: rename, add, move up, remove.
    fireEvent.change(screen.getByLabelText("Attribute 3"), { target: { value: "Neatness & order" } });
    fireEvent.click(screen.getByRole("button", { name: /Add attribute/ }));
    fireEvent.change(screen.getByLabelText("Attribute 4"), { target: { value: "Commitment to society" } });
    fireEvent.click(screen.getByRole("button", { name: "Move Commitment to society up" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Obedience" }));

    // Groups: a new "Specific modules" with English.
    fireEvent.click(screen.getByRole("button", { name: /Add group/ }));
    fireEvent.change(screen.getByLabelText("Group 2 name"), { target: { value: "Specific modules" } });
    const add = within(screen.getByTestId("group-1")).getByLabelText("Add a subject to group 2");
    fireEvent.click(add); // the shared Select opens a listbox
    fireEvent.click(await screen.findByRole("option", { name: "English (ENG)" }));
    expect(
      await within(screen.getByTestId("group-1")).findByRole("button", { name: "Remove English (ENG) from Specific modules" }),
    ).toBeInTheDocument();

    // Display.
    fireEvent.click(screen.getByRole("switch", { name: "Show subject teacher" }));
    fireEvent.click(screen.getByRole("switch", { name: "Approver must differ from reviewer" }));
    fireEvent.change(screen.getByLabelText("Head of school title"), { target: { value: "Head teacher" } });
    fireEvent.change(screen.getByLabelText("Pass mark"), { target: { value: "40" } });

    fireEvent.click(screen.getByTestId("save-scheme"));
    await waitFor(() => expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledTimes(1));
    expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith({
      category_weights: { CW: 15, HW: 10, MD: 25, EOT: 50 },
      pass_mark: 40,
      attributes: ["Punctuality", "Commitment to society", "Neatness & order"],
      subject_groups: [
        { name: "Core modules", subject_ids: [11] },
        { name: "Specific modules", subject_ids: [12] },
      ],
      show_position: true,
      show_class_average: true,
      show_subject_teacher: true,
      head_title: "Head teacher",
      require_distinct_approver: true,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Report card settings saved."));
    expect(screen.getByTestId("save-scheme")).toBeDisabled(); // saved: nothing left to save
  });

  it("flags duplicate and empty attributes", async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText("Attribute 2"), { target: { value: "punctuality" } });
    expect(screen.getByTestId("scheme-errors")).toHaveTextContent("Attribute names must be different from each other.");
    fireEvent.change(screen.getByLabelText("Attribute 2"), { target: { value: "" } });
    expect(screen.getByTestId("scheme-errors")).toHaveTextContent("Every behaviour attribute needs a name");
  });

  it("toasts the server's validation message when saving the scheme fails", async () => {
    const { toast } = await import("react-toastify");
    vi.mocked(ReportCardWorkflowApi.saveScheme).mockRejectedValueOnce({ response: { status: 400, data: { message: "Give between 1 and 16 attributes." } } });
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText("Pass mark"), { target: { value: "45" } });
    fireEvent.click(screen.getByTestId("save-scheme"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Give between 1 and 16 attributes."));
    expect(screen.getByTestId("save-scheme")).not.toBeDisabled();
  });

  it("lets the user type subject ids when the subject list can't load", async () => {
    vi.mocked(CourseApiService.getCourses).mockRejectedValueOnce(new Error("down"));
    renderPage();
    await loaded();
    expect(await screen.findByText(/Type subject ids instead/)).toBeInTheDocument();
    const ids = screen.getByLabelText("Group 1 subject ids");
    expect(ids).toHaveValue("11");
    fireEvent.change(ids, { target: { value: "11, 14, x, 14" } });
    fireEvent.click(screen.getByTestId("save-scheme"));
    await waitFor(() =>
      expect(ReportCardWorkflowApi.saveScheme).toHaveBeenCalledWith(
        expect.objectContaining({ subject_groups: [{ name: "Core modules", subject_ids: [11, 14] }] }),
      ),
    );
  });
});

describe("settings validation", () => {
  it("accepts the NGA scale and rejects a scale without a 0 band", () => {
    const rows = NGA_BANDS.map((b) => ({ min: String(b.min), letter: b.letter, remark: b.remark }));
    expect(validateBands(rows)).toEqual([]);
    expect(validateBands(rows.slice(0, -1))).toContain("One band must start at 0 so every score gets a grade.");
    expect(validateBands([{ min: "101", letter: "A", remark: "x".repeat(41) }])).toEqual(
      expect.arrayContaining(["Row 1: the minimum must be between 0 and 100.", "Row 1: the remark is at most 40 characters."]),
    );
  });

  it("checks weights, pass mark, attributes and groups like the server", () => {
    const base = {
      weights: { CW: "15", HW: "10", MD: "25", EOT: "50" },
      pass_mark: "50",
      attributes: [{ key: 1, name: "Punctuality" }],
      groups: [] as Array<{ key: number; name: string; subject_ids: number[] }>,
      show_position: true,
      show_class_average: true,
      show_subject_teacher: true,
      head_title: "Principal",
      require_distinct_approver: false,
    };
    expect(validateScheme(base)).toEqual([]);
    expect(validateScheme({ ...base, weights: { ...base.weights, CW: "-1" } })).toContain("The CW weight must be between 0 and 100.");
    expect(validateScheme({ ...base, pass_mark: "120" })).toContain("The pass mark must be between 0 and 100.");
    expect(validateScheme({ ...base, attributes: Array.from({ length: 17 }, (_, i) => ({ key: i, name: `A${i}` })) })).toContain(
      "Give between 1 and 16 behaviour attributes.",
    );
    expect(validateScheme({ ...base, groups: [{ key: 1, name: "", subject_ids: [] }] })).toContain(
      "Subject group 1 needs a name of at most 60 characters.",
    );
  });
});
