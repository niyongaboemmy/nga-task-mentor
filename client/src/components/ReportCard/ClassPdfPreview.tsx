import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, Download, ExternalLink, FileText, Printer, RefreshCw, Trophy } from "lucide-react";
import Modal from "../ui/Modal";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { ReportCardWorkflowApi, apiMessage } from "../../services/reportCardWorkflowApi";

/**
 * Preview of the whole class's report cards as one PDF: a ranking cover,
 * then each student's card on its own page, best first. Download, print or
 * open it in a new tab from the toolbar.
 */
export interface ClassPdfPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  classGroupId: number;
  className: string;
  term: string;
  academicYear: string;
  students: number;
}

const safe = (v: string) => v.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "class";

export default function ClassPdfPreview({ isOpen, onClose, classGroupId, className, term, academicYear, students }: ClassPdfPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const fileName = `ReportCards-${safe(className)}-${safe(term)}-${safe(academicYear)}.pdf`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await ReportCardWorkflowApi.classPdf({ class_group_id: classGroupId, term, academic_year: academicYear });
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      });
    } catch (e) {
      // classPdf rethrows the server's message as a plain Error (no response).
      const msg = e instanceof Error && !("response" in e) ? e.message : apiMessage(e, "Couldn't build the class PDF");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [classGroupId, term, academicYear]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  // Free the PDF when the preview closes.
  useEffect(() => {
    if (isOpen || !url) return;
    URL.revokeObjectURL(url);
    setUrl(null);
  }, [isOpen, url]);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    toast.success("Class report cards downloaded");
  };
  const print = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      toast.error("Your browser blocked printing here. Download the PDF and print it.");
    }
  };
  const openTab = () => {
    if (!url) return;
    const w = window.open(url, "_blank", "noopener");
    if (!w) toast.info("Allow pop-ups to open the PDF in a new tab, or download it.");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xxl"
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" /> Class report cards
        </span>
      }
      subtitle={`${className} · ${term} ${academicYear} · ${students} student${students === 1 ? "" : "s"}, in ranking order`}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-white/10" data-testid="class-pdf-toolbar">
        <p className="inline-flex items-center gap-1.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <Trophy className="h-3.5 w-3.5 text-blue-600" />
          Page 1 ranks the class; click a row to jump to that student's card. One card per page after that.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading} aria-label="Rebuild PDF">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={openTab} disabled={!url}>
            <ExternalLink className="h-4 w-4" /> New tab
          </Button>
          <Button variant="secondary" size="sm" onClick={print} disabled={!url}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" onClick={download} disabled={!url}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      <div className="relative min-h-[70vh] flex-1 bg-gray-100 dark:bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-start justify-center overflow-hidden p-6" data-testid="class-pdf-loading" aria-busy="true">
            <div className="w-full max-w-[560px] space-y-4 rounded-xl bg-white p-6 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-6 w-40" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
              <p className="text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
                Building {students} report card{students === 1 ? "" : "s"}…
              </p>
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <p className="max-w-md text-sm text-text-primary-light dark:text-text-primary-dark">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
        {!loading && !error && url && (
          <iframe ref={frame} src={url} title={`Report cards — ${className}`} className="absolute inset-0 h-full w-full border-0" data-testid="class-pdf-frame" />
        )}
      </div>
    </Modal>
  );
}
