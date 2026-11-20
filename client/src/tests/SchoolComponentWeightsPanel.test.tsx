import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { toast } from "react-toastify";
import SchoolComponentWeightsPanel from "../components/ReportCard/templates/SchoolComponentWeightsPanel";
import { ReportCardApiService } from "../services/reportCardApi";
import { TVET_STRUCTURE } from "../hooks/useReportCardStructure";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../services/reportCardApi", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/reportCardApi")>();
  return {
    ...orig,
    ReportCardApiService: { ...orig.ReportCardApiService, getComponentWeights: vi.fn(), saveDefaultComponentWeights: vi.fn() },
  };
});

const COMPONENTS = [
  { key: "class_work", label: "Class work" },
  { key: "homework", label: "Homework" },
  { key: "quiz", label: "Quizzes" },
];

describe("school weights inside each category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ReportCardApiService.getComponentWeights).mockResolvedValue({
      success: true,
      data: { components: COMPONENTS, default: { CA: { quiz: 100 } }, subject: null, effective: { CA: { quiz: 100 } } },
    });
    vi.mocked(ReportCardApiService.saveDefaultComponentWeights).mockImplementation(async (weights) => ({ success: true, data: { default: weights } }));
  });

  it("shows one editor per category of the builder and saves FA's weights next to the others", async () => {
    render(<SchoolComponentWeightsPanel structure={TVET_STRUCTURE} />);
    const editors = await screen.findAllByTestId("component-weights-editor");
    expect(editors).toHaveLength(TVET_STRUCTURE.categories.length);

    const fa = editors[0];
    fireEvent.change(within(within(fa).getByTestId("kind-weight-class_work")).getByRole("spinbutton"), { target: { value: "60" } });
    fireEvent.change(within(within(fa).getByTestId("kind-weight-homework")).getByRole("spinbutton"), { target: { value: "40" } });
    fireEvent.click(within(fa).getByTestId("component-weights-save"));

    await waitFor(() =>
      expect(ReportCardApiService.saveDefaultComponentWeights).toHaveBeenCalledWith({
        CA: { quiz: 100 },
        FA: expect.objectContaining({ class_work: 60, homework: 40 }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Formative Assessment: the school's weights are saved.");
  });

  it("goes back to an equal average for a category", async () => {
    render(<SchoolComponentWeightsPanel structure={TVET_STRUCTURE} />);
    const ca = (await screen.findAllByTestId("component-weights-editor"))[1];
    fireEvent.click(within(ca).getByRole("button", { name: /Count every assessment the same/ }));
    await waitFor(() => expect(ReportCardApiService.saveDefaultComponentWeights).toHaveBeenCalledWith({}));
    expect(toast.success).toHaveBeenCalledWith("Comprehensive Assessment: every assessment counts the same again.");
  });

  it("says so when the weights can't load", async () => {
    vi.mocked(ReportCardApiService.getComponentWeights).mockRejectedValueOnce(new Error("offline"));
    render(<SchoolComponentWeightsPanel structure={TVET_STRUCTURE} />);
    expect(await screen.findByText("Couldn't load the weights.")).toBeInTheDocument();
  });
});
