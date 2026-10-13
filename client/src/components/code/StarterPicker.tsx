import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, FileCode2, FlaskConical, Loader2, Search } from "lucide-react";
import Select from "../ui/Select";
import Drawer from "../ui/Drawer";
import EmptyState from "../ui/EmptyState";
import Badge from "../ui/Badge";
import { catalogApi, LEVEL_LABEL, PURPOSE_LABEL, type CatalogLanguage, type Starter, type StarterSummary } from "../../services/catalogApi";

/**
 * The one way to choose starter code (CODE_RUNNER_PLAN.md §7.5): language →
 * purpose → a card; Preview shows the files and tests in a drawer, Use hands
 * the starter (with its files) to the caller. Used by Code → Starters, the
 * Playground, new projects, and (phase 3) the question and assignment forms.
 */

export interface StarterPickerProps {
  /** Called with the full starter (files included). Omit for browse-only. */
  onUse?: (starter: Starter) => void;
  useLabel?: string;
  /** Extra actions in the preview drawer (e.g. "Open in Playground"). */
  previewActions?: (starter: Starter) => React.ReactNode;
  initialLanguage?: string;
  /** Pre-select this starter (highlighted card). */
  selectedId?: string | null;
  /** Only runnable languages (the runner can run them now). */
  runnableOnly?: boolean;
}

const PURPOSES = ["", "hello", "io-exercise", "project", "api", "data", "algorithms", "web"];

const StarterPicker: React.FC<StarterPickerProps> = ({ onUse, useLabel = "Use", previewActions, initialLanguage, selectedId, runnableOnly }) => {
  const [languages, setLanguages] = useState<CatalogLanguage[]>([]);
  const [language, setLanguage] = useState(initialLanguage ?? "");
  const [purpose, setPurpose] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<StarterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Starter | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .catalog()
      .then((c) => setLanguages(c.languages.filter((l) => l.enabled && (!runnableOnly || l.runnable))))
      .catch(() => setError("Couldn't load the languages."));
  }, [runnableOnly]);

  useEffect(() => {
    let cancelled = false;
    setList(null);
    catalogApi
      .starters({ language: language || undefined, purpose: purpose || undefined })
      .then((s) => !cancelled && setList(s))
      .catch(() => !cancelled && setError("Couldn't load the starters."));
    return () => {
      cancelled = true;
    };
  }, [language, purpose]);

  const allowed = useMemo(() => new Set(languages.map((l) => l.key)), [languages]);
  const label = (key: string) => languages.find((l) => l.key === key)?.label ?? key;
  const shown = (list ?? [])
    .filter((s) => !runnableOnly || allowed.has(s.language))
    .filter((s) => !q.trim() || `${s.title} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase()));

  const open = async (id: string, use: boolean) => {
    setLoadingId(id);
    try {
      const s = await catalogApi.starter(id);
      if (use && onUse) onUse(s);
      else setPreview(s);
    } catch {
      setError("Couldn't load that starter.");
    } finally {
      setLoadingId(null);
    }
  };

  const readme = preview?.files.find((f) => /^readme\.md$/i.test(f.path))?.content;
  const tests = preview?.files.find((f) => f.path === ".nga/tests.json");

  return (
    <div className="space-y-4" data-testid="starter-picker">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <Select size="sm" aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Purpose">
          {PURPOSES.map((p) => (
            <button
              key={p || "all"}
              type="button"
              aria-pressed={purpose === p}
              onClick={() => setPurpose(p)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                purpose === p ? "bg-primary text-white" : "bg-gray-100 text-text-secondary-light hover:bg-gray-200 dark:bg-white/10 dark:text-text-secondary-dark"
              }`}
            >
              {p ? PURPOSE_LABEL[p] ?? p : "All"}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary-light" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a starter"
            aria-label="Find a starter"
            className="h-9 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-800"
          />
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
          {error}
        </p>
      )}

      {!list ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState title="No starter matches" description="Choose another language or purpose, or clear the search." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Starters">
          {shown.map((s) => (
            <li
              key={s.id}
              className={`flex flex-col rounded-2xl border bg-white p-4 dark:bg-card-dark/40 ${
                selectedId === s.id ? "border-primary ring-2 ring-primary/20" : "border-gray-200/70 dark:border-white/10"
              }`}
              data-testid="starter-card"
            >
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 font-semibold text-text-primary-light dark:text-text-primary-dark">{s.title}</p>
                {selectedId === s.id && <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Selected" />}
              </div>
              {s.description && <p className="mt-1 line-clamp-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">{s.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="info">{label(s.language)}</Badge>
                {s.purpose && <Badge>{PURPOSE_LABEL[s.purpose] ?? s.purpose}</Badge>}
                {s.level && <Badge>{LEVEL_LABEL[s.level] ?? s.level}</Badge>}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                <span className="inline-flex items-center gap-1">
                  <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" /> {s.file_count} file{s.file_count === 1 ? "" : "s"}
                </span>
                {(s.has_io_tests || s.has_unit_tests) && (
                  <span className="inline-flex items-center gap-1">
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> {s.has_unit_tests ? "unit tests" : "input/output tests"}
                  </span>
                )}
              </p>
              <div className="mt-auto flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => void open(s.id, false)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5"
                >
                  {loadingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />} Preview
                </button>
                {onUse && (
                  <button
                    type="button"
                    onClick={() => void open(s.id, true)}
                    className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
                    data-testid="starter-use"
                  >
                    {useLabel}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? "Starter"}
        footer={
          preview && (
            <div className="flex flex-wrap justify-end gap-2">
              {previewActions?.(preview)}
              {onUse && (
                <button
                  type="button"
                  onClick={() => {
                    onUse(preview);
                    setPreview(null);
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
                >
                  {useLabel}
                </button>
              )}
            </div>
          )
        }
      >
        {preview && (
          <div className="space-y-4 text-sm" data-testid="starter-preview">
            {preview.description && <p className="text-text-secondary-light dark:text-text-secondary-dark">{preview.description}</p>}
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light">Files</p>
              <ul className="rounded-lg border border-gray-200 font-mono text-xs dark:border-white/10">
                {preview.files
                  .filter((f) => !f.path.startsWith(".nga/") && !f.path.startsWith(".tmcode/"))
                  .map((f) => (
                    <li key={f.path} className="border-b border-gray-100 px-3 py-1.5 last:border-0 dark:border-white/5">
                      {f.path}
                    </li>
                  ))}
              </ul>
            </div>
            {readme && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light">README</p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/5">{readme}</pre>
              </div>
            )}
            {preview.entry && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light">{preview.entry}</p>
                <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
                  {preview.files.find((f) => f.path === preview.entry)?.content}
                </pre>
              </div>
            )}
            {tests && (
              <p className="text-xs text-text-secondary-light">
                Includes {(() => {
                  try {
                    return JSON.parse(tests.content).tests.length;
                  } catch {
                    return "";
                  }
                })()} input/output tests.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default StarterPicker;
