import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

/** AI drafts of class-teacher comments in the General Attributes form. */
// Plain per-test function (see aiMarkingAssistant.test.tsx for why not a reused vi.fn).
let draft: (body: any) => Promise<any> = async () => ({});
const calls: any[] = [];
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("../services/reportCardApi", () => ({
  ReportCardApiService: {
    saveAttributes: vi.fn(),
    draftComment: (body: any) => (calls.push(body), draft(body)),
  },
}));

import GeneralAttributesForm, { firstName } from "../components/ReportCard/GeneralAttributesForm";

const students = [
  { id: 1, name: "Alice Mutoni" },
  { id: 2, name: "Bob Nkurunziza" },
  { id: 3, name: "Carol Uwase" },
];
const props = {
  students,
  term: "Term 1",
  academicYear: "2026-2027",
  results: { 1: [{ name: "Mathematics", score: 81 }] },
  initialData: { 3: { attendance: "present" as const, attributes: {}, comment: "Already written." } },
};

describe("AI report-card comments", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("first names fill [NAME]", () => {
    expect(firstName("  Alice   Mutoni ")).toBe("Alice");
  });

  it("drafts one student's comment from their results and ratings, with their first name", async () => {
    draft = async () => ({ success: true, data: { comment: "[NAME] is a careful mathematician; [NAME] should now read more widely.", provider_used: "groq" } });
    render(<GeneralAttributesForm {...props} />);
    const row = screen.getByTestId("student-row-1");
    fireEvent.click(within(row).getByRole("button", { name: "Draft a comment for Alice Mutoni with AI" }));
    await waitFor(() => expect((within(row).getByLabelText("Comment for Alice Mutoni") as HTMLTextAreaElement).value).toBe("Alice is a careful mathematician; Alice should now read more widely."));
    expect(calls[0]).toMatchObject({ term: "Term 1", academic_year: "2026-2027", subjects: [{ name: "Mathematics", score: 81 }], attendance: "present", current: null });
  });

  it("drafts only the empty comments in bulk, two at a time", async () => {
    let inFlight = 0;
    let peak = 0;
    draft = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { success: true, data: { comment: "[NAME] contributes well in class discussions.", provider_used: "glm" } };
    };
    render(<GeneralAttributesForm {...props} />);
    const all = screen.getByTestId("ai-draft-all");
    expect(all).toHaveTextContent("Draft empty comments (2)");
    fireEvent.click(all);
    await waitFor(() => expect(screen.getByTestId("ai-draft-all")).toHaveTextContent("Draft empty comments (0)"));
    expect(calls).toHaveLength(2);
    expect(peak).toBeLessThanOrEqual(2);
    const bob = within(screen.getByTestId("student-row-2")).getByLabelText("Comment for Bob Nkurunziza") as HTMLTextAreaElement;
    expect(bob.value).toBe("Bob contributes well in class discussions.");
    const carol = within(screen.getByTestId("student-row-3")).getByLabelText("Comment for Carol Uwase") as HTMLTextAreaElement;
    expect(carol.value).toBe("Already written.");
  });
});
