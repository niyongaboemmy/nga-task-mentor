import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import { Bar, ExportActions, Section } from "./shared";
import { markTone, num, pct, signed, tableCls, tableWrap, td, tdNum, th, thNum } from "./format";

// Term over term: the overall mean per term, subjects and classes per term,
// and the students whose average moved most since the previous term.

const LIST_SIZE = 10;

type Series = Array<{ term: string; mean: number | null; n: number }>;
const meanIn = (terms: Series, term: string) => terms.find((t) => t.term === term)?.mean ?? null;

function TermTable({ title, rows, terms, passMark }: { title: string; rows: Array<{ key: string | number; name: string; terms: Series }>; terms: string[]; passMark: number }) {
  return (
    <Section title={title} description="Mean per term; the last column is the change across the period shown">
      <div className={tableWrap}>
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={th}>{title.startsWith("Class") ? "Class" : "Subject"}</th>
              {terms.map((t) => (
                <th key={t} className={thNum}>
                  {t}
                </th>
              ))}
              <th className={thNum}>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const first = meanIn(r.terms, terms[0]);
              const last = meanIn(r.terms, terms[terms.length - 1]);
              const change = first != null && last != null ? last - first : null;
              return (
                <tr key={r.key}>
                  <td className={`${td} font-medium`}>{r.name}</td>
                  {terms.map((t) => {
                    const v = meanIn(r.terms, t);
                    return (
                      <td key={t} className={`${tdNum} ${markTone(v, passMark)}`}>
                        {num(v)}
                      </td>
                    );
                  })}
                  <td
                    className={`${tdNum} font-semibold ${
                      change == null || Math.round(change * 10) === 0 ? "" : change > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {signed(change)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ChangeList({
  title,
  icon,
  rows,
  empty,
}: {
  title: string;
  icon: ReactNode;
  rows: SchoolReports["trends"]["improvement"];
  empty: string;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{empty}</p>
      ) : (
        <ol className="divide-y divide-border-light dark:divide-border-dark/30">
          {rows.map((r) => (
            <li key={r.student_id} className="flex items-center gap-3 py-2 text-sm">
              {icon}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-text-primary-light dark:text-text-primary-dark">{r.name}</span>
                {r.class_name && <span className="block text-xs text-text-secondary-light dark:text-text-secondary-dark">{r.class_name}</span>}
              </span>
              <span className="text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                {num(r.previous)} → {num(r.current)}
              </span>
              <span
                className={`w-14 text-right font-semibold tabular-nums ${r.change > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {signed(r.change)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export default function TrendsTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const t = data.trends;
  const withData = t.overall.filter((o) => o.mean != null);

  if (t.terms.length < 2 || withData.length < 2) {
    return (
      <Section title="Trends" actions={<ExportActions what="trends" onCsv={onExport} disabled />}>
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Only one term so far"
          description="Trends need report cards from at least two terms of this academic year. They appear here once the next term's cards exist."
        />
      </Section>
    );
  }

  const improved = t.improvement.filter((i) => i.change > 0).slice(0, LIST_SIZE);
  const dropped = [...t.improvement]
    .filter((i) => i.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, LIST_SIZE);
  const since = t.previous_term ? `since ${t.previous_term}` : "since the previous term";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportActions what="trends" onCsv={onExport} />
      </div>

      <Section title="Overall mean by term">
        <ul className="space-y-2">
          {t.overall.map((o) => (
            <li key={o.term} className="grid grid-cols-[minmax(5rem,8rem)_1fr_7rem] items-center gap-3 text-sm">
              <span className="truncate font-medium text-text-primary-light dark:text-text-primary-dark">{o.term}</span>
              <Bar value={o.mean} label={`${o.term}: mean ${num(o.mean)}`} />
              <span className="text-right text-xs tabular-nums text-text-secondary-light dark:text-text-secondary-dark">
                <span className={`font-semibold ${markTone(o.mean, data.pass_mark) || "text-text-primary-light dark:text-text-primary-dark"}`}>{pct(o.mean)}</span> · {pct(o.pass_rate)} pass
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChangeList
          title={`Most improved ${since}`}
          icon={<TrendingUp className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
          rows={improved}
          empty="Nobody's average went up."
        />
        <ChangeList
          title={`Biggest drops ${since}`}
          icon={<TrendingDown className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" aria-hidden />}
          rows={dropped}
          empty="Nobody's average went down."
        />
      </div>

      <TermTable
        title="Subjects by term"
        terms={t.terms}
        passMark={data.pass_mark}
        rows={t.subjects.map((s) => ({ key: s.subject_id, name: s.name, terms: s.terms }))}
      />
      <TermTable
        title="Classes by term"
        terms={t.terms}
        passMark={data.pass_mark}
        rows={t.classes.map((c) => ({ key: c.class_group_id ?? c.name, name: c.name, terms: c.terms }))}
      />
    </div>
  );
}
