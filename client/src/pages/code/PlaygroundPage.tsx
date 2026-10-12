import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FolderPlus, Loader2, Play, RotateCcw } from "lucide-react";
import CodeWorkspace, { type CodeWorkspaceHandle } from "../../components/code/CodeWorkspace";
import FocusHeader from "../../components/code/FocusHeader";
import Select from "../../components/ui/Select";
import { BUILTIN_STARTERS, startersFor } from "../../components/code/builtinStarters";
import { languageLabel } from "../../components/code/languages";
import { codeApi, saveProjectFiles, type CodeFile } from "../../services/codeApi";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/**
 * Playground (CODE_RUNNER_PLAN.md §7.7): practise any language the runner
 * runs, from a starter, with no grading. The code on screen is kept in this
 * browser per language, and can be saved as a project.
 * URL: /code/playground?language=python&starter=python-io
 */

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
  const [languages, setLanguages] = useState<{ key: string; label: string }[]>([]);
  const language = search.get("language") || "python";
  const starters = useMemo(() => startersFor(language), [language]);
  const starterId = search.get("starter") || starters[starters.length - 1]?.id || "";
  const starter = BUILTIN_STARTERS.find((s) => s.id === starterId) ?? starters[0];
  const [files, setFiles] = useState<CodeFile[]>(() => readDraft(language) ?? starter?.files ?? []);
  const [saving, setSaving] = useState(false);
  const workspace = useRef<CodeWorkspaceHandle>(null);

  useEffect(() => {
    codeApi
      .languages()
      .then((l) => setLanguages(l.filter((x) => startersFor(x.key).length > 0)))
      .catch(() => setLanguages([...new Set(BUILTIN_STARTERS.map((s) => s.language))].map((key) => ({ key, label: languageLabel(key) }))));
  }, []);

  // Another language or starter: its draft, else the starter's files.
  useEffect(() => {
    setFiles(search.get("starter") ? starter?.files ?? [] : readDraft(language) ?? starter?.files ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, starterId]);

  useEffect(() => {
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

  const reset = () => {
    if (!starter || !window.confirm("Start again from the starter? Your changes here will be lost.")) return;
    setFiles(starter.files);
  };

  const saveAsProject = async () => {
    const name = window.prompt("Name the new project", `${languageLabel(language)} practice`);
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
      <FocusHeader backTo="/code/projects" backLabel="Code" title="Playground" status={<span>Practice: nothing is graded</span>}>
        <div className="w-36">
          <Select size="sm" aria-label="Language" value={language} onChange={(e) => choose({ language: e.target.value })}>
            {(languages.length ? languages : [{ key: language, label: languageLabel(language) }]).map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        {starters.length > 1 && (
          <div className="w-48">
            <Select size="sm" aria-label="Starter" value={starter?.id ?? ""} onChange={(e) => choose({ starter: e.target.value })}>
              {starters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-white/10"
          title="Start again from the starter"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> <span className="hidden md:inline">Reset</span>
        </button>
        <button
          type="button"
          onClick={() => void saveAsProject()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" aria-hidden="true" />}
          <span className="hidden md:inline">Save as project</span>
        </button>
        <button
          type="button"
          onClick={() => workspace.current?.run()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          data-testid="playground-run"
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Run
        </button>
      </FocusHeader>
      <div className="min-h-0 flex-1">
        <CodeWorkspace ref={workspace} key={`${language}-${starter?.id}`} files={files} onFilesChange={setFiles} language={language} storageKey="playground" />
      </div>
    </div>
  );
};

export default PlaygroundPage;
