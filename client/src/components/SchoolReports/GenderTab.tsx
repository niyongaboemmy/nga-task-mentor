import { Info, Users } from "lucide-react";
import type { Gender, SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import { ExportActions, Section } from "./shared";
import { gapText, markTone, num, pct, signed, tableCls, tableWrap, td, tdNum, th, thNum } from "./format";

// Girls vs boys: headline tiles, the gap, then per subject and per class.
// "Gap" is always female − male, so a positive gap means girls are ahead.

const LABEL: Record<Gender, string> = { female: "Girls", male: "Boys", unknown: "Gender not recorded" };

export default function GenderTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const g = data.gender;
  const order: Gender[] = g.unknown_count > 0 || g.overall.unknown.students > 0 ? ["female", "male", "unknown"] : ["female", "male"];

  if (data.with_marks === 0) {
    return (
      <Section title="Gender" actions={<ExportActions what="the gender report" onCsv={onExport} disabled />}>
        <EmptyState icon={<Users className="h-6 w-6" />} title="No marks on report cards yet" description="The gender comparison appears once report cards carry marks." />
      </Section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportActions what="the gender report" onCsv={onExport} />
      </div>

      {g.unknown_count > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
          role="note"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>
            Gender is missing in MIS for {g.unknown_count} student{g.unknown_count !== 1 ? "s" : ""}. They are left out of the girls/boys
            comparison and shown as “not recorded”. Fix it on their MIS profiles.
          </span>
        </div>
      )}

      <div className={`grid gap-3 ${order.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {order.map((k) => {
          const s = g.overall[k];
          return (
            <div key={k} className="rounded-xl border border-border-light bg-card-light p-4 dark:border-border-dark/40 dark:bg-card-dark/30 print:break-inside-avoid">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">{LABEL[k]}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${markTone(s.mean, data.pass_mark) || "text-text-primary-light dark:text-text-primary-dark"}`}>
                {pct(s.mean)}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-text-secondary-light dark:text-text-secondary-dark">Students</dt>
                  <dd className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{s.students}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary-light dark:text-text-secondary-dark">With marks</dt>
                  <dd className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{s.n}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary-light dark:text-text-secondary-dark">Pass rate</dt>
                  <dd className="font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark">{pct(s.pass_rate)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <Section title="Gender gap" description="Female mean minus male mean; positive means girls are ahead">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300" data-testid="gender-gap">
            {gapText(g.gap)}
          </p>
          <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Pass rate: {g.pass_rate_gap == null ? "—" : `${gapText(g.pass_rate_gap, " pts")}`}
          </p>
        </div>
      </Section>

      <Section title="By subject">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>Subject</th>
                <th className={thNum}>Girls (n)</th>
                <th className={thNum}>Girls mean</th>
                <th className={thNum}>Boys (n)</th>
                <th className={thNum}>Boys mean</th>
                <th className={thNum}>Gap (F − M)</th>
              </tr>
            </thead>
            <tbody>
              {g.subjects.map((s) => (
                <tr key={s.subject_id}>
                  <td className={`${td} font-medium`}>{s.name}</td>
                  <td className={tdNum}>{s.female.n}</td>
                  <td className={`${tdNum} ${markTone(s.female.mean, data.pass_mark)}`}>{num(s.female.mean)}</td>
                  <td className={tdNum}>{s.male.n}</td>
                  <td className={`${tdNum} ${markTone(s.male.mean, data.pass_mark)}`}>{num(s.male.mean)}</td>
                  <td className={`${tdNum} font-semibold`}>{signed(s.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="By class">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>Class</th>
                <th className={thNum}>Girls</th>
                <th className={thNum}>Girls mean</th>
                <th className={thNum}>Boys</th>
                <th className={thNum}>Boys mean</th>
                {g.unknown_count > 0 && <th className={thNum}>Not recorded</th>}
                <th className={thNum}>Gap (F − M)</th>
              </tr>
            </thead>
            <tbody>
              {g.classes.map((c) => (
                <tr key={c.class_group_id ?? c.name}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={tdNum}>{c.female.students}</td>
                  <td className={`${tdNum} ${markTone(c.female.mean, data.pass_mark)}`}>{num(c.female.mean)}</td>
                  <td className={tdNum}>{c.male.students}</td>
                  <td className={`${tdNum} ${markTone(c.male.mean, data.pass_mark)}`}>{num(c.male.mean)}</td>
                  {g.unknown_count > 0 && <td className={tdNum}>{c.unknown.students}</td>}
                  <td className={`${tdNum} font-semibold`}>{signed(c.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
