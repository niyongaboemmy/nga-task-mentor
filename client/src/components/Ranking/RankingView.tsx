import { useEffect, useState } from "react";
import { AlertCircle, Lock, RefreshCw, Users } from "lucide-react";
import { Segmented } from "../Students/profile/profileParts";
import { CARD, SELECT } from "../Students/profile/profileTheme";
import {
  fetchRanking,
  RankingError,
  type RankingResponse,
  type RankKindFilter,
} from "../../services/rankingApi";
import { RankingSkeleton, SubjectPicker } from "./rankingParts";
import StudentRankingPanel from "./StudentRankingPanel";
import StaffLeaderboardPanel from "./StaffLeaderboardPanel";

// The ranking, for whoever is looking. Used by the Overall Ranking page (all
// subjects, subject picker) and by a subject's Ranking tab (subject locked).
// Which view renders is the server's decision (see services/rankingApi).

const KIND_OPTIONS: Array<{ value: RankKindFilter; label: string }> = [
  { value: "all", label: "All work" },
  { value: "assignment", label: "Assignments" },
  { value: "quiz", label: "Quizzes" },
  { value: "recorded", label: "Recorded" },
];

export interface RankingFiltersState {
  subjectId: string | null;
  kind: RankKindFilter;
  classGroupId: number | null;
}

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
    fetchRanking({ subjectId, kind: filters.kind, classGroupId: filters.classGroupId })
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
  }, [subjectId, filters.kind, filters.classGroupId, reloadKey]);

  const set = (patch: Partial<RankingFiltersState>) => onChange({ ...filters, ...patch });
  const selectSubject = lockedSubjectId ? undefined : (id: string | null) => set({ subjectId: id, classGroupId: null });

  const isStaff = data?.view === "staff";
  const classGroups = data?.view === "staff" ? data.class_groups : [];

  return (
    <div className="space-y-4 min-w-0">
      {/* Filters */}
      <div className={`${CARD} p-3 sm:p-4 space-y-3`}>
        {!lockedSubjectId && data && data.available_subjects.length > 0 && (
          <SubjectPicker subjects={data.available_subjects} value={subjectId} onChange={(id) => selectSubject?.(id)} />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Kind of work" value={filters.kind} options={KIND_OPTIONS} onChange={(kind) => set({ kind })} />
          {isStaff && classGroups.length > 1 && (
            <select
              aria-label="Class"
              value={filters.classGroupId ?? ""}
              onChange={(e) => set({ classGroupId: e.target.value ? Number(e.target.value) : null })}
              className={SELECT}
            >
              <option value="">All classes</option>
              {classGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {data?.view === "student" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark/70 sm:ml-auto">
              <Lock className="w-3.5 h-3.5" />
              Private to you
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
            <StaffLeaderboardPanel data={data} scopedToSubject={!!subjectId} onSelectSubject={selectSubject ?? undefined} />
          )}
        </div>
      ) : null}
    </div>
  );
}
