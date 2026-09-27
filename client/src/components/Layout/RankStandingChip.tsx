import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Lock,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchRankingSummary,
  ordinal,
  STATUS_META,
  SUMMARY_TTL_MS,
  type PerformanceStatus,
  type StudentRankingSummary,
} from "../../services/rankingApi";

/**
 * Top-bar standing for a signed-in student: overall position across every
 * enrolled subject, the gap to the class, and a clear at-risk warning. The
 * popover adds the subjects at risk, the next step and a link to the full
 * Overall Ranking page. The server only ever sends the student's own numbers
 * (GET /rankings?summary=1); for anyone else it answers { view: "none" } and
 * this renders nothing.
 *
 * An at-risk chip pulses until the student opens it; the acknowledgement lasts
 * for the day and resets if the situation changes.
 */

const ACK_KEY = "tm.rank.ack";

const MESSAGE: Record<PerformanceStatus, string> = {
  excelling: "Excellent work. You're among the strongest in your class.",
  on_track: "You're on track. Keep handing work in on time.",
  needs_attention: "You're passing, but a little push will lift your average.",
  at_risk: "Your average is below the 50% pass mark. Act now to recover.",
  no_marks: "Hand in assignments and take quizzes to get ranked.",
};

const ackSignature = (s: StudentRankingSummary) =>
  `${s.status}|${s.at_risk_count}|${s.overdue_count}|${new Date().toDateString()}`;

const readAck = () => {
  try {
    return localStorage.getItem(ACK_KEY);
  } catch {
    return null;
  }
};
const writeAck = (sig: string) => {
  try {
    localStorage.setItem(ACK_KEY, sig);
  } catch {
    /* storage unavailable: the pulse just returns on the next page view */
  }
};

export default function RankStandingChip() {
  const { user } = useAuth();
  const periodKey = `${user?.id ?? "?"}|${user?.currentAcademicYear?.name ?? ""}|${user?.currentAcademicTerm?.name ?? ""}`;
  const [summary, setSummary] = useState<StudentRankingSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [open, setOpen] = useState(false);
  const [acked, setAcked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(
    (force = false) =>
      fetchRankingSummary(periodKey, { force })
        .then((res) => {
          if (res.view !== "student_summary") {
            setState("hidden");
            return;
          }
          setSummary(res);
          setAcked(readAck() === ackSignature(res));
          setState("ready");
        })
        // A failed standing isn't worth an error in the top bar.
        .catch(() => setState((s) => (s === "ready" ? s : "hidden"))),
    [periodKey],
  );

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, SUMMARY_TTL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (state === "hidden") return null;
  if (state === "loading" || !summary) {
    return (
      <div
        className="h-8 sm:h-9 w-14 sm:w-28 rounded-full bg-gray-100 dark:bg-white/5 animate-pulse"
        aria-hidden
      />
    );
  }

  const atRisk = summary.status === "at_risk";
  const meta = STATUS_META[summary.status];
  const ranked = summary.rank !== null;
  const alerting = atRisk && !acked;

  const toggle = () => {
    setOpen((v) => !v);
    if (!acked) {
      writeAck(ackSignature(summary));
      setAcked(true);
    }
  };

  const label = ranked
    ? `Your overall position: ${ordinal(summary.rank!)} of ${summary.ranked_count}, average ${summary.score}%${atRisk ? ", at risk" : ""}`
    : "Your overall position: not ranked yet";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`relative inline-flex items-center gap-1 sm:gap-1.5 h-8 sm:h-8 px-2 sm:pl-2.5 sm:pr-2.5 rounded-full border text-xs sm:text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
          atRisk
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            : "border-gray-200 bg-white text-text-primary-light hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-text-primary-dark"
        }`}
      >
        {atRisk ? (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />
        ) : (
          <Trophy
            className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
            aria-hidden
          />
        )}
        {ranked ? (
          <span className="tabular-nums whitespace-nowrap">
            {ordinal(summary.rank!)}
            <span className="hidden sm:inline font-normal opacity-60">
              /{summary.ranked_count}
            </span>
          </span>
        ) : (
          <span className="whitespace-nowrap text-xs font-medium">
            Not ranked
          </span>
        )}
        {summary.score !== null && (
          <span className="hidden sm:inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-current/20 tabular-nums">
            <span style={{ color: atRisk ? undefined : meta.color }}>
              {summary.score}%
            </span>
          </span>
        )}
        <ChevronDown
          className={`hidden sm:block w-3.5 h-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {alerting && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5"
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Your overall standing"
          className="fixed left-3 right-3 top-[4.25rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 shadow-xl z-50"
        >
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark/60">
              Overall standing · {summary.subject_count} subject
              {summary.subject_count === 1 ? "" : "s"}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div
                className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl text-white flex-shrink-0 ${atRisk ? "bg-red-600" : "bg-blue-600"}`}
              >
                {ranked ? (
                  <>
                    <span className="text-xl font-extrabold tabular-nums leading-none">
                      {ordinal(summary.rank!)}
                    </span>
                    <span className="mt-0.5 text-[10px] opacity-90">
                      of {summary.ranked_count}
                    </span>
                  </>
                ) : (
                  <Trophy className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-text-primary-light dark:text-text-primary-dark truncate">
                  {ranked ? summary.band : "Not ranked yet"}
                </p>
                <span
                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{
                    color: meta.color,
                    backgroundColor: `${meta.color}1a`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.label}
                </span>
              </div>
            </div>

            {summary.score !== null && (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/60">
                    You
                  </dt>
                  <dd
                    className="text-sm font-bold tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {summary.score}%
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/60">
                    Class
                  </dt>
                  <dd className="text-sm font-bold tabular-nums text-text-primary-light dark:text-text-primary-dark">
                    {summary.class_average !== null
                      ? `${summary.class_average}%`
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark/60">
                    Gap
                  </dt>
                  <dd
                    className={`text-sm font-bold tabular-nums inline-flex items-center gap-0.5 ${
                      summary.gap === null
                        ? "text-text-secondary-light dark:text-text-secondary-dark"
                        : summary.gap >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {summary.gap === null ? (
                      "—"
                    ) : (
                      <>
                        {summary.gap >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {summary.gap > 0 ? "+" : ""}
                        {summary.gap}
                      </>
                    )}
                  </dd>
                </div>
              </dl>
            )}

            <p className="mt-3 text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark/80">
              {MESSAGE[summary.status]}
              {summary.rank === 1
                ? " You're in 1st place."
                : summary.points_to_next !== null
                  ? ` +${summary.points_to_next} pts on your average moves you up a place.`
                  : ""}
            </p>

            {atRisk && summary.at_risk_subjects.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Below 50% in {summary.at_risk_count} subject
                  {summary.at_risk_count === 1 ? "" : "s"}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {summary.at_risk_subjects.map((s) => (
                    <li key={s.course_id}>
                      <Link
                        to={`/courses/${s.course_id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-xs text-red-800 dark:text-red-200 hover:underline"
                      >
                        <span className="truncate flex-1">{s.name}</span>
                        <span className="font-semibold tabular-nums">
                          {s.score}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.top_suggestion && (
              <div className="mt-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Next step
                </p>
                <p className="mt-0.5 text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {summary.top_suggestion.title}
                </p>
                {summary.top_suggestion.action && (
                  <Link
                    to={summary.top_suggestion.action.href}
                    onClick={() => setOpen(false)}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {summary.top_suggestion.action.label}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-white/[0.02]">
            <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark/60">
              <Lock className="w-3 h-3" />
              Only you see this
            </span>
            <Link
              to="/ranking"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Full ranking
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
