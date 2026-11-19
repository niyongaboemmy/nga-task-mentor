import { BarChart3 } from "lucide-react";
import type { Distribution, SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import { Bar, ExportActions, Section, StatTile } from "./shared";
import { markTone, num, pct, tableCls, tableWrap, td, tdNum, th, thNum } from "./format";

// Overall picture, grade distribution on the school's own bands (A*…U),
// subjects side by side, classes side by side and the hardest subjects.

const countOf = (dist: Distribution, letter: string) => dist.find((d) => d.letter === letter)?.count ?? 0;

export function DistributionBars({ dist, bands }: { dist: Distribution; bands: SchoolReports["bands"] }) {
  const total = dist.reduce((acc, d) => acc + d.count, 0);
  const max = Math.max(1, ...dist.map((d) => d.count));
  return (
    <ul className="space-y-1.5">
      {bands.map((b) => {
        const count = countOf(dist, b.letter);
        return (
          <li key={b.letter} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-2 text-sm">
            <span className="font-semibold text-text-primary-light dark:text-text-primary-dark" title={b.remark}>
              {b.letter}
            </span>
            <Bar value={count} max={max} label={`${b.letter}: ${count} students`} />
            <span className="text-right text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
              {count} · {total ? Math.round((count / total) * 100) : 0}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function PerformanceTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const p = data.performance;
  const o = p.overall;
  const subjects = [...p.subjects].sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1));
  const letters = data.bands.map((b) => b.letter);

  if (data.with_marks === 0) {
    return (
      <Section title="Performance" actions={<ExportActions what="performance" onCsv={onExport} disabled />}>
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No marks on report cards yet"
          description="Averages and pass rates appear once report cards for this period carry marks."
        />
      </Section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportActions what="performance" onCsv={onExport} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Students" value={data.students} hint={`${data.with_marks} with marks`} />
        <StatTile label="Mean" value={pct(o.mean)} hint={`Median ${pct(o.median)} · SD ${num(o.sd)}`} tone={o.mean != null && o.mean < data.pass_mark ? "bad" : "default"} />
        <StatTile label="Pass rate" value={pct(o.pass_rate)} hint={`At or above ${data.pass_mark}%`} tone={o.pass_rate == null ? "default" : o.pass_rate >= 50 ? "good" : "bad"} />
        <StatTile label="Range" value={`${num(o.min)}–${num(o.max)}`} hint="Lowest to highest average" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Grade distribution" description="Student averages on the school's grading bands">
          <DistributionBars dist={o.distribution} bands={data.bands} />
        </Section>

        <Section title="Hardest subjects" description="Lowest subject means this term">
          {p.hardest_subjects.length === 0 ? (
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">No subject has marks yet.</p>
          ) : (
            <ol className="space-y-2">
              {p.hardest_subjects.map((s, i) => (
                <li key={s.subject_id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-text-primary-light dark:text-text-primary-dark">{s.name}</span>
                  <span className={`tabular-nums font-semibold ${markTone(s.mean, data.pass_mark)}`}>{pct(s.mean)}</span>
                  <span className="w-24 text-right text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                    {pct(s.pass_rate)} pass
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <Section title="Subject comparison" description="Sorted by mean, highest first">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>Subject</th>
                <th className={thNum}>n</th>
                <th className={`${th} min-w-[160px]`}>Mean</th>
                <th className={thNum}>Median</th>
                <th className={thNum}>Min</th>
                <th className={thNum}>Max</th>
                <th className={thNum}>SD</th>
                <th className={`${th} min-w-[140px]`}>Pass rate</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={tdNum}>{s.n}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Bar value={s.mean} className="flex-1" />
                      <span className={`w-12 text-right tabular-nums ${markTone(s.mean, data.pass_mark)}`}>{num(s.mean)}</span>
                    </div>
                  </td>
                  <td className={tdNum}>{num(s.median)}</td>
                  <td className={tdNum}>{num(s.min)}</td>
                  <td className={tdNum}>{num(s.max)}</td>
                  <td className={tdNum}>{num(s.sd)}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Bar value={s.pass_rate} tone="good" className="flex-1" />
                      <span className="w-12 text-right tabular-nums">{pct(s.pass_rate)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Grade counts by subject" description="How many students got each grade in each subject">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>Subject</th>
                {letters.map((l) => (
                  <th key={l} className={thNum}>
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  {letters.map((l) => {
                    const c = countOf(s.distribution, l);
                    return (
                      <td key={l} className={`${tdNum} ${c === 0 ? "text-text-secondary-light/60 dark:text-text-secondary-dark/50" : ""}`}>
                        {c}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Class comparison">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>Class</th>
                <th className={th}>Programme</th>
                <th className={thNum}>Students</th>
                <th className={`${th} min-w-[150px]`}>Mean</th>
                <th className={thNum}>Median</th>
                <th className={thNum}>Pass rate</th>
                <th className={thNum}>At risk</th>
              </tr>
            </thead>
            <tbody>
              {p.classes.map((c) => (
                <tr key={c.class_group_id ?? c.name}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={td}>{c.program_name ?? "—"}</td>
                  <td className={tdNum}>{c.students}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Bar value={c.mean} className="flex-1" />
                      <span className={`w-12 text-right tabular-nums ${markTone(c.mean, data.pass_mark)}`}>{num(c.mean)}</span>
                    </div>
                  </td>
                  <td className={tdNum}>{num(c.median)}</td>
                  <td className={tdNum}>{pct(c.pass_rate)}</td>
                  <td className={`${tdNum} ${c.at_risk > 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>{c.at_risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
