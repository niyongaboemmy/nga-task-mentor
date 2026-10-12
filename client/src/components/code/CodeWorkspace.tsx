import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { BookOpen, Code2, FolderTree, PanelBottom, PanelLeft, Terminal, X } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { codeApi, type CodeFile } from "../../services/codeApi";
import { runErrorMessage } from "../../utils/runErrors";
import FileTree from "./FileTree";
import RunPanel, { type BottomTab, type RunState } from "./RunPanel";
import { firstFileToOpen, monacoLanguage } from "./languages";
import { isHiddenFile, readIoTests } from "./tests";

/**
 * The code workspace (CODE_RUNNER_PLAN.md §6.3): one layout wherever code is
 * written, run or graded — task and files on the left, the editor in the
 * middle, Output and Tests below, an optional panel on the right for the
 * role (grading criteria, submission status). Same shortcuts everywhere:
 *   Ctrl/⌘+Enter run · Ctrl/⌘+Shift+Enter run tests · Ctrl/⌘+S save ·
 *   Ctrl/⌘+B files panel · Ctrl/⌘+J results panel.
 * Below 1024 px it becomes tabs: Task · Code · Output.
 */

export interface CodeWorkspaceProps {
  files: CodeFile[];
  onFilesChange?: (files: CodeFile[]) => void;
  readOnly?: boolean;
  /** Instructions shown in the left panel's Task tab. */
  task?: React.ReactNode;
  /** Runner language hint (detected from the files otherwise). */
  language?: string | null;
  rightPanel?: React.ReactNode;
  onSave?: () => void;
  /** localStorage key for panel sizes and the open tab. */
  storageKey: string;
  /** Run unsaved files (default) — a caller can replace it. */
  run?: typeof codeApi.run;
}

interface Layout {
  left: boolean;
  bottom: boolean;
  leftWidth: number;
  bottomHeight: number;
  leftTab: "task" | "files";
}

const loadLayout = (key: string, hasTask: boolean): Layout => {
  const fallback: Layout = { left: true, bottom: true, leftWidth: 260, bottomHeight: 260, leftTab: hasTask ? "task" : "files" };
  try {
    const raw = localStorage.getItem(`tm.code.layout.${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** What a page can ask of the workspace (its header's Run button, say). */
export interface CodeWorkspaceHandle {
  run: () => void;
  runTests: () => void;
}

const CodeWorkspace = forwardRef<CodeWorkspaceHandle, CodeWorkspaceProps>(function CodeWorkspace({
  files,
  onFilesChange,
  readOnly,
  task,
  language,
  rightPanel,
  onSave,
  storageKey,
  run = codeApi.run,
}, ref) {
  const { theme } = useTheme();
  const [layout, setLayout] = useState<Layout>(() => loadLayout(storageKey, !!task));
  const visible = useMemo(() => files.filter((f) => !isHiddenFile(f.path)), [files]);
  const io = useMemo(() => readIoTests(files), [files]);
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    const first = firstFileToOpen(visible.map((f) => f.path), io.entry);
    return first ? [first] : [];
  });
  const [active, setActive] = useState<string | null>(openTabs[0] ?? null);
  const [tab, setTab] = useState<BottomTab>("output");
  const [stdin, setStdin] = useState("");
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [mobile, setMobile] = useState<"task" | "code" | "output">("code");

  useEffect(() => {
    try {
      localStorage.setItem(`tm.code.layout.${storageKey}`, JSON.stringify(layout));
    } catch {
      // layout memory is a convenience
    }
  }, [layout, storageKey]);

  // Keep tabs valid when files change (rename, delete, reload).
  useEffect(() => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((p) => visible.some((f) => f.path === p));
      if (!next.length && visible[0]) next.push(visible[0].path);
      return next;
    });
    setActive((a) => (a && visible.some((f) => f.path === a) ? a : visible[0]?.path ?? null));
  }, [visible]);

  const open = (path: string) => {
    setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
    setActive(path);
    setMobile("code");
  };
  const closeTab = (path: string) => {
    setOpenTabs((t) => {
      const next = t.filter((p) => p !== path);
      if (active === path) setActive(next[next.length - 1] ?? null);
      return next;
    });
  };

  const activeFile = files.find((f) => f.path === active) ?? null;
  const setContent = (content: string) => {
    if (!activeFile || readOnly) return;
    onFilesChange?.(files.map((f) => (f.path === activeFile.path ? { ...f, content } : f)));
  };

  const doRun = useCallback(
    async (kind: BottomTab) => {
      if (state.status === "running") return;
      setTab(kind);
      setMobile("output");
      setLayout((l) => ({ ...l, bottom: true }));
      if (kind === "tests" && io.tests.length === 0) return;
      setState({ status: "running", kind });
      try {
        const result = await run({
          files: files.filter((f) => !isHiddenFile(f.path)),
          language: language ?? null,
          entry: io.entry ?? null,
          tests:
            kind === "tests"
              ? io.tests.map((t) => ({ id: t.id, input: t.input, expected_output: t.expected_output }))
              : [{ id: "own", input: stdin }],
        });
        setState({ status: "done", kind, result });
      } catch (e) {
        setState({ status: "error", kind, error: runErrorMessage(e) });
      }
    },
    [files, io, language, run, state.status, stdin],
  );

  useImperativeHandle(ref, () => ({ run: () => void doRun("output"), runTests: () => void doRun("tests") }), [doRun]);

  // Shortcuts (capture phase, so they also work inside Monaco).
  const handlers = useRef({ doRun, onSave });
  handlers.current = { doRun, onSave };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "enter") {
        e.preventDefault();
        void handlers.current.doRun(e.shiftKey ? "tests" : "output");
      } else if (k === "s" && handlers.current.onSave) {
        e.preventDefault();
        handlers.current.onSave();
      } else if (k === "b") {
        e.preventDefault();
        setLayout((l) => ({ ...l, left: !l.left }));
      } else if (k === "j") {
        e.preventDefault();
        setLayout((l) => ({ ...l, bottom: !l.bottom }));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Drag handles for the left and bottom panels.
  const drag = (axis: "x" | "y") => (e: React.PointerEvent) => {
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const from = axis === "x" ? layout.leftWidth : layout.bottomHeight;
    const move = (ev: PointerEvent) => {
      const d = (axis === "x" ? ev.clientX : ev.clientY) - start;
      setLayout((l) =>
        axis === "x" ? { ...l, leftWidth: Math.min(480, Math.max(180, from + d)) } : { ...l, bottomHeight: Math.min(600, Math.max(120, from - d)) },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const fileOps = readOnly
    ? {}
    : {
        onAdd: (path: string) => {
          onFilesChange?.([...files, { path, content: "" }]);
          open(path);
        },
        onRename: (from: string, to: string) => {
          onFilesChange?.(files.map((f) => (f.path === from ? { ...f, path: to } : f)));
          setOpenTabs((t) => t.map((p) => (p === from ? to : p)));
          setActive((a) => (a === from ? to : a));
        },
        onDelete: (path: string) => {
          onFilesChange?.(files.filter((f) => f.path !== path));
          closeTab(path);
        },
      };

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col">
      {task && (
        <div className="flex shrink-0 gap-1 border-b border-gray-200 p-1 dark:border-white/10" role="tablist" aria-label="Side panel">
          {(
            [
              ["task", "Task", BookOpen],
              ["files", "Files", FolderTree],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={layout.leftTab === k}
              onClick={() => setLayout((l) => ({ ...l, leftTab: k }))}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold ${
                layout.leftTab === k ? "bg-gray-100 text-text-primary-light dark:bg-white/10 dark:text-white" : "text-text-secondary-light dark:text-text-secondary-dark"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {task && layout.leftTab === "task" ? (
          <div className="p-3 text-sm" data-testid="workspace-task">
            {task}
          </div>
        ) : (
          <FileTree files={files} active={active} readOnly={readOnly} onOpen={open} {...fileOps} />
        )}
      </div>
    </div>
  );

  const editor = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center overflow-x-auto border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-slate-900" role="tablist" aria-label="Open files">
        {openTabs.map((p) => (
          <div
            key={p}
            className={`group flex shrink-0 items-center gap-1 border-r border-gray-200 px-3 py-1.5 text-xs dark:border-white/10 ${
              p === active ? "bg-white font-semibold text-text-primary-light dark:bg-slate-950 dark:text-white" : "text-text-secondary-light dark:text-text-secondary-dark"
            }`}
          >
            <button type="button" role="tab" aria-selected={p === active} onClick={() => setActive(p)}>
              {p.split("/").pop()}
            </button>
            <button type="button" onClick={() => closeTab(p)} aria-label={`Close ${p}`} className="rounded p-0.5 opacity-50 hover:bg-gray-200 hover:opacity-100 dark:hover:bg-white/10">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {readOnly && <span className="ml-auto shrink-0 px-3 text-[11px] font-semibold text-text-secondary-light">Read-only</span>}
      </div>
      <div className="min-h-0 flex-1" data-testid="code-editor">
        {activeFile ? (
          <Editor
            path={activeFile.path}
            language={monacoLanguage(activeFile.path)}
            value={activeFile.content}
            theme={theme === "dark" ? "vs-dark" : "light"}
            onChange={(v) => setContent(v ?? "")}
            options={{
              readOnly,
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-secondary-light">Open a file to start.</div>
        )}
      </div>
    </div>
  );

  const results = (
    <RunPanel
      tab={tab}
      onTab={setTab}
      stdin={stdin}
      onStdin={setStdin}
      tests={io.tests}
      state={state}
      onRun={() => void doRun("output")}
      onRunTests={() => void doRun("tests")}
      canRun={visible.length > 0}
    />
  );

  const toggle = (on: boolean, label: string, Icon: React.ElementType, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 ${on ? "bg-gray-200 text-text-primary-light dark:bg-white/15 dark:text-white" : "text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-950" data-testid="code-workspace">
      {/* Phones and tablets: one area at a time. */}
      <div className="flex shrink-0 gap-1 border-b border-gray-200 p-1 dark:border-white/10 lg:hidden" role="tablist" aria-label="Workspace view">
        {(
          [
            ["task", task ? "Task" : "Files", BookOpen],
            ["code", "Code", Code2],
            ["output", "Output", Terminal],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mobile === k}
            onClick={() => setMobile(k)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${
              mobile === k ? "bg-primary text-white" : "text-text-secondary-light dark:text-text-secondary-dark"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside
          className={`${mobile === "task" ? "flex" : "hidden"} min-h-0 w-full flex-col border-gray-200 dark:border-white/10 lg:w-auto lg:border-r ${layout.left ? "lg:flex" : "lg:hidden"}`}
          style={{ flexBasis: undefined }}
          aria-label={task ? "Task and files" : "Files"}
        >
          <div className="h-full min-h-0 lg:w-[var(--left-w)]" style={{ ["--left-w" as string]: `${layout.leftWidth}px` }}>
            {leftPanel}
          </div>
        </aside>
        {layout.left && <div className="hidden w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/30 lg:block" onPointerDown={drag("x")} aria-hidden="true" />}

        {/* Centre: editor over results */}
        <div className={`${mobile === "task" ? "hidden" : "flex"} min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
          <div className={`${mobile === "code" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>{editor}</div>
          {layout.bottom && (
            <div className="hidden h-1 shrink-0 cursor-row-resize hover:bg-primary/30 lg:block" onPointerDown={drag("y")} aria-hidden="true" />
          )}
          <div
            className={`${mobile === "output" ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-gray-200 dark:border-white/10 lg:flex-none lg:border-t ${layout.bottom ? "lg:flex" : "lg:hidden"}`}
            style={{ ["--bottom-h" as string]: `${layout.bottomHeight}px` }}
          >
            <div className="h-full min-h-0 lg:h-[var(--bottom-h)]">{results}</div>
          </div>
          {/* Panel toggles */}
          <div className="hidden shrink-0 items-center gap-1 border-t border-gray-200 px-2 py-1 text-[11px] text-text-secondary-light dark:border-white/10 dark:text-text-secondary-dark lg:flex">
            {toggle(layout.left, `Files panel (${isMac ? "⌘" : "Ctrl"}+B)`, PanelLeft, () => setLayout((l) => ({ ...l, left: !l.left })))}
            {toggle(layout.bottom, `Results panel (${isMac ? "⌘" : "Ctrl"}+J)`, PanelBottom, () => setLayout((l) => ({ ...l, bottom: !l.bottom })))}
            <span className="ml-2">
              {isMac ? "⌘" : "Ctrl"}+Enter run · {isMac ? "⌘" : "Ctrl"}+Shift+Enter tests{onSave ? ` · ${isMac ? "⌘" : "Ctrl"}+S save` : ""}
            </span>
          </div>
        </div>

        {rightPanel && (
          <aside className="hidden w-[360px] shrink-0 border-l border-gray-200 dark:border-white/10 xl:block" aria-label="Details">
            {rightPanel}
          </aside>
        )}
      </div>
    </div>
  );
});

export default CodeWorkspace;
