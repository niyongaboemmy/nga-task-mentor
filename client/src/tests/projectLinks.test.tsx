import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";

const axiosMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../utils/axiosConfig", () => ({ default: axiosMock, API_BASE_URL: "http://api.test/api" }));
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LinksTab from "../components/Projects/LinksTab";
import SubmitProjectCard from "../components/Projects/SubmitProjectCard";
import LinkedProjectsPanel from "../components/Projects/LinkedProjectsPanel";
import OpenProjectInTmcode, { OPEN_FALLBACK_MS } from "../components/Projects/OpenProjectInTmcode";
import { normalizeProjectDetail, type ProjectDetail, type ProjectLink } from "../services/projectsApi";
import { makeActivityProjects, makeLinkable, makeProjects } from "./fixtures/projects";

const detail = (overrides: Record<string, unknown> = {}): ProjectDetail =>
  normalizeProjectDetail({
    ...makeProjects()[0],
    links: [{ id: 501, project_id: 1, activity_type: "assignment", activity_id: 77, status: "linked", activity_title: "Sorting lab", course: { id: 11, title: "Computer Science S5", code: "CS5" } }],
    members: [],
    events: [],
    ...overrides,
  });

/** LinksTab owns no state for links: the page does. Mirror that here. */
function Harness({ initial, canEdit = true }: { initial: ProjectDetail; canEdit?: boolean }) {
  const [links, setLinks] = useState<ProjectLink[]>(initial.links);
  return <LinksTab project={{ ...initial, links }} canEdit={canEdit} onLinksChange={setLinks} />;
}

describe("Links tab: link and submit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits after confirmation, freezing the head revision", async () => {
    axiosMock.post.mockResolvedValue({ data: { link: { id: 501, project_id: 1, activity_type: "assignment", activity_id: 77, status: "submitted", revision_id: 9003, revision_number: 3, submitted_at: new Date().toISOString() } } });
    render(<Harness initial={detail()} />);

    const row = screen.getByTestId("link-row-501");
    expect(within(row).getByTestId("link-status")).toHaveTextContent("Linked");
    fireEvent.click(within(row).getByRole("button", { name: /Submit/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("This submits revision #3 to “Sorting lab”");
    expect(axiosMock.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(within(screen.getByTestId("link-row-501")).getByTestId("link-status")).toHaveTextContent("Submitted · rev 3"));
    expect(axiosMock.post).toHaveBeenCalledWith("/tmcode/projects/1/links/501/submit");
    // Submitted links can't be unlinked or resubmitted.
    expect(within(screen.getByTestId("link-row-501")).queryByRole("button")).toBeNull();
  });

  it("cancelling the confirmation submits nothing", async () => {
    render(<Harness initial={detail()} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it("disables Submit until there is a revision to freeze", () => {
    render(<Harness initial={detail({ head: null })} />);
    expect(screen.getByRole("button", { name: /Submit/ })).toBeDisabled();
    expect(screen.getByText(/nothing to submit yet/)).toBeInTheDocument();
  });

  it("shows the server's reason when submitting is refused", async () => {
    axiosMock.post.mockRejectedValue({ response: { status: 409, data: { message: "The deadline for this assignment has passed." } } });
    render(<Harness initial={detail()} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The deadline for this assignment has passed.");
  });

  it("links an activity picked from the linkable list (already-linked ones hidden)", async () => {
    axiosMock.get.mockResolvedValue({ data: { success: true, data: makeLinkable() } });
    axiosMock.post.mockResolvedValue({ data: { link: { id: 777, project_id: 1, activity_type: "quiz", activity_id: 31, status: "linked" } } });
    render(<Harness initial={detail()} />);

    fireEvent.click(screen.getByRole("button", { name: /Link to an activity/ }));
    const group = await screen.findByRole("radiogroup", { name: "Activities" });
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/activities/linkable");
    // "Sorting lab" (assignment 77) is already linked.
    expect(within(group).queryByText("Sorting lab")).toBeNull();
    expect(within(group).getAllByRole("radio")).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("Search activities or subjects"), { target: { value: "quiz" } });
    fireEvent.click(within(group).getByRole("radio", { name: /C\+\+ practical quiz/ }));
    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() => expect(screen.getByTestId("link-row-777")).toHaveTextContent("C++ practical quiz"));
    expect(axiosMock.post).toHaveBeenCalledWith("/tmcode/projects/1/links", { activity_type: "quiz", activity_id: 31 });
  });

  it("read-only viewers see links without actions", () => {
    render(<Harness initial={detail()} canEdit={false} />);
    expect(screen.queryByRole("button", { name: /Link to an activity/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Submit/ })).toBeNull();
  });
});

describe("Submit a project (assignment page)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("links the chosen project to the assignment, then submits it", async () => {
    const projects = makeProjects().map((p) => ({ ...p, links: { total: 0, submitted: 0, items: [] } }));
    axiosMock.get.mockResolvedValue({ data: { projects } });
    axiosMock.post
      .mockResolvedValueOnce({ data: { link: { id: 900, project_id: 1, activity_type: "assignment", activity_id: 79, status: "linked" } } })
      .mockResolvedValueOnce({ data: { link: { id: 900, status: "submitted", submitted_at: "2026-10-06T10:00:00Z" } } });
    const onSubmitted = vi.fn();
    render(
      <MemoryRouter>
        <SubmitProjectCard assignmentId={79} assignmentTitle="Recursion exercises" onSubmitted={onSubmitted} />
      </MemoryRouter>,
    );

    const select = await screen.findByLabelText("Project to submit");
    // Archived projects aren't offered.
    expect(within(select).queryByText(/Python games/)).toBeNull();
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit project/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Sorting algorithms (revision #3)");
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(axiosMock.post.mock.calls).toEqual([
      ["/tmcode/projects/1/links", { activity_type: "assignment", activity_id: 79 }],
      ["/tmcode/projects/1/links/900/submit"],
    ]);
    expect(await screen.findByTestId("link-status")).toHaveTextContent("Submitted");
  });

  it("reuses an existing link instead of linking twice", async () => {
    axiosMock.get.mockResolvedValue({ data: { projects: makeProjects() } });
    axiosMock.post.mockResolvedValue({ data: { link: { id: 501, status: "submitted" } } });
    render(
      <MemoryRouter>
        <SubmitProjectCard assignmentId={77} assignmentTitle="Sorting lab" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText("Project to submit")).toHaveValue("1"));
    fireEvent.click(screen.getByRole("button", { name: /Submit project/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(axiosMock.post).toHaveBeenCalledTimes(1));
    expect(axiosMock.post).toHaveBeenCalledWith("/tmcode/projects/1/links/501/submit");
  });

  it("shows a submission that was already made", async () => {
    axiosMock.get.mockResolvedValue({ data: { projects: makeProjects() } });
    render(
      <MemoryRouter>
        <SubmitProjectCard assignmentId={78} assignmentTitle="Web portfolio" />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "Portfolio site" })).toHaveAttribute("href", "/projects/2?tab=links");
    expect(screen.queryByRole("button", { name: /Submit project/ })).toBeNull();
  });
});

describe("Teacher: Linked projects panel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists linked projects and opens each at its frozen revision", async () => {
    axiosMock.get.mockResolvedValue({ data: { projects: makeActivityProjects() } });
    render(
      <MemoryRouter>
        <LinkedProjectsPanel activityType="assignment" activityId={77} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("2 submitted · 1 linked, not submitted")).toBeInTheDocument();
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/activities/assignment/77/projects");
    expect(screen.getByRole("link", { name: "Open John Doe's project Sorting algorithms" })).toHaveAttribute("href", "/projects/1?tab=files&rev=9003");
    expect(screen.getByRole("link", { name: "Open Grace Uwase's project Portfolio site" })).toHaveAttribute("href", "/projects/2?tab=git");
    expect(screen.getByTitle("Browse the submitted commit on GitHub")).toHaveAttribute(
      "href",
      "https://github.com/johndoe/portfolio/tree/3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39",
    );
  });

  it("loads only when a collapsible panel is opened", async () => {
    axiosMock.get.mockResolvedValue({ data: [] });
    render(
      <MemoryRouter>
        <LinkedProjectsPanel activityType="manual_assessment" activityId={41} collapsible />
      </MemoryRouter>,
    );
    expect(axiosMock.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Linked projects/ }));
    expect(await screen.findByText(/No student has linked a project/)).toBeInTheDocument();
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/activities/manual_assessment/41/projects");
  });
});

describe("Open in TMCode (project)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const stubLocation = () => {
    const href = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, set href(v: string) { href(v); } },
    });
    return href;
  };

  it("hands the deep link to the OS and offers the download when nothing opens", async () => {
    const href = stubLocation();
    axiosMock.get.mockResolvedValue({ data: { deeplink: "tmcode://project?id=1&api=https%3A%2F%2Fx" } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <MemoryRouter>
        <OpenProjectInTmcode projectId={1} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    await waitFor(() => expect(href).toHaveBeenCalledWith("tmcode://project?id=1&api=https%3A%2F%2Fx"));
    expect(axiosMock.get).toHaveBeenCalledWith("/tmcode/projects/1/open-link");
    expect(screen.queryByTestId("tmcode-fallback")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(OPEN_FALLBACK_MS + 10);
    });
    expect(screen.getByTestId("tmcode-fallback")).toHaveTextContent("Don't have TMCode? Download");
    expect(screen.getByRole("link", { name: /Download/ })).toHaveAttribute("href", "/tmcode");
    vi.useRealTimers();
  });

  it("stays quiet when the app takes focus", async () => {
    stubLocation();
    axiosMock.get.mockResolvedValue({ data: { deeplink: "tmcode://project?id=1" } });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <MemoryRouter>
        <OpenProjectInTmcode projectId={1} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open in TMCode/ }));
    await waitFor(() => expect(axiosMock.get).toHaveBeenCalled());
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(OPEN_FALLBACK_MS + 10);
    });
    expect(screen.queryByTestId("tmcode-fallback")).toBeNull();
    vi.useRealTimers();
  });
});
