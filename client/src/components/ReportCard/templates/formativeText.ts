import type { ReportCardWorkflowApi } from "../../../services/reportCardWorkflowApi";

export type FormativeResult = Awaited<ReturnType<typeof ReportCardWorkflowApi.mapFormative>>["data"];

/** "x quizzes, y assignments and z recorded marks". */
export const describeKinds = (k: FormativeResult["by_kind"]) =>
  [
    k.quiz ? `${k.quiz} quiz${k.quiz === 1 ? "" : "zes"}` : "",
    k.assignment ? `${k.assignment} assignment${k.assignment === 1 ? "" : "s"}` : "",
    k.manual ? `${k.manual} recorded mark${k.manual === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");

