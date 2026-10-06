import React, { useState } from "react";
import { CheckCircle, XCircle, EyeOff, ChevronDown, ChevronUp, Clock } from "lucide-react";

/**
 * One test case as the server reports it (quiz_attempts.grading_details or a
 * run-tests response). For students, hidden tests arrive as
 * {testCaseId, is_hidden, passed, points} only.
 */
export interface CodeTestResult {
  testCaseId?: string | number | null;
  is_hidden?: boolean;
  passed: boolean | null;
  points?: number | null;
  input?: string | null;
  expected?: string | null;
  actual?: string | null;
  error?: string | null;
  status?: string | null;
}

export interface CodeGradingDetails {
  testResults?: CodeTestResult[];
  passedTests?: number;
  totalTests?: number;
  grade_status?: string;
  pending_reason?: string;
}

/** The test results stored with an attempt, or null when there are none. */
function testResultsOf(details: unknown): CodeGradingDetails | null {
  let d = details as (CodeGradingDetails & { test_results?: CodeTestResult[] }) | string | null;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== "object") return null;
  const tests = d.testResults || d.test_results;
  if (!Array.isArray(tests) && !d.pending_reason) return null;
  return { ...d, testResults: Array.isArray(tests) ? tests : [] };
}

const Block: React.FC<{ label: string; value: string; tone?: string }> = ({
  label,
  value,
  tone = "bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200",
}) => (
  <div>
    <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
    <pre className={`mt-1 rounded-lg p-2 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto ${tone}`}>
      {value}
    </pre>
  </div>
);

/**
 * Per-test pass/fail list for a coding or algorithmic answer, used on the
 * student results page and the teacher's submission view.
 */
export const CodeTestResults: React.FC<{ details: unknown; title?: string }> = ({
  details,
  title = "Test results",
}) => {
  const parsed = testResultsOf(details);
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (!parsed) return null;
  const tests = parsed.testResults || [];
  const passed = parsed.passedTests ?? tests.filter((t) => t.passed).length;
  const total = parsed.totalTests ?? tests.length;

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 p-4" data-testid="code-test-results">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-text-primary-light dark:text-text-primary-dark">
          {title}
        </span>
        {total > 0 && (
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {passed}/{total} passed
          </span>
        )}
      </div>
      {parsed.pending_reason && (
        <div className="flex items-center gap-2 mb-3 text-xs text-amber-700 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5" />
          {parsed.pending_reason}
        </div>
      )}
      <div className="space-y-2">
        {tests.map((t, i) => {
          const hasDetail =
            !t.is_hidden && (t.input != null || t.expected != null || t.actual != null || t.error != null);
          const expanded = open.has(i);
          return (
            <div
              key={`${t.testCaseId ?? i}`}
              className={`rounded-xl border text-sm ${
                t.passed
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10"
                  : "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10"
              }`}
            >
              <button
                type="button"
                disabled={!hasDetail}
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2">
                  {t.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="font-medium">Test {i + 1}</span>
                  {t.is_hidden && (
                    <span className="flex items-center gap-1 text-[10px] uppercase text-gray-500">
                      <EyeOff className="w-3 h-3" /> hidden
                    </span>
                  )}
                  {!t.passed && !t.is_hidden && (t.error || t.status) && (
                    <span className="text-[11px] text-rose-600 truncate max-w-[16rem]">
                      {t.error || t.status}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-gray-500">
                  {t.points != null && <span>{t.points} pt{Number(t.points) === 1 ? "" : "s"}</span>}
                  {hasDetail && (expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                </span>
              </button>
              {expanded && hasDetail && (
                <div className="px-3 pb-3 space-y-2">
                  {t.input != null && <Block label="Input" value={String(t.input)} />}
                  {t.expected != null && <Block label="Expected" value={String(t.expected)} />}
                  {t.actual != null && <Block label="Output" value={String(t.actual)} />}
                  {t.error != null && !t.passed && (
                    <Block label="Error" value={String(t.error)} tone="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CodeTestResults;
