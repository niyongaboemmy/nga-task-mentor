import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import QuestionBankList from "./QuestionBankList";
import QuestionBankHubDashboard from "./hub/QuestionBankHubDashboard";
import { QuestionBankHubSkeleton } from "./hub/QuestionBankHubSkeleton";
import QuestionBankTabs, { type QuestionBankTab } from "./hub/QuestionBankTabs";
import {
  QuestionBankHubApiService,
  type QuestionBankOverview,
} from "../../services/questionBankHubApi";

/**
 * A subject's own question bank (/courses/:courseId/question-bank):
 * Questions (the shared paginated list) and Dashboard (the same analysis the
 * teacher hub shows, for this subject only).
 *
 * The page header already names the subject, so the list's own subject card
 * and heading are hidden. The list stays mounted while the dashboard is
 * open, so coming back keeps filters, page and scroll position. The
 * dashboard loads up front (it feeds the tab badges) and refreshes quietly
 * whenever a question is added, edited or deleted.
 */

interface QuestionBankViewProps {
  courseId: number;
}

const QuestionBankView: React.FC<QuestionBankViewProps> = ({ courseId }) => {
  const [params, setParams] = useSearchParams();
  const tab: QuestionBankTab = params.get("tab") === "dashboard" ? "dashboard" : "questions";
  const setTab = (next: QuestionBankTab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "questions") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  const [data, setData] = useState<QuestionBankOverview | null>(null);
  const [pending, setPending] = useState<"load" | "refresh" | null>("load");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (kind: "load" | "refresh") => {
      const mine = ++seq.current;
      setPending(kind);
      setError(null);
      try {
        const next = await QuestionBankHubApiService.getCourseOverview(courseId);
        if (mine !== seq.current) return;
        setData(next);
      } catch (e) {
        if (mine !== seq.current) return;
        const err = e as { response?: { data?: { message?: string } } };
        setError(err?.response?.data?.message || "Couldn't load this subject's dashboard.");
      } finally {
        if (mine === seq.current) setPending(null);
      }
    },
    [courseId],
  );

  useEffect(() => {
    load("load");
  }, [load]);

  const urgent = (data?.alerts ?? []).filter((a) => a.severity === "critical" || a.severity === "warning").length;

  return (
    <div className="space-y-4">
      <QuestionBankTabs
        active={tab}
        onChange={setTab}
        order={["questions", "dashboard"]}
        alertCount={urgent}
        questionCount={data?.totals.total ?? null}
        loading={tab === "dashboard" && pending !== null && data !== null}
      />

      <div hidden={tab !== "questions"}>
        <QuestionBankList courseId={courseId} hideCourseCard hideHeading onChanged={() => load("refresh")} />
      </div>

      {tab === "dashboard" &&
        (error && !data ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
            <button
              onClick={() => load("load")}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : !data ? (
          <QuestionBankHubSkeleton showReport={false} />
        ) : (
          <div
            className={`animate-fadeIn transition-opacity duration-300 ${pending ? "pointer-events-none opacity-60" : ""}`}
            aria-busy={pending !== null}
          >
            <QuestionBankHubDashboard
              data={data}
              refreshing={pending !== null}
              onRefresh={() => load("refresh")}
              onOpenSubject={() => setTab("questions")}
            />
          </div>
        ))}
    </div>
  );
};

export default QuestionBankView;
