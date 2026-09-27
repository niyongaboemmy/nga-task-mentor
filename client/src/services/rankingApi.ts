import axios from "../utils/axiosConfig";

// ─── Overall ranking ──────────────────────────────────────────────────────────
// GET /rankings (server controllers/ranking.controller + utils/overallRanking).
// The server decides the view from the caller's subject scope — a student
// always gets `view: "student"` (their own position only), teachers and
// admins get `view: "staff"` (a named leaderboard). The client never asks for
// a view; it only renders what came back.

export type RankKind = "assignment" | "quiz" | "recorded";
export type RankKindFilter = "all" | RankKind;
export type PerformanceStatus = "excelling" | "on_track" | "needs_attention" | "at_risk" | "no_marks";

export interface RankSubject {
  course_id: string;
  name: string;
  code: string | null;
}

export interface KindScore {
  score: number;
  count: number;
}

export type PendingStatus = "overdue" | "due_soon" | "open" | "awaiting_mark" | "missed";

export interface PendingItem {
  kind: RankKind;
  course_id: string;
  item_id: number;
  title: string;
  due_date: string | null;
  status: PendingStatus;
}

export interface Suggestion {
  id: string;
  priority: "high" | "medium" | "low";
  category: "deadline" | "subject" | "skill" | "review" | "rank" | "strength" | "getting_started";
  title: string;
  detail: string;
  course_id?: string;
  action?: { label: string; href: string };
}

export interface StudentSubjectView extends RankSubject {
  score: number | null;
  rank: number | null;
  ranked_count: number;
  class_average: number | null;
  gap: number | null;
  status: PerformanceStatus;
  by_kind: Partial<Record<RankKind, KindScore>>;
  marked_items: number;
  pending_count: number;
  weakest: Array<{ kind: RankKind; item_id: number; title: string; pct: number }>;
}

export interface StudentRanking {
  view: "student";
  scope: { subject_id: string | null; kind: RankKindFilter };
  overall: {
    rank: number | null;
    ranked_count: number;
    score: number | null;
    band: string | null;
    top_percent: number | null;
    class_average: number | null;
    points_to_next: number | null;
    marked_items: number;
    status: PerformanceStatus;
  };
  subjects: StudentSubjectView[];
  pending: PendingItem[];
  suggestions: Suggestion[];
  privacy: { aggregates_hidden: boolean; min_cohort: number };
  available_subjects: RankSubject[];
}

export interface LeaderboardRow {
  rank: number;
  key: string;
  mis_user_id: number | null;
  name: string;
  class_group_name: string | null;
  score: number;
  status: PerformanceStatus;
  marked_items: number;
  subjects_marked: number;
  subject_scores: Record<string, number>;
  by_kind: Partial<Record<RankKind, number>>;
}

export interface StaffRanking {
  view: "staff";
  scope: { subject_id: string | null; kind: RankKindFilter; class_group_id: number | null };
  subjects: Array<RankSubject & { ranked_count: number; average: number | null }>;
  class_groups: Array<{ id: number; name: string }>;
  summary: {
    ranked_count: number;
    average: number | null;
    median: number | null;
    highest: number | null;
    lowest: number | null;
    distribution: { excelling: number; on_track: number; needs_attention: number; at_risk: number };
    unranked_count: number;
  };
  rows: LeaderboardRow[];
  unranked: Array<{ key: string; mis_user_id: number | null; name: string; class_group_name: string | null }>;
  available_subjects: RankSubject[];
  subject_scope: "all" | "assigned";
}

export type RankingResponse = StudentRanking | StaffRanking;

export interface RankingFilters {
  subjectId?: string | null;
  kind?: RankKindFilter;
  classGroupId?: number | null;
}

export class RankingError extends Error {
  statusCode: number | null;
  constructor(message: string, statusCode: number | null) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const fetchRanking = async (filters: RankingFilters = {}): Promise<RankingResponse> => {
  const params: Record<string, string | number> = {};
  if (filters.subjectId) params.subjectId = filters.subjectId;
  if (filters.kind && filters.kind !== "all") params.kind = filters.kind;
  if (filters.classGroupId) params.classGroupId = filters.classGroupId;
  try {
    const res = await axios.get("/rankings", { params });
    if (!res.data?.success) throw new RankingError("Failed to load the ranking", null);
    return res.data.data as RankingResponse;
  } catch (error: unknown) {
    if (error instanceof RankingError) throw error;
    const response = (error as { response?: { status?: number; data?: { message?: string } } })?.response;
    throw new RankingError(response?.data?.message || "Failed to load the ranking", response?.status ?? null);
  }
};

export const STATUS_META: Record<PerformanceStatus, { label: string; color: string }> = {
  excelling: { label: "Excelling", color: "#10b981" },
  on_track: { label: "On track", color: "#3b82f6" },
  needs_attention: { label: "Needs attention", color: "#f59e0b" },
  at_risk: { label: "At risk", color: "#ef4444" },
  no_marks: { label: "No marks yet", color: "#9ca3af" },
};

export const ordinal = (n: number): string => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

// ─── Top-bar summary ──────────────────────────────────────────────────────────
// GET /rankings?summary=1: the student's overall standing for the navbar chip.
// Staff get { view: "none" } and the chip renders nothing. Cached per academic
// period so moving between pages doesn't refetch; concurrent callers share
// one request.

export interface StudentRankingSummary {
  view: "student_summary";
  rank: number | null;
  ranked_count: number;
  score: number | null;
  band: string | null;
  status: PerformanceStatus;
  class_average: number | null;
  gap: number | null;
  points_to_next: number | null;
  subject_count: number;
  at_risk_subjects: Array<{ course_id: string; name: string; score: number }>;
  at_risk_count: number;
  overdue_count: number;
  top_suggestion: Suggestion | null;
}

export type RankingSummaryResponse = StudentRankingSummary | { view: "none" };

export const SUMMARY_TTL_MS = 3 * 60 * 1000;
const summaryCache = new Map<string, { at: number; promise: Promise<RankingSummaryResponse> }>();

export const fetchRankingSummary = (
  periodKey: string,
  { force = false }: { force?: boolean } = {},
): Promise<RankingSummaryResponse> => {
  const hit = summaryCache.get(periodKey);
  if (!force && hit && Date.now() - hit.at < SUMMARY_TTL_MS) return hit.promise;
  const promise = axios
    .get("/rankings", { params: { summary: 1 } })
    .then((res) => {
      if (!res.data?.success) throw new RankingError("Failed to load your standing", null);
      return res.data.data as RankingSummaryResponse;
    })
    .catch((error: unknown) => {
      summaryCache.delete(periodKey); // don't cache a failure
      if (error instanceof RankingError) throw error;
      const response = (error as { response?: { status?: number } })?.response;
      throw new RankingError("Failed to load your standing", response?.status ?? null);
    });
  summaryCache.set(periodKey, { at: Date.now(), promise });
  return promise;
};

/** Test hook / sign-out. */
export const clearRankingSummaryCache = () => summaryCache.clear();
