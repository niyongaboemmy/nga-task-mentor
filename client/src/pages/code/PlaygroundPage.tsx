import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FolderPlus, Loader2, Play, RotateCcw } from "lucide-react";
import CodeWorkspace, { type CodeWorkspaceHandle } from "../../components/code/CodeWorkspace";
import FocusHeader from "../../components/code/FocusHeader";
import Select from "../../components/ui/Select";
import { BUILTIN_STARTERS } from "../../components/code/builtinStarters";
import { languageLabel } from "../../components/code/languages";
import { saveProjectFiles, type CodeFile } from "../../services/codeApi";
import { catalogApi, PURPOSE_LABEL, type StarterSummary } from "../../services/catalogApi";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/**
 * Playground (CODE_RUNNER_PLAN.md §7.7): practise any language the runner
 * runs, from one of the catalog's starters, with no grading. The code on
 * screen is kept in this browser per language and can be saved as a project.
 * URL: /code/playground?language=python&starter=python-io-calculator
 */

interface Option {
  id: string;
  title: string;
  purpose?: string;
}

/** Languages the Playground can run (web pages have the Preview instead). */
const NOT_HERE = new Set(["web", "logic", "sql"]);
const PURPOSE_ORDER = ["hello", "io-exercise", "algorithms", "project", "api", "data"];

const builtinOption = (b: { id: string; title: string }): Option => ({ id: b.id, title: b.title, purpose: b.id.endsWith("-io") ? "io-exercise" : "hello" });

const draftKey = (lang: string) => `tm.playground.${lang}`;
const readDraft = (lang: string): CodeFile[] | null => {
  try {
    const raw = localStorage.getItem(draftKey(lang));
    const files = raw ? (JSON.parse(raw) as CodeFile[]) : null;
    return Array.isArray(files) && files.length ? files : null;
  } catch {
    return null;
  }
};

const PlaygroundPage: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const language = search.get("language") || "python";
  const asked = search.get("starter");
  const [languages, setLanguages] = useState<{ key: string; label: string }[]>([]);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [files, setFiles] = useState<CodeFile[] | null>(null);
  const [starterId, setStarterId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const workspace = useRef<CodeWorkspaceHandle>(null);
  const builtins = useMemo(() => BUILTIN_STARTERS.filter((s) => s.language === language), [language]);

  // Languages: the catalog's runnable ones (built-in list if it can't load).
  useEffect(() => {
    catalogApi
      .catalog()
      .then((c) => {
        const list = (c.languages ?? []).filter((l) => l.runnable && !NOT_HERE.has(l.key)).map((l) => ({ key: l.key, label: l.label }));
        if (!list.length) throw new Error("empty catalog");
        setLanguages(list);
      })
      .catch(() => setLanguages([...new Set(BUILTIN_STARTERS.map((s) => s.language))].map((key) => ({ key, label: languageLabel(key) }))));
  }, []);

  // Starters of this language, simplest first.
  useEffect(() => {
    let cancelled = false;
    setOptions(null);
    catalogApi
      .starters({ language })
      .then((list: StarterSummary[]) => {
        if (cancelled) return;
        const rank = (p?: string) => (PURPOSE_ORDER.indexOf(p ?? "") + 1 || 99);
        // No catalog starters for this language: the built-in ones.
        if (!Array.isArray(list) || list.length === 0) return setOptions(builtins.map(builtinOption));
        setOptions([...list].sort((a, b) => rank(a.purpose) - rank(b.purpose) || a.title.localeCompare(b.title)).map((s) => ({ id: s.id, title: s.title, purpose: s.purpose })));
      })
      .catch(() => !cancelled && setOptions(builtins.map(builtinOption)));
    return () => {
      cancelled = true;
    };
  }, [language, builtins]);

  // Files: the asked starter, else this language's draft, else its first exercise.
  useEffect(() => {
    if (!options) return;
    let cancelled = false;
    const fallback = options.find((o) => o.purpose === "io-exercise") ?? options[0];
    const id = asked && options.some((o) => o.id === asked) ? asked : fallback?.id ?? null;
    const draft = asked ? null : readDraft(language);
    setStarterId(id);
    if (draft) {
      setFiles(draft);
      return;
    }
    if (!id) {
      setFiles([]);
      return;
    }
    const builtin = BUILTIN_STARTERS.find((s) => s.id === id);
    if (builtin) {
      setFiles(builtin.files);
      return;
    }
    setFiles(null);
    catalogApi
      .starter(id)
      .then((s) => !cancelled && setFiles(s.files))
      .catch(() => !cancelled && setFiles(builtins[0]?.files ?? []));
    return () => {
      cancelled = true;
    };
  }, [options, asked, language, builtins]);

  // Keep the draft.
  useEffect(() => {
    if (!files) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(language), JSON.stringify(files));
      } catch {
        // drafts are a convenience
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [files, language]);

  const choose = (next: { language?: string; starter?: string }) =>
    setSearch(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.language) {
          p.set("language", next.language);
          p.delete("starter");
        }
        if (next.starter) p.set("starter", next.starter);
        return p;
      },
      { replace: true },
    );

  const reset = async () => {
    if (!starterId || !window.confirm("Start again from the starter? Your changes here will be lost.")) return;
    const builtin = BUILTIN_STARTERS.find((s) => s.id === starterId);
    setFiles(builtin ? builtin.files : (await catalogApi.starter(starterId)).files);
  };

  const saveAsProject = async () => {
    if (!files) return;
    const name = window.prompt("Name the new project", `${languageLabel(language) || language} practice`);
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const project = await projectsApi.create({ name: name.trim(), kind: "tm", language });
      await saveProjectFiles(project.id, null, files, "Saved from the Playground");
      toast.success("Saved as a project.");
      navigate(`/code/projects/${project.id}/edit`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't save the project."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950" data-testid="playground">
      <FocusHeader backTo="/code/projects" backLabel="Code" title="Playground" status={<span className="hidden md:inline">Practice: nothing is graded</span>}>
        <div className="w-36">
          <Select size="sm" aria-label="Language" value={language} onChange={(e) => choose({ language: e.target.value })}>
            {(languages.length ? languages : [{ key: language, label: languageLabel(language) || language }]).map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        {options && options.length > 1 && (
          <div className="w-56">
            <Select size="sm" aria-label="Starter" value={starterId ?? ""} onChange={(e) => choose({ starter: e.target.value })}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.purpose ? `${PURPOSE_LABEL[o.purpose] ?? o.purpose}: ` : ""}
                  {o.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <button
          type="button"
          onClick={() => void reset()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-white/10"
          title="Start again from the starter"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> <span className="hidden md:inline">Reset</span>
        </button>
        <button
          type="button"
          onClick={() => void saveAsProject()}
          disabled={saving || !files}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden md:inline">Save as project</span>
        </button>
        <button
          type="button"
          onClick={() => workspace.current?.run()}
          disabled={!files}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          data-testid="playground-run"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Run
        </button>
      </FocusHeader>
      <div className="min-h-0 flex-1">
        {!files ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <CodeWorkspace ref={workspace} key={`${language}-${starterId}`} files={files} onFilesChange={setFiles} language={language} storageKey="playground" />
        )}
      </div>
    </div>
  );
};

export default PlaygroundPage;
