import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RankHero from "../components/Ranking/RankHero";
import type { StudentRanking } from "../services/rankingApi";

const data = (overall: Partial<StudentRanking["overall"]> = {}, aggregatesHidden = false): StudentRanking =>
  ({
    view: "student",
    scope: { subject_id: null, kind: "all" },
    cohort: { type: "class_group", class_group_id: 1, class_group_name: "L5 SOD A", grade_name: "Level 5" },
    overall: {
      rank: 18, ranked_count: 18, score: 40, band: "Bottom quarter", top_percent: 100, class_average: 74.6,
      points_to_next: 13.3, marked_items: 1, status: "at_risk", ...overall,
    },
    subjects: [], pending: [], suggestions: [],
    privacy: { aggregates_hidden: aggregatesHidden, min_cohort: 5 },
    available_subjects: [],
  }) as StudentRanking;

describe("RankHero", () => {
  it("shows the rank on a solid blue tile, never a gradient", () => {
    render(<RankHero data={data()} subjectName={null} />);
    const tile = screen.getByText("18th").parentElement!;
    expect(tile.className).toMatch(/\bbg-blue-600\b/);
    expect(tile.className).not.toMatch(/gradient|violet|purple|indigo/);
    expect(screen.getByText("of 18")).toBeInTheDocument();
  });

  it("places the student in the class and says what it takes to move up", () => {
    render(<RankHero data={data()} subjectName={null} />);
    expect(screen.getByRole("img", { name: "18th of 18: Bottom quarter" })).toBeInTheDocument();
    expect(screen.getByText("+13.3 pts to reach 17th")).toBeInTheDocument();
    // "Top 100%" is meaningless for last place, so it isn't shown
    expect(screen.queryByText(/Top 100%/)).toBeNull();
  });

  it("compares the average with the class and the pass mark", () => {
    render(<RankHero data={data()} subjectName={null} />);
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("-34.6 pts")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your average 40%, class average 74.6%, pass mark 50%" })).toBeInTheDocument();
  });

  it("celebrates first place and shows a real top share", () => {
    render(<RankHero data={data({ rank: 1, band: "Top of the cohort", top_percent: 6, score: 92, points_to_next: null, status: "excelling" })} subjectName="Web UI" />);
    expect(screen.getByText("You're at the top")).toBeInTheDocument();
    expect(screen.getByText("Top 6%")).toBeInTheDocument();
    expect(screen.getByText("Your position in Web UI · L5 SOD A")).toBeInTheDocument();
    expect(screen.getByText("+17.4 pts")).toBeInTheDocument();
  });

  it("handles no ranking yet and hidden class averages", () => {
    render(<RankHero data={data({ rank: null, ranked_count: 3, class_average: null, score: null, points_to_next: null, band: null }, true)} subjectName={null} />);
    expect(screen.getByText("Not ranked yet")).toBeInTheDocument();
    expect(screen.getByText("Get your first marks to be ranked")).toBeInTheDocument();
    expect(screen.getByText("Class hidden")).toBeInTheDocument();
    expect(screen.getByText(/averages are hidden when fewer than 5/)).toBeInTheDocument();
  });
});
