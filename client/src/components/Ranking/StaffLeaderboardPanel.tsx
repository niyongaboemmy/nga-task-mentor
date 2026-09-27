import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronDown, Medal, Search, UserX, Users } from "lucide-react";
import { Meter, Pct, EmptyState } from "../Students/profile/profileParts";
import { CARD, KIND_META } from "../Students/profile/profileTheme";
import { STATUS_META, type PerformanceStatus, type StaffRanking } from "../../services/rankingApi";
import { HowItWorks, StatTile, StatusChip } from "./rankingParts";

// What teachers and admins see: a named leaderboard over their own subjects
// (the server only returns students with marks in them), the spread of the
// cohort, and who hasn't been marked at all.

const MEDAL = ["text-amber-400", "text-gray-400", "text-orange-400"];
const DISTRIBUTION: Array<Exclude<PerformanceStatus, "no_marks">> = ["excelling", "on_track", "needs_attention", "at_risk"];
const PAGE = 50;

interface Props {
  data: StaffRanking;
  onSelectSubject?: (courseId: string) => void;
  scopedToSubject: boolean;
}

export default function StaffLeaderboardPanel({ data, onSelectSubject, scopedToSubject }: Props) {
  const { summary, rows, unranked } = data;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PerformanceStatus | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [showUnranked, setShowUnranked] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!q || r.name.toLowerCase().includes(q) || (r.class_group_name ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query, status]);

  const total = summary.ranked_count || 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Ranked students" value={summary.ranked_count} hint={summary.unranked_count ? `${summary.unranked_count} with no marks yet` : "Everyone has marks"} />
        <StatTile label="Average" value={<Pct value={summary.average} />} hint={summary.median !== null ? `Median ${summary.median}%` : undefined} />
        <StatTile label="Highest" value={<Pct value={summary.highest} />} />
        <StatTile label="Lowest" value={<Pct value={summary.lowest} />} />
        <StatTile label="At risk" value={summary.distribution.at_risk} accent={summary.distribution.at_risk ? STATUS_META.at_risk.color : undefined} hint="Below 50%" />
      </div>

      {summary.ranked_count > 0 && (
        <section className={`${CARD} p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Spread</h3>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-white/5" role="img" aria-label="Students by performance band">
            {DISTRIBUTION.map((k) =>
              summary.distribution[k] ? (
                <div key={k} style={{ width: `${(summary.distribution[k] / total) * 100}%`, backgroundColor: STATUS_META[k].color }} title={`${STATUS_META[k].label}: ${summary.distribution[k]}`} />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {DISTRIBUTION.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatus((s) => (s === k ? "all" : k))}
                aria-pressed={status === k}
                className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-semibold border transition-colors ${
                  status === k ? "border-current" : "border-transparent bg-gray-50 dark:bg-white/5"
                }`}
                style={{ color: STATUS_META[k].color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_META[k].color }} />
                {STATUS_META[k].label}
                <span className="tabular-nums opacity-80">{summary.distribution[k]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={`${CARD} overflow-hidden`}>
        <header className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">Leaderboard</h3>
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
              {filtered.length === rows.length ? `${rows.length} students` : `${filtered.length} of ${rows.length}`}
            </span>
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search student or class…"
              aria-label="Search students"
              className="w-full h-9 pl-9 pr-3 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-text-primary-light dark:text-text-primary-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </header>

        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No marked work yet">
            Students appear here once an assignment, quiz or recorded assessment is marked for the selected period.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No students match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60 bg-gray-50/70 dark:bg-white/[0.02]">
                  <th className="px-4 py-2.5 w-16 font-semibold">Rank</th>
                  <th className="px-2 py-2.5 font-semibold">Student</th>
                  <th className="px-2 py-2.5 font-semibold w-48 hidden md:table-cell">Score</th>
                  <th className="px-2 py-2.5 font-semibold hidden lg:table-cell">By kind</th>
                  <th className="px-2 py-2.5 font-semibold text-right hidden sm:table-cell">Marked</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, limit).map((r) => (
                  <tr key={r.key} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                        {r.rank <= 3 && <Medal className={`w-4 h-4 ${MEDAL[r.rank - 1]}`} />}
                        {r.rank}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 min-w-[10rem]">
                      {r.mis_user_id ? (
                        <Link to={`/students/${r.mis_user_id}`} className="font-semibold text-text-primary-light dark:text-text-primary-dark hover:text-blue-600 dark:hover:text-blue-400">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{r.name}</span>
                      )}
                      <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                        {r.class_group_name ?? "—"}
                        {!scopedToSubject && ` · ${r.subjects_marked} subject${r.subjects_marked === 1 ? "" : "s"}`}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Pct value={r.score} className="font-bold w-12" />
                        <div className="flex-1">
                          <Meter value={r.score} reference={summary.average} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(Object.entries(r.by_kind) as Array<[keyof typeof KIND_META, number]>).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                            {KIND_META[k].plural}
                            <Pct value={v} className="font-semibold" />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-text-secondary-light dark:text-text-secondary-dark hidden sm:table-cell">{r.marked_items}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="md:hidden mr-2"><Pct value={r.score} className="font-bold" /></span>
                      <StatusChip status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > limit && (
              <div className="p-3 text-center border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {!scopedToSubject && data.subjects.length > 1 && (
        <section className={`${CARD} p-4 sm:p-5`}>
          <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark mb-3">Subject averages</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...data.subjects]
              .filter((s) => s.ranked_count > 0)
              .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
              .map((s) => (
                <li key={s.course_id}>
                  <button
                    type="button"
                    onClick={() => onSelectSubject?.(s.course_id)}
                    disabled={!onSelectSubject}
                    className="w-full text-left rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors disabled:cursor-default"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate flex-1 text-text-primary-light dark:text-text-primary-dark">{s.name}</span>
                      <Pct value={s.average} className="text-sm font-bold" />
                    </div>
                    <div className="mt-2"><Meter value={s.average} /></div>
                    <p className="mt-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">{s.ranked_count} ranked</p>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {unranked.length > 0 && (
        <section className={`${CARD} p-4 sm:p-5`}>
          <button type="button" onClick={() => setShowUnranked((v) => !v)} className="w-full flex items-center gap-2 text-left" aria-expanded={showUnranked}>
            <UserX className="w-5 h-5 text-gray-400" />
            <h3 className="text-base font-bold text-text-primary-light dark:text-text-primary-dark">Not ranked yet</h3>
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">{unranked.length} enrolled with no marked work</span>
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showUnranked ? "rotate-180" : ""}`} />
          </button>
          {showUnranked && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {unranked.map((u) => (
                <li key={u.key} className="text-sm truncate">
                  {u.mis_user_id ? (
                    <Link to={`/students/${u.mis_user_id}`} className="hover:text-blue-600 dark:hover:text-blue-400 text-text-primary-light dark:text-text-primary-dark">{u.name}</Link>
                  ) : (
                    u.name
                  )}
                  {u.class_group_name && <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60"> · {u.class_group_name}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <HowItWorks audience="staff" />
    </div>
  );
}
