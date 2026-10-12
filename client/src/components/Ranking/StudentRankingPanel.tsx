import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Clock3, Sparkles } from "lucide-react";
import { CARD, KIND_META } from "../Students/profile/profileTheme";
import { ordinal, type StudentRanking, type StudentSubjectView, type Suggestion } from "../../services/rankingApi";
import { HowItWorks } from "./rankingParts";

// What a student sees, top to bottom: their place and two numbers, one table
// of subjects (a row opens that subject), then a couple of calm next steps.
// Filters live in RankingView's toolbar. Never anyone else's name or mark —
// the server doesn't send them.
//
// Tone: read by students who may be behind, so nothing is red. Late work is
// one neutral note with a way forward; marks below the pass mark are amber.

const PASS_MARK = 50;

const ink = {
  primary: "text-text-primary-light dark:text-text-primary-dark",
  secondary: "text-text-secondary-light dark:text-text-secondary-dark/70",
  muted: "text-text-secondary-light/70 dark:text-text-secondary-dark/50",
};

const barColor = (score: number | null) => (score !== null && score < PASS_MARK ? "bg-amber-400" : "bg-blue-600");
const clamp = (n: number) => Math.min(100, Math.max(0, n));

interface Props {
  data: StudentRanking;
  /** Open one subject's ranking (the page filters; the course tab passes nothing). */
  onSelectSubject?: (courseId: string) => void;
  scopedToSubject: boolean;
}

export default function StudentRankingPanel({ data, onSelectSubject, scopedToSubject }: Props) {
  const { subjects, suggestions, pending } = data;
  const subject = scopedToSubject ? subjects[0] ?? null : null;
  const awaiting = pending.filter((p) => p.status === "awaiting_mark").length;

  return (
    <div className="space-y-5">
      <Summary data={data} subjectName={subject?.name ?? null} awaiting={awaiting} />
      {subject ? <SubjectDetail subject={subject} /> : <SubjectsTable subjects={subjects} onOpen={onSelectSubject} />}
      <NextSteps suggestions={suggestions} />
      <HowItWorks audience="student" />
    </div>
  );
}

// ─── Summary: place · average · marked ────────────────────────────────────────

function Summary({ data, subjectName, awaiting }: { data: StudentRanking; subjectName: string | null; awaiting: number }) {
  const { overall } = data;
  const ranked = overall.rank !== null && overall.ranked_count > 0;
  // Older payloads have no cohort; treat them as the subject cohort.
  const cohort = data.cohort?.type === "class_group" ? data.cohort.class_group_name : null;
  return (
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Your position">
      <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-sm">
        <p className="text-sm text-white/80">{subjectName ? `Your place in ${subjectName}` : `Your place${cohort ? ` in ${cohort}` : ""}`}</p>
        {ranked ? (
          <>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">
              {ordinal(overall.rank!)} <span className="text-lg font-medium text-white/70">of {overall.ranked_count}</span>
            </p>
            <p className="mt-1 text-sm text-white/90">{overall.band ?? "Ranked this term"}</p>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-extrabold">Not ranked yet</p>
            <p className="mt-1 text-sm text-white/90">Get your first marks to be ranked</p>
          </>
        )}
      </div>
      <div className={`${CARD} p-5`}>
        <p className={`text-sm ${ink.secondary}`}>Average</p>
        <p className={`mt-1 text-4xl font-extrabold tabular-nums ${ink.primary}`}>{overall.score !== null ? `${overall.score}%` : "—"}</p>
        <div className="mt-3 h-1.5 rounded-full bg-surface-light dark:bg-white/10">
          {overall.score !== null && <div className={`h-1.5 rounded-full ${barColor(overall.score)}`} style={{ width: `${clamp(overall.score)}%` }} />}
        </div>
        <p className={`mt-2 text-xs ${ink.secondary}`}>
          {overall.class_average !== null ? `Class average ${overall.class_average}%` : "Class average hidden until more students are marked"}
        </p>
      </div>
      <div className={`${CARD} p-5`}>
        <p className={`text-sm ${ink.secondary}`}>Marked work</p>
        <p className={`mt-1 text-4xl font-extrabold tabular-nums ${ink.primary}`}>{overall.marked_items}</p>
        <p className={`mt-1 text-sm ${ink.secondary}`}>
          {ranked && overall.points_to_next !== null && overall.rank! > 1
            ? `${overall.points_to_next} points to move up a place`
            : awaiting
              ? `${awaiting} more waiting for a mark`
              : "Everything handed in is marked"}
        </p>
      </div>
    </section>
  );
}

// ─── Subjects table ───────────────────────────────────────────────────────────

function SubjectsTable({ subjects, onOpen }: { subjects: StudentSubjectView[]; onOpen?: (courseId: string) => void }) {
  const [showQuiet, setShowQuiet] = useState(false);
  const marked = subjects.filter((s) => s.score !== null).sort((a, b) => b.score! - a.score!);
  const openOnly = subjects.filter((s) => s.score === null && s.pending_count > 0);
  const quiet = subjects.filter((s) => s.score === null && s.pending_count === 0);
  const rows = [...marked, ...openOnly];
  const open = (id: string) => onOpen?.(id);

  return (
    <section className={`${CARD} overflow-hidden`} aria-labelledby="subjects-heading">
      <div className="flex items-center justify-between px-5 pt-5">
        <h3 id="subjects-heading" className={`font-semibold ${ink.primary}`}>
          Subjects
        </h3>
        {onOpen && rows.length > 0 && <span className={`text-xs ${ink.secondary}`}>Click a row for details</span>}
      </div>
      {rows.length === 0 ? (
        <p className={`px-5 py-8 text-sm text-center ${ink.secondary}`}>Your subjects appear here once work is set or marked.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`text-[11px] uppercase tracking-wider ${ink.muted}`}>
              <tr>
                <th className="px-5 py-2 font-semibold w-14">#</th>
                <th className="px-2 py-2 font-semibold">Subject</th>
                <th className="px-2 py-2 font-semibold">Your mark</th>
                <th className="hidden md:table-cell px-2 py-2 font-semibold">Place</th>
                <th className="hidden md:table-cell px-5 py-2 font-semibold text-right">Open work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark/30">
              {rows.map((s, i) => (
                <tr
                  key={s.course_id}
                  onClick={onOpen ? () => open(s.course_id) : undefined}
                  onKeyDown={
                    onOpen
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open(s.course_id);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onOpen ? 0 : undefined}
                  aria-label={onOpen ? `${s.name} details` : undefined}
                  className={onOpen ? "cursor-pointer hover:bg-surface-light dark:hover:bg-white/5 focus:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-900/20" : ""}
                >
                  <td className="px-5 py-3.5">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                        s.score === null
                          ? "bg-surface-light dark:bg-white/10 text-text-secondary-light dark:text-text-secondary-dark/60"
                          : i === 0
                            ? "bg-blue-600 text-white"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300"
                      }`}
                    >
                      {s.score === null ? "–" : i + 1}
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <p className={`font-medium ${ink.primary}`}>{s.name}</p>
                    {s.code && <p className={`text-xs ${ink.secondary}`}>{s.code}</p>}
                  </td>
                  <td className="px-2 py-3.5">
                    {s.score === null ? (
                      <span className={ink.muted}>No marks yet</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className={`w-10 font-semibold tabular-nums ${s.score < PASS_MARK ? "text-amber-600 dark:text-amber-400" : ink.primary}`}>{s.score}%</span>
                        <div className="relative h-1.5 w-28 rounded-full bg-surface-light dark:bg-white/10">
                          <div className={`h-1.5 rounded-full ${barColor(s.score)}`} style={{ width: `${clamp(s.score)}%` }} />
                          {s.class_average !== null && (
                            <span
                              title={`Class average ${s.class_average}%`}
                              className="absolute -top-1 -bottom-1 w-0.5 rounded bg-gray-500 dark:bg-gray-300"
                              style={{ left: `calc(${clamp(s.class_average)}% - 1px)` }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className={`hidden md:table-cell px-2 py-3.5 ${s.rank !== null ? ink.primary : ink.muted}`}>
                    {s.rank !== null ? `${ordinal(s.rank)} of ${s.ranked_count}` : "—"}
                  </td>
                  <td className={`hidden md:table-cell px-5 py-3.5 text-right tabular-nums ${s.pending_count ? ink.primary : ink.muted}`}>
                    {s.pending_count || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {quiet.length > 0 && (
        <div className={`${rows.length ? "border-t border-border-light dark:border-border-dark/30" : ""} px-5 py-3`}>
          <button
            type="button"
            aria-expanded={showQuiet}
            onClick={() => setShowQuiet((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs ${ink.secondary} hover:text-blue-600 dark:hover:text-blue-400`}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuiet ? "rotate-180" : ""}`} />
            {quiet.length} more subject{quiet.length === 1 ? "" : "s"} with nothing yet — left out, not counted as 0%
          </button>
          {showQuiet && <p className={`mt-2 text-xs leading-relaxed ${ink.secondary}`}>{quiet.map((s) => s.name).join(", ")}</p>}
        </div>
      )}
    </section>
  );
}

// ─── One subject ──────────────────────────────────────────────────────────────

function SubjectDetail({ subject: s }: { subject: StudentSubjectView }) {
  const kinds = Object.entries(s.by_kind) as Array<[keyof typeof KIND_META, { score: number; count: number }]>;
  return (
    <section className={`${CARD} p-5 space-y-5`} aria-label="Subject breakdown">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`font-semibold ${ink.primary}`}>{s.name}</h3>
          <p className={`text-xs ${ink.secondary}`}>
            {[s.code, s.class_average !== null ? `Class average ${s.class_average}%` : "Class average hidden", s.pending_count ? `${s.pending_count} open` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link to={`/courses/${s.course_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Open subject <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {kinds.length > 0 ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {kinds.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-light dark:bg-white/5 px-4 py-3">
              <p className={`text-xs ${ink.secondary}`}>
                {KIND_META[k].plural} · {v.count}
              </p>
              <p className={`text-xl font-bold tabular-nums ${v.score < PASS_MARK ? "text-amber-600 dark:text-amber-400" : ink.primary}`}>{v.score}%</p>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-sm ${ink.secondary}`}>Nothing marked in this subject yet.</p>
      )}
      {s.weakest.length > 0 && (
        <div>
          <p className={`text-sm font-medium ${ink.primary}`}>Worth reviewing</p>
          <ul className="mt-2 divide-y divide-border-light dark:divide-border-dark/30">
            {s.weakest.map((w) => (
              <li key={`${w.kind}-${w.item_id}`} className="flex items-center gap-3 py-2 text-sm">
                <span className={`flex-1 truncate ${ink.primary}`}>{w.title}</span>
                <span className={`font-semibold tabular-nums ${w.pct < PASS_MARK ? "text-amber-600 dark:text-amber-400" : ink.primary}`}>{w.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Next steps ───────────────────────────────────────────────────────────────

/** Late work as one calm note; the first tip beside it; the rest on request. */
function NextSteps({ suggestions }: { suggestions: Suggestion[] }) {
  const [more, setMore] = useState(false);
  const late = suggestions.filter((s) => s.category === "deadline");
  const tips = suggestions.filter((s) => s.category !== "deadline");
  const lead = tips.find((s) => s.category === "strength") ?? tips[0];
  const rest = tips.filter((s) => s !== lead);
  if (late.length === 0 && !lead) return null;
  const titleOf = (s: Suggestion) => s.title.replace(/^Submit\s+"(.*)"$/, "$1");

  return (
    <section aria-label="Next steps" className="space-y-3">
      <div className={`grid gap-4 ${late.length && lead ? "md:grid-cols-3" : ""}`}>
        {late.length > 0 && (
          <div className={`${CARD} p-5 ${lead ? "md:col-span-2" : ""}`}>
            <div className="flex items-start gap-3">
              <Clock3 className={`w-5 h-5 mt-0.5 shrink-0 ${ink.secondary}`} />
              <div className="min-w-0">
                <p className={`font-semibold ${ink.primary}`}>
                  {late.length} {late.length === 1 ? "piece of work is" : "pieces of work are"} past the deadline
                </p>
                <p className={`mt-1 text-sm ${ink.secondary}`}>
                  {late.map(titleOf).join(" · ")}. Ask your teacher what's still possible.
                </p>
                <Link to="/assignments?status=missed" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                  See them in Assignments <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
        {lead && <Tip suggestion={lead} />}
      </div>
      {rest.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            {more ? "Fewer tips" : `${rest.length} more tip${rest.length === 1 ? "" : "s"}`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${more ? "rotate-180" : ""}`} />
          </button>
          {more && (
            <div className="grid gap-4 md:grid-cols-3">
              {rest.map((s) => (
                <Tip key={s.id} suggestion={s} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Tip({ suggestion: s }: { suggestion: Suggestion }) {
  const strength = s.category === "strength";
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-2">
        {strength && <Sparkles className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />}
        <p className={`font-semibold ${ink.primary}`}>{strength ? "Keep it up" : s.title}</p>
      </div>
      <p className={`mt-1 text-sm leading-relaxed line-clamp-3 ${ink.secondary}`} title={s.detail}>
        {s.detail}
      </p>
      {s.action && (
        <Link to={s.action.href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          {s.action.label} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
