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
  /** The page title, drawn into the student toolbar next to the filters. */
  heading?: { title: string; period?: string | null };
}

/**
 * The student's filters in one slim bar: title on the left, a subject dropdown
 * (instead of a wall of chips) and the kind-of-work switch on the right.
 */
function StudentToolbar({
  heading,
  data,
  subjectId,
  onSubject,
  kind,
  onKind,
}: {
  heading?: Props["heading"];
  data: Extract<RankingResponse, { view: "student" }> | null;
  /** Undefined when the subject is fixed (a subject's own tab). */
  subjectId: string | null | undefined;
  onSubject?: (id: string | null) => void;
  kind: RankKindFilter;
  onKind: (kind: RankKindFilter) => void;
}) {
  const cohort = data?.cohort;
  return (
    <div className={`${CARD} p-4 flex flex-wrap items-center gap-3`}>
      <div className="mr-auto min-w-0">
        {heading && <h1 className="text-xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">{heading.title}</h1>}
        {data && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70">
            {cohort?.type === "class_group" ? (
              <span className="inline-flex items-center gap-1">
                <School className="w-3.5 h-3.5" />
                Ranked within {cohort.class_group_name}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1"
                title="Your class list couldn't be loaded, so you're ranked against everyone with marks in your subjects"
              >
                <Users className="w-3.5 h-3.5" />
                Ranked across your subjects
              </span>
            )}
            {heading?.period && <span>· {heading.period}</span>}
            <span className="inline-flex items-center gap-1">
              · <Lock className="w-3 h-3" /> Private to you
            </span>
          </p>
        )}
      </div>
      {data && subjectId !== undefined && onSubject && data.available_subjects.length > 0 && (
        <div className="w-full sm:w-64">
          <Select
            aria-label="Subject"
            value={subjectId ?? ""}
            onChange={(e) => onSubject(e.target.value || null)}
            className={`${SELECT} w-full`}
          >
            <option value="">All subjects</option>
            {data.available_subjects.map((s) => (
              <option key={s.course_id} value={s.course_id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {data && (
        <div role="radiogroup" aria-label="Kind of work" className="inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-light dark:bg-white/5 p-1 text-sm font-medium whitespace-nowrap">
          {KIND_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={kind === o.value}
              onClick={() => onKind(o.value)}
              className={`rounded-lg px-3 py-1 transition-colors ${
                kind === o.value
                  ? "bg-card-light dark:bg-card-dark shadow-sm text-blue-700 dark:text-blue-300"
                  : "text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RankingView({ filters, onChange, lockedSubjectId, heading }: Props) {
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

  const studentView = data?.view === "student";

  return (
    <div className="space-y-4 min-w-0">
      {/* Students: one toolbar — title, subject dropdown, kind of work. */}
      {(studentView || (!data && heading)) && (
        <StudentToolbar
          heading={heading}
          data={data?.view === "student" ? data : null}
          subjectId={lockedSubjectId ? undefined : subjectId}
          onSubject={selectSubject}
          kind={filters.kind}
          onKind={(kind) => set({ kind })}
        />
      )}

      {/* Staff: the full filter card. */}
      {data && !studentView && heading && (
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">{heading.title}</h1>
      )}
      {!studentView && (data || !heading) && (
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
          {isStaff && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 sm:ml-auto">
              <Users className="w-3.5 h-3.5" />
              {data.subject_scope === "all" ? "All subjects in the school" : "Your subjects only"}
            </span>
          )}
        </div>
      </div>
      )}

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
