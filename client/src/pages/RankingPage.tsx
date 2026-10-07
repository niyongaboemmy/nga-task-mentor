import { useSearchParams } from "react-router-dom";
import { CalendarDays, Trophy } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import RankingView, { type RankingFiltersState, type RankingGroupBy } from "../components/Ranking/RankingView";
import type { RankKindFilter } from "../services/rankingApi";

/**
 * /ranking — Overall Ranking. Students see their own position across every
 * subject (and per subject), with what to do next; teachers and admins see a
 * leaderboard over the subjects they may see, filtered and grouped by class
 * group and grade. Filters live in the URL (?subject=&kind=&grade=&class=&group=)
 * so a subject's ranking can be bookmarked or linked.
 */

const KINDS: RankKindFilter[] = ["all", "assignment", "quiz", "recorded"];
const GROUPS: RankingGroupBy[] = ["none", "class", "grade"];

const positiveInt = (raw: string | null) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export default function RankingPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { can } = usePermissions();

  const kindParam = params.get("kind") as RankKindFilter | null;
  const groupParam = params.get("group") as RankingGroupBy | null;
  const filters: RankingFiltersState = {
    subjectId: positiveInt(params.get("subject"))?.toString() ?? null,
    kind: kindParam && KINDS.includes(kindParam) ? kindParam : "all",
    classGroupId: positiveInt(params.get("class")),
    gradeId: positiveInt(params.get("grade")),
    groupBy: groupParam && GROUPS.includes(groupParam) ? groupParam : "none",
  };

  const onChange = (next: RankingFiltersState) => {
    const p = new URLSearchParams();
    if (next.subjectId) p.set("subject", next.subjectId);
    if (next.kind !== "all") p.set("kind", next.kind);
    if (next.gradeId) p.set("grade", String(next.gradeId));
    if (next.classGroupId) p.set("class", String(next.classGroupId));
    if (next.groupBy !== "none") p.set("group", next.groupBy);
    setParams(p, { replace: true });
  };

  const termName = user?.currentAcademicTerm?.name;
  const yearName = user?.currentAcademicYear?.name;
  const periodLabel = termName && yearName ? `${yearName} · ${termName}` : null;
  // Only the wording depends on this; what the page shows is the server's call.
  const looksLikeStaff = can("ASSIGNMENTS_VIEW_SUBMISSIONS") || can("USERS_EDIT");

  return (
    <div className="space-y-4 min-w-0">
      <header className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">Overall Ranking</h1>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark/70">
              {looksLikeStaff
                ? "How your students rank on assignments, quizzes and recorded marks"
                : "Where you stand on assignments, quizzes and recorded marks, and how to improve"}
            </p>
          </div>
        </div>
        {periodLabel && (
          <span
            className="sm:ml-auto inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/5 text-text-secondary-light dark:text-text-secondary-dark/80"
            title="Change the period from the academic year/term switcher in the top bar"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {periodLabel}
          </span>
        )}
      </header>

      <RankingView filters={filters} onChange={onChange} />
    </div>
  );
}
