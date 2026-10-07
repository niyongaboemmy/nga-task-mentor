import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import RankingView from "../Ranking/RankingView";
import { DEFAULT_RANKING_FILTERS, type RankingFiltersState } from "../Ranking/rankingFilters";

/**
 * A subject's Ranking tab: the Overall Ranking view locked to this subject.
 * The server checks the caller may see this subject (403 otherwise) and, for
 * a student, returns only their own position in it.
 */
export default function CourseRankingPanel({ courseId }: { courseId: string }) {
  const [filters, setFilters] = useState<RankingFiltersState>({ ...DEFAULT_RANKING_FILTERS, subjectId: courseId });

  return (
    <div className="p-1 sm:p-2 space-y-3">
      <div className="flex justify-end">
        <Link
          to="/ranking"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Overall ranking across all subjects
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <RankingView filters={filters} onChange={setFilters} lockedSubjectId={courseId} />
    </div>
  );
}
