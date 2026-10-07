import { useEffect, useState } from "react";
import { AlertCircle, Lock, RefreshCw, School, Users } from "lucide-react";
import { Segmented } from "../Students/profile/profileParts";
import { CARD, SELECT } from "../Students/profile/profileTheme";
import {
  fetchRanking,
  RankingError,
  type RankingResponse,
  type RankKindFilter,
} from "../../services/rankingApi";
import { RankingSkeleton, SubjectPicker } from "./rankingParts";
import type { RankingFiltersState, RankingGroupBy } from "./rankingFilters";
import StudentRankingPanel from "./StudentRankingPanel";
import StaffLeaderboardPanel from "./StaffLeaderboardPanel";
import Select from "../ui/Select";

// The ranking, for whoever is looking. Used by the Overall Ranking page (all
// subjects, subject picker) and by a subject's Ranking tab (subject locked).
// Which view renders is the server's decision (see services/rankingApi).

const KIND_OPTIONS: Array<{ value: RankKindFilter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "assignment", label: "Assignments" },
  { value: "quiz", label: "Quizzes" },
  { value: "recorded", label: "Recorded" },
];

export type { RankingFiltersState, RankingGroupBy } from "./rankingFilters";

interface Props {
  filters: RankingFiltersState;
  onChange: (next: RankingFiltersState) => void;
  /** Set by a subject's tab: the subject is fixed and the picker is hidden. */
  lockedSubjectId?: string;
}

export default function RankingView({ filters, onChange, lockedSubjectId }: Props) {
  const subjectId = lockedSubjectId ?? filters.subjectId;
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RankingError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRanking({ subjectId, kind: filters.kind, classGroupId: filters.classGroupId, gradeId: filters.gradeId })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: RankingError) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, filters.kind, filters.classGroupId, filters.gradeId, reloadKey]);

  const set = (patch: Partial<RankingFiltersState>) => onChange({ ...filters, ...patch });
  const selectSubject = lockedSubjectId ? undefined : (id: string | null) => set({ subjectId: id, classGroupId: null });

  const isStaff = data?.view === "staff";
  const grades = data?.view === "staff" ? data.grades : [];
  // The class list follows the grade picked.
  const classGroups =
    data?.view === "staff"
      ? data.class_groups.filter((g) => filters.gradeId === null || g.grade_id === filters.gradeId)
      : [];
  const allClassGroups = data?.view === "staff" ? data.class_groups : [];
  const selectGrade = (gradeId: number | null) => {
    const keepClass =
      filters.classGroupId !== null &&
      (gradeId === null || allClassGroups.some((g) => g.id === filters.classGroupId && g.grade_id === gradeId));
    set({ gradeId, classGroupId: keepClass ? filters.classGroupId : null });
  };
  const groupOptions: Array<{ value: RankingGroupBy; label: string }> = [
    { value: "none", label: "One list" },
    ...(allClassGroups.length > 1 && filters.classGroupId === null ? [{ value: "class" as const, label: "By class" }] : []),
    ...(grades.length > 1 && filters.gradeId === null && filters.classGroupId === null ? [{ value: "grade" as const, label: "By grade" }] : []),
  ];
  // A grouping the current filter makes pointless (one class picked) falls back.
  const groupBy: RankingGroupBy = groupOptions.some((o) => o.value === filters.groupBy) ? filters.groupBy : "none";

  return (
    <div className="space-y-4 min-w-0">
      {/* Filters */}
      <div className={`${CARD} p-3 sm:p-4 space-y-3`}>
        {!lockedSubjectId && data && data.available_subjects.length > 0 && (
          <SubjectPicker subjects={data.available_subjects} value={subjectId} onChange={(id) => selectSubject?.(id)} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Kind of work" value={filters.kind} options={KIND_OPTIONS} onChange={(kind) => set({ kind })} />
          {isStaff && (grades.length > 1 || filters.gradeId !== null) && (
            <Select
              aria-label="Grade"
              value={filters.gradeId ?? ""}
              onChange={(e) => selectGrade(e.target.value ? Number(e.target.value) : null)}
              className={SELECT}
            >
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
          {isStaff && (classGroups.length > 1 || filters.classGroupId !== null) && (
            <Select
              aria-label="Class"
              value={filters.classGroupId ?? ""}
              onChange={(e) => set({ classGroupId: e.target.value ? Number(e.target.value) : null })}
              className={SELECT}
            >
              <option value="">{filters.gradeId !== null ? "All classes in the grade" : "All classes"}</option>
              {classGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
          {isStaff && groupOptions.length > 1 && (
            <Segmented label="Group the leaderboard" value={groupBy} options={groupOptions} onChange={(groupBy) => set({ groupBy })} />
          )}
          {data?.view === "student" && (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 sm:ml-auto">
              {data.cohort.type === "class_group" ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                  <School className="w-3.5 h-3.5" />
                  Ranked within {data.cohort.class_group_name}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300"
                  title="Your class list couldn't be loaded, so you're ranked against everyone with marks in your subjects"
                >
                  <Users className="w-3.5 h-3.5" />
                  Ranked across your subjects
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Private to you
              </span>
            </span>
          )}
          {isStaff && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 sm:ml-auto">
              <Users className="w-3.5 h-3.5" />
              {data.subject_scope === "all" ? "All subjects in the school" : "Your subjects only"}
            </span>
          )}
        </div>
      </div>

      {loading && !data ? (
        <RankingSkeleton />
      ) : error ? (
        <div className={`${CARD} p-8 text-center`}>
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            {error.statusCode === 403 ? "You don't have access to this ranking" : "Couldn't load the ranking"}
          </p>
          <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">{error.message}</p>
          {error.statusCode !== 403 && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          )}
        </div>
      ) : data ? (
        <div className={`transition-opacity ${loading ? "opacity-60 pointer-events-none" : ""}`} aria-busy={loading}>
          {data.view === "student" ? (
            <StudentRankingPanel data={data} scopedToSubject={!!subjectId} onSelectSubject={selectSubject ?? undefined} />
          ) : (
            <StaffLeaderboardPanel
              data={data}
              scopedToSubject={!!subjectId}
              onSelectSubject={selectSubject ?? undefined}
              groupBy={groupBy}
              onSelectGroup={(by, id) => (by === "class" ? set({ classGroupId: id, groupBy: "none" }) : selectGrade(id))}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
