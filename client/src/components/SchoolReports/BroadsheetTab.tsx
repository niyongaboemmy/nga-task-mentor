import { useMemo, useState } from "react";
import { Search, Table2 } from "lucide-react";
import type { SchoolReports } from "../../services/reportCardWorkflowApi";
import EmptyState from "../ui/EmptyState";
import { ExportActions, Section } from "./shared";
import { markTone, num, pct, position, tableCls, tableWrap, td, tdNum, th, thNum } from "./format";

// Students × subjects for the term, as heads of school print it: subject
// scores, total, average, grade, position in class, passed/failed counts and
// attendance, with each subject's mean / highest / lowest / pass rate below.

const sticky = "sticky left-0 z-10 bg-card-light dark:bg-[#1c2635] print:static print:bg-transparent";

export default function BroadsheetTab({ data, onExport }: { data: SchoolReports; onExport: () => void }) {
  const [query, setQuery] = useState("");
  const { subjects, students, subject_stats } = data.broadsheet;
  const showClass = data.class_group_id == null && data.classes.length > 1;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.registration_number ?? "").toLowerCase().includes(q),
    );
  }, [students, query]);

  const statOf = (id: number) => subject_stats.find((s) => s.subject_id === id);

  return (
    <Section
      title="Broadsheet"
      description={`${students.length} student${students.length !== 1 ? "s" : ""} × ${subjects.length} subject${
        subjects.length !== 1 ? "s" : ""
      } · pass mark ${data.pass_mark}% · position is within the class`}
      actions={<ExportActions what="the broadsheet" onCsv={onExport} disabled={students.length === 0} />}
    >
      {students.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-6 w-6" />}
          title="No report cards for this period"
          description="The broadsheet fills in once report cards exist for the term."
        />
      ) : (
        <>
          <label className="relative mb-3 block max-w-xs print:hidden">
            <span className="sr-only">Search students</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary-light dark:text-text-secondary-dark" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or registration no."
              className="w-full rounded-lg border border-border-light bg-card-light py-1.5 pl-8 pr-3 text-sm text-text-primary-light focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-border-dark/50 dark:bg-card-dark/30 dark:text-text-primary-dark"
            />
          </label>
          <div className={tableWrap}>
            <table className={tableCls}>
              <thead>
                <tr>
                  <th scope="col" className={`${th} ${sticky} min-w-[160px]`}>
                    Student
                  </th>
                  {showClass && <th className={th}>Class</th>}
                  {subjects.map((s) => (
                    <th key={s.subject_id} scope="col" className={`${thNum} max-w-[120px] truncate`} title={s.name}>
                      {s.name}
                    </th>
                  ))}
                  <th className={thNum}>Total</th>
                  <th className={thNum}>Average</th>
                  <th className={thNum}>Grade</th>
                  <th className={thNum}>Position</th>
                  <th className={thNum}>Passed</th>
                  <th className={thNum}>Failed</th>
                  <th className={thNum}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.student_id} className="hover:bg-surface-light dark:hover:bg-white/[0.03]">
                    <th scope="row" className={`${td} ${sticky} text-left font-semibold`}>
                      <span className="block max-w-[200px] truncate">{s.name}</span>
                      {s.registration_number && (
                        <span className="block text-[11px] font-normal text-text-secondary-light dark:text-text-secondary-dark">
                          {s.registration_number}
                        </span>
                      )}
                    </th>
                    {showClass && <td className={td}>{s.class_name ?? "—"}</td>}
                    {subjects.map((sub) => {
                      const v = s.subjects[sub.subject_id];
                      return (
                        <td key={sub.subject_id} className={`${tdNum} ${markTone(v, data.pass_mark)}`}>
                          {num(v)}
                        </td>
                      );
                    })}
                    <td className={tdNum}>{num(s.total)}</td>
                    <td className={`${tdNum} font-semibold ${markTone(s.average, data.pass_mark)}`}>{num(s.average)}</td>
                    <td className={`${tdNum} font-semibold`}>{s.grade ?? "—"}</td>
                    <td className={tdNum}>{position(s.position, s.position_of)}</td>
                    <td className={`${tdNum} text-emerald-700 dark:text-emerald-400`}>{s.passed}</td>
                    <td className={`${tdNum} ${s.failed > 0 ? "text-red-600 dark:text-red-400" : ""}`}>{s.failed}</td>
                    <td className={tdNum}>{pct(s.attendance_rate)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className={`${td} text-center text-text-secondary-light dark:text-text-secondary-dark`} colSpan={subjects.length + 8 + (showClass ? 1 : 0)}>
                      No student matches “{query}”.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-surface-light dark:bg-white/[0.03]">
                {(
                  [
                    ["Subject mean", "mean"],
                    ["Highest", "max"],
                    ["Lowest", "min"],
                    ["Pass rate", "pass_rate"],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key}>
                    <th scope="row" className={`${td} ${sticky} bg-surface-light text-left text-xs font-semibold dark:bg-[#1c2635]`}>
                      {label}
                    </th>
                    {showClass && <td className={td} />}
                    {subjects.map((sub) => {
                      const v = statOf(sub.subject_id)?.[key] ?? null;
                      return (
                        <td key={sub.subject_id} className={`${tdNum} text-xs font-semibold`}>
                          {key === "pass_rate" ? pct(v) : num(v)}
                        </td>
                      );
                    })}
                    <td className={td} colSpan={7} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
