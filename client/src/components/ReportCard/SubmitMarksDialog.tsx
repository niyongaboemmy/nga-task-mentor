import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, Lock, RotateCcw, Send } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import Select from "../ui/Select";
import { ReportCardWorkflowApi, apiMessage, type ApiError, type MissingMark } from "../../services/reportCardWorkflowApi";

/**
 * A subject teacher's sign-off for one class: "my marks for this class are
 * final". Every mark still missing is listed first; each must be recorded
 * (close this, enter it, come back) or resolved as absent (counts 0) or
 * exempt (left out). Reviewers can reopen a submitted subject.
 */

type Choice = "pending" | "absent" | "exempt";

export interface SubmitMarksDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged?: (status: "open" | "submitted") => void;
  classGroupId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  term: string;
  academicYear: string;
  /** Reviewers/approvers may reopen; teachers reopen their own until review. */
  canReopen?: boolean;
}

const key = (m: MissingMark) => `${m.report_card_id}:${m.assessment_type}:${m.assessment_id}`;

export default function SubmitMarksDialog({
  open,
  onClose,
  onChanged,
  classGroupId,
  className,
  subjectId,
  subjectName,
  term,
  academicYear,
  canReopen = true,
}: SubmitMarksDialogProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"open" | "submitted">("open");
  const [returned, setReturned] = useState<string | null>(null);
  const [locked, setLocked] = useState(0);
  const [missing, setMissing] = useState<MissingMark[]>([]);
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState("");

  const params = useMemo(
    () => ({ class_group_id: classGroupId, subject_id: subjectId, term, academic_year: academicYear }),
    [classGroupId, subjectId, term, academicYear],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ReportCardWorkflowApi.signoffPreview(params);
      setStatus(res.data.status);
      setReturned(res.data.returned_reason);
      setLocked(res.data.locked_cards);
      setMissing(res.data.missing);
      setChoice({});
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't load the marks for this class."));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const unresolved = missing.filter((m) => (choice[key(m)] ?? "pending") === "pending").length;
  const setAll = (c: Choice) => setChoice(Object.fromEntries(missing.map((m) => [key(m), c])));

  const submit = async () => {
    setBusy(true);
    try {
      const resolutions = missing
        .filter((m) => choice[key(m)] === "absent" || choice[key(m)] === "exempt")
        .map((m) => ({
          report_card_id: m.report_card_id,
          assessment_type: m.assessment_type,
          assessment_id: m.assessment_id,
          status: choice[key(m)] as "absent" | "exempt",
        }));
      const res = await ReportCardWorkflowApi.signoff({ ...params, action: "submit", resolutions });
      toast.success(res.message || "Marks submitted for review.");
      setStatus("submitted");
      onChanged?.("submitted");
      onClose();
    } catch (e: unknown) {
      const left = ((e as ApiError).response?.data?.data as { missing?: MissingMark[] } | undefined)?.missing;
      if (left) {
        setMissing(left);
        toast.error(apiMessage(e, "Some marks are still missing."));
      } else {
        toast.error(apiMessage(e, "Couldn't submit the marks. Try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      const res = await ReportCardWorkflowApi.signoff({ ...params, action: "reopen", reason: reason.trim() || undefined });
      toast.success(res.message || "Subject reopened for marks.");
      setStatus("open");
      onChanged?.("open");
      await load();
    } catch (e) {
      toast.error(apiMessage(e, "Couldn't reopen this subject."));
    } finally {
      setBusy(false);
    }
  };

  const byStudent = useMemo(() => {
    const m = new Map<number, { name: string; items: MissingMark[] }>();
    for (const x of missing) {
      const e = m.get(x.student_id) ?? { name: x.name, items: [] };
      e.items.push(x);
      m.set(x.student_id, e);
    }
    return [...m.values()];
  }, [missing]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={`Submit marks · ${subjectName}`}
      subtitle={`${className} · ${term} ${academicYear}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {status === "submitted"
              ? "Submitted — the class teacher can now review the cards."
              : unresolved > 0
                ? `${unresolved} mark${unresolved === 1 ? "" : "s"} still to record or resolve`
                : "All marks recorded or resolved."}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Close
            </Button>
            {status === "open" ? (
              <Button onClick={submit} loading={busy} disabled={loading || unresolved > 0} data-testid="submit-marks">
                <Send className="h-4 w-4" /> Submit marks
              </Button>
            ) : (
              canReopen && (
                <Button variant="secondary" onClick={reopen} loading={busy} data-testid="reopen-marks">
                  <RotateCcw className="h-4 w-4" /> Reopen for changes
                </Button>
              )
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {returned && status === "open" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
              <strong>Returned:</strong> {returned}
            </div>
          )}
          {locked > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm text-text-secondary-light dark:border-white/10 dark:text-text-secondary-dark">
              <Lock className="h-4 w-4" /> {locked} card{locked === 1 ? " is" : "s are"} already reviewed or approved and won't change.
            </div>
          )}
          {status === "submitted" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="text-sm text-text-primary-light dark:text-text-primary-dark">These marks are submitted.</p>
              {canReopen && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why reopen? (optional)"
                  className="mt-2 w-full max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-800"
                />
              )}
            </div>
          ) : missing.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="text-sm text-text-primary-light dark:text-text-primary-dark">Every mapped mark is recorded. Ready to submit.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-text-primary-light dark:text-text-primary-dark">
                  {missing.length} mark{missing.length === 1 ? "" : "s"} not recorded for {byStudent.length} student
                  {byStudent.length === 1 ? "" : "s"}.
                </p>
                <div className="flex gap-1.5">
                  <Button size="xs" variant="secondary" onClick={() => setAll("absent")}>
                    All absent
                  </Button>
                  <Button size="xs" variant="secondary" onClick={() => setAll("exempt")}>
                    All exempt
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setAll("pending")}>
                    Clear
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-white/5 dark:border-white/10">
                {byStudent.map((s) => (
                  <li key={s.name + s.items[0].report_card_id} className="p-3">
                    <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">{s.name}</p>
                    <ul className="mt-2 space-y-1.5">
                      {s.items.map((m) => (
                        <li key={key(m)} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-text-secondary-light dark:text-text-secondary-dark">
                            <span className="mr-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                              {m.category}
                            </span>
                            {m.title}
                          </span>
                          <Select
                            value={choice[key(m)] ?? "pending"}
                            onChange={(e) => setChoice((c) => ({ ...c, [key(m)]: e.target.value as Choice }))}
                            aria-label={`${s.name}: ${m.title}`}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-800"
                          >
                            <option value="pending">I'll record it</option>
                            <option value="absent">Absent (counts 0)</option>
                            <option value="exempt">Exempt (left out)</option>
                          </Select>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
