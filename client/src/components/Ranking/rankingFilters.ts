import type { RankKindFilter } from "../../services/rankingApi";

/** How the staff leaderboard is laid out: one list, or sectioned by class / grade. */
export type RankingGroupBy = "none" | "class" | "grade";

export interface RankingFiltersState {
  subjectId: string | null;
  kind: RankKindFilter;
  classGroupId: number | null;
  gradeId: number | null;
  groupBy: RankingGroupBy;
}

export const DEFAULT_RANKING_FILTERS: Omit<RankingFiltersState, "subjectId"> = {
  kind: "all",
  classGroupId: null,
  gradeId: null,
  groupBy: "none",
};
