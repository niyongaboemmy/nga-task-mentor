import { useEffect } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import Drawer from "../ui/Drawer";
import type { BroadsheetStudent } from "./broadsheetFilters";
import { STATUS_LABEL } from "./broadsheetFilters";
import { num, pct, position, round1 } from "./format";

// One student's term at a glance, opened from a broadsheet row: headline
// numbers, every subject against the class mean (the blue tick), strongest
// and weakest subjects. ← / → (or the buttons) step through the rows shown.

const GENDER = { female: "Girl", male: "Boy", unknown: null } as const;

export default function StudentDrawer({
  student,
  subjects,
  classMeans,
  passMark,
  onClose,
  onPrev,
  onNext,
  index,
  count,
}: {
  student: BroadsheetStudent | null;
  subjects: Array<{ subject_id: number; name: string }>;
  classMeans: Map<number, number | null>;
  passMark: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  index: number;
  count: number;
}) {
  useEffect(() => {
    if (!student) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [student, onPrev, onNext]);

  if (!student) return null;
  const marks = subjects
    .map((s) => ({ ...s, value: student.subjects[s.subject_id] ?? null, mean: classMeans.get(s.subject_id) ?? null }))
    .filter((m) => m.value != null)
    .sort((a, b) => b.value! - a.value!);
  const strongest = marks[0];
  const weakest = marks.length > 1 ? marks[marks.length - 1] : null;
  const failing = marks.filter((m) => m.value! < passMark);

  const navBtn =
    "inline-flex h-8 items-center gap-1 rounded-lg border border-border-light px-2.5 text-xs font-semibold text-text-primary-light hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark/50 dark:text-text-primary-dark";

  return (
    <Drawer
      open
      onClose={onClose}
      title={student.name}
      width="max-w-[520px]"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button type="button" className={navBtn} onClick={onPrev} disabled={!onPrev} aria-label="Previous student">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Previous
          </button>
          <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
            {index + 1} of {count}
          </span>
          <button type="button" className={navBtn} onClick={onNext} disabled={!onNext} aria-label="Next student">
            Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      }
    >
      <div className="space-y-5" data-testid="student-drawer">
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          {[student.registration_number, student.class_name, GENDER[student.gender], STATUS_LABEL[student.status] ?? student.status].filter(Boolean).join(" · ")}
        </p>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Average", pct(student.average), student.average != null && student.average < passMark],
              ["Grade", student.grade ?? "—", false],
              ["Position", position(student.position, student.position_of), false],
              ["Attendance", pct(student.attendance_rate), student.attendance_rate != null && student.attendance_rate < 85],
            ] as const
          ).map(([label, value, bad]) => (
            <div key={label} className="rounded-xl border border-border-light p-3 dark:border-border-dark/40">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">{label}</dt>
              <dd className={`mt-1 text-lg font-bold tabular-nums ${bad ? "text-red-600 dark:text-red-400" : "text-text-primary-light dark:text-text-primary-dark"}`}>{value}</dd>
            </div>
          ))}
        </dl>

        {(strongest || failing.length > 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {strongest && (
              <div className="flex items-start gap-2 rounded-xl border border-border-light p-3 text-sm dark:border-border-dark/40">
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span className="min-w-0 text-text-secondary-light dark:text-text-secondary-dark">
                  <span className="block text-xs">Strongest</span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{strongest.name}</span> · {num(strongest.value)}
                </span>
              </div>
            )}
            {weakest && (
              <div className="flex items-start gap-2 rounded-xl border border-border-light p-3 text-sm dark:border-border-dark/40">
                <TrendingDown className={`mt-0.5 h-4 w-4 shrink-0 ${weakest.value! < passMark ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} aria-hidden />
                <span className="min-w-0 text-text-secondary-light dark:text-text-secondary-dark">
                  <span className="block text-xs">Weakest</span>
                  <span className="font-semibold text-text-primary-light dark:text-text-primary-dark">{weakest.name}</span> · {num(weakest.value)}
                </span>
              </div>
            )}
          </div>
        )}

        <section aria-label="Subject marks">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">Subjects</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
              <span className="inline-block h-3 w-0.5 rounded bg-blue-900 dark:bg-blue-200" aria-hidden /> class mean
            </span>
          </div>
          {marks.length === 0 ? (
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No subject marks on this card yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {marks.map((m) => {
                const diff = m.mean != null ? round1(m.value! - m.mean) : null;
                return (
                  <li key={m.subject_id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-text-primary-light dark:text-text-primary-dark" title={m.name}>
                        {m.name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className={`font-semibold ${m.value! < passMark ? "text-red-600 dark:text-red-400" : "text-text-primary-light dark:text-text-primary-dark"}`}>{num(m.value)}</span>
                        {diff != null && (
                          <span className={`ml-1.5 text-xs ${diff < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {diff > 0 ? "+" : ""}
                            {diff}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-gray-100 dark:bg-white/10">
                      <div className={`h-full rounded-full ${m.value! < passMark ? "bg-red-500" : "bg-blue-600 dark:bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, m.value!))}%` }} />
                      {m.mean != null && (
                        <span
                          className="absolute -top-0.5 h-3 w-0.5 rounded bg-blue-900 dark:bg-blue-200"
                          style={{ left: `calc(${Math.max(0, Math.min(100, m.mean))}% - 1px)` }}
                          title={`Class mean ${num(m.mean)}`}
                          aria-hidden
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          Passed {student.passed} · failed {student.failed} · total {num(student.total)} · pass mark {passMark}%
        </p>
      </div>
    </Drawer>
  );
}
