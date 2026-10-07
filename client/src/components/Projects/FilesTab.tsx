import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, File, FileCode2, Folder, FolderOpen, History, Lock } from "lucide-react";
import {
  apiErrorMessage,
  projectsApi,
  type ManifestFile,
  type RevisionSummary,
} from "../../services/projectsApi";
import { Skeleton } from "../ui/Skeleton";
import { formatBytes, formatDateTime, monacoLanguage } from "./projectFormat";
import Select from "../ui/Select";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

/** Files above this aren't fetched into the viewer. */
const MAX_VIEW_BYTES = 2 * 1024 * 1024;

interface TreeNode {
  name: string;
  path: string;
  dir: boolean;
  size: number;
  children: TreeNode[];
}

function buildTree(files: ManifestFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", dir: true, size: 0, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part && c.dir === !isFile);
      if (!child) {
        child = { name: part, path, dir: !isFile, size: isFile ? f.size : 0, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

/** The file to show first: a README, then a main.*, then the first file. */
function defaultFile(files: ManifestFile[]): string | null {
  const paths = files.map((f) => f.path);
  return (
    paths.find((p) => /^readme(\.md)?$/i.test(p)) ??
    paths.find((p) => /(^|\/)main\.[a-z]+$/i.test(p)) ??
    paths.sort()[0] ??
    null
  );
}

const isDarkMode = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

const FilesTab: React.FC<{
  projectId: number;
  revisions: RevisionSummary[] | null;
  revisionId: number | null;
  onRevisionChange: (id: number | null) => void;
  /** Fill the parent's height (the parent sets it); only the tree and the code scroll. */
  fill?: boolean;
}> = ({ projectId, revisions, revisionId, onRevisionChange, fill = false }) => {
  const [files, setFiles] = useState<ManifestFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [content, setContent] = useState<{ path: string; text: string } | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const effectiveRev = revisionId ?? revisions?.[0]?.id ?? null;
  const current = revisions?.find((r) => r.id === effectiveRev) ?? null;
  const isHead = !!revisions?.length && effectiveRev === revisions[0].id;

  const noRevisions = !!revisions && revisions.length === 0;

  useEffect(() => {
    if (noRevisions) {
      setFiles([]);
      return;
    }
    if (effectiveRev == null) return;
    let cancelled = false;
    setFiles(null);
    setError(null);
    projectsApi
      .manifest(projectId, effectiveRev)
      .then((m) => {
        if (cancelled) return;
        setFiles(m.files);
        const first = defaultFile(m.files);
        setSelected((prev) => (prev && m.files.some((f) => f.path === prev) ? prev : first));
        // Open the folders on the way to the selected file.
        if (first) {
          const parts = first.split("/");
          setExpanded((prev) => {
            const next = new Set(prev);
            for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
            return next;
          });
        }
      })
      .catch((e) => !cancelled && setError(apiErrorMessage(e, "Couldn't load the files of this revision.")));
    return () => {
      cancelled = true;
    };
  }, [projectId, effectiveRev, noRevisions]);

  const selectedFile = files?.find((f) => f.path === selected) ?? null;

  useEffect(() => {
    if (!selectedFile || effectiveRev == null) return;
    if (selectedFile.size > MAX_VIEW_BYTES) {
      setContent(null);
      setContentError(`This file is ${formatBytes(selectedFile.size)}, too large to show here. Open the project in TMCode to see it.`);
      return;
    }
    let cancelled = false;
    setContentLoading(true);
    setContentError(null);
    projectsApi
      .fileContent(projectId, selectedFile.path, effectiveRev)
      .then(({ text, binary }) => {
        if (cancelled) return;
        if (binary) {
          setContent(null);
          setContentError("This is a binary file; it can't be shown as text.");
        } else setContent({ path: selectedFile.path, text });
      })
      .catch((e) => !cancelled && setContentError(apiErrorMessage(e, "Couldn't load this file.")))
      .finally(() => !cancelled && setContentLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedFile, effectiveRev]);

  const tree = useMemo(() => buildTree(files ?? []), [files]);

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-0 max-w-full flex-1 items-center gap-2 text-sm sm:flex-none">
          <History className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="shrink-0 font-medium text-slate-600 dark:text-slate-300">Revision</span>
          <Select size="sm" variant="outline"
            className="min-w-0 flex-1 sm:max-w-md"
            value={effectiveRev ?? ""}
            onChange={(e) => onRevisionChange(e.target.value ? Number(e.target.value) : null)}
            disabled={!revisions?.length}
            aria-label="Revision"
          >
            {(revisions ?? []).map((r, i) => (
              <option key={r.id} value={r.id}>
                #{r.number}
                {i === 0 ? " (latest)" : ""} · {r.message || r.source} · {formatDateTime(r.created_at)}
              </option>
            ))}
          </Select>
        </label>
        {current && !isHead && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <Lock className="h-3 w-3" aria-hidden="true" /> Viewing revision #{current.number}, not the latest
          </span>
        )}
        {files && (
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            {files.length} files · {formatBytes(files.reduce((n, f) => n + f.size, 0))}
          </span>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </p>
      ) : revisions && revisions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-slate-400">
          No files yet. Open the project in TMCode and use <strong>Save to Task Mentor</strong>.
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-border-dark/30 md:grid-cols-[minmax(200px,280px)_1fr] ${
            fill ? "min-h-0 flex-1 grid-rows-[minmax(0,30%)_minmax(0,1fr)] md:grid-rows-1" : "min-h-[420px]"
          }`}
        >
          <div className={`${fill ? "min-h-0" : "max-h-[60vh] md:max-h-[70vh]"} overflow-auto border-b border-gray-200/70 bg-gray-50/60 p-2 dark:border-border-dark/30 dark:bg-white/[0.02] md:border-b-0 md:border-r`}>
            {files === null ? (
              <div className="space-y-2 p-2" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: `${50 + ((i * 37) % 45)}%`, marginLeft: (i % 3) * 12 }} />
                ))}
              </div>
            ) : (
              <FileTree
                nodes={tree}
                selected={selected}
                expanded={expanded}
                onToggle={(path) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(path)) next.delete(path);
                    else next.add(path);
                    return next;
                  })
                }
                onSelect={setSelected}
              />
            )}
          </div>
          <div className={`flex min-w-0 flex-col bg-white dark:bg-[#1e1e1e] ${fill ? "min-h-0" : ""}`}>
            <div className="flex items-center gap-2 border-b border-gray-200/70 px-3 py-2 text-xs dark:border-white/10">
              <FileCode2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="truncate font-mono text-slate-700 dark:text-slate-200" data-testid="viewer-path">
                {selected ?? "No file selected"}
              </span>
              <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-400">
                Read-only
              </span>
            </div>
            <div className={`relative flex-1 ${fill ? "min-h-0" : "min-h-[360px]"}`}>
              {contentError ? (
                <p className="p-6 text-sm text-slate-500 dark:text-slate-400">{contentError}</p>
              ) : contentLoading || !content ? (
                <div className="space-y-2 p-4" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} className="h-3" style={{ width: `${30 + ((i * 53) % 60)}%` }} />
                  ))}
                </div>
              ) : (
                <Suspense fallback={<Skeleton className="m-4 h-64" />}>
                  <div className="absolute inset-0" data-testid="file-viewer">
                    <MonacoEditor
                      height="100%"
                      path={`tm-project-${projectId}-${effectiveRev}/${content.path}`}
                      language={monacoLanguage(content.path)}
                      value={content.text}
                      theme={isDarkMode() ? "vs-dark" : "light"}
                      options={{
                        readOnly: true,
                        domReadOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        wordWrap: "on",
                        renderLineHighlight: "none",
                        automaticLayout: true,
                      }}
                      loading={<Skeleton className="m-4 h-64" />}
                    />
                  </div>
                </Suspense>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Accessible tree (role="tree"): ↑/↓ move, → opens, ← closes, Enter/Space selects. */
const FileTree: React.FC<{
  nodes: TreeNode[];
  selected: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}> = ({ nodes, selected, expanded, onToggle, onSelect }) => {
  const ref = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const out: { node: TreeNode; depth: number }[] = [];
    const walk = (list: TreeNode[], depth: number) =>
      list.forEach((n) => {
        out.push({ node: n, depth });
        if (n.dir && expanded.has(n.path)) walk(n.children, depth + 1);
      });
    walk(nodes, 0);
    return out;
  }, [nodes, expanded]);

  const [focused, setFocused] = useState<string | null>(null);
  const focusPath = focused ?? selected ?? visible[0]?.node.path ?? null;

  const focusAt = (index: number) => {
    const item = visible[Math.max(0, Math.min(visible.length - 1, index))];
    if (!item) return;
    setFocused(item.node.path);
    ref.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(item.node.path)}"]`)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, node: TreeNode, index: number) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusAt(index - 1);
        break;
      case "ArrowRight":
        if (node.dir && !expanded.has(node.path)) {
          e.preventDefault();
          onToggle(node.path);
        }
        break;
      case "ArrowLeft":
        if (node.dir && expanded.has(node.path)) {
          e.preventDefault();
          onToggle(node.path);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (node.dir) onToggle(node.path);
        else onSelect(node.path);
        break;
    }
  };

  if (visible.length === 0) return <p className="p-3 text-sm text-slate-500">This revision has no files.</p>;

  return (
    <ul ref={ref} role="tree" aria-label="Project files" className="text-[13px]">
      {visible.map(({ node, depth }, index) => {
        const open = node.dir && expanded.has(node.path);
        const isSel = !node.dir && node.path === selected;
        return (
          <li
            key={node.path + (node.dir ? "/" : "")}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={node.dir ? open : undefined}
            aria-selected={isSel}
            tabIndex={node.path === focusPath ? 0 : -1}
            data-path={node.path}
            onKeyDown={(e) => onKeyDown(e, node, index)}
            onFocus={() => setFocused(node.path)}
            onClick={() => (node.dir ? onToggle(node.path) : onSelect(node.path))}
            style={{ paddingLeft: 6 + depth * 14 }}
            className={`flex cursor-pointer select-none items-center gap-1.5 rounded-lg py-1 pr-2 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${
              isSel
                ? "bg-blue-100/80 font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                : "text-slate-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/5"
            }`}
          >
            {node.dir ? (
              <>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
                {open ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5 shrink-0" />
                <File className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </>
            )}
            <span className="truncate">{node.name}</span>
          </li>
        );
      })}
    </ul>
  );
};

export default FilesTab;
