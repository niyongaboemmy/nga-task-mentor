import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import {
  Play,
  CheckCircle,
  XCircle,
  MessageSquare,
  BookOpen,
  Terminal,
  RotateCcw,
  Globe,
  ListChecks,
  X,
  FlaskConical,
  Loader2,
  Files,
  Bug,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Trash2,
  Layout,
  Columns,
  Zap,
  Upload,
  FileCode2,
  Maximize,
  Minimize,
} from "lucide-react";
import type {
  QuestionComponentProps,
  CodingData,
  CodingAnswer,
} from "../../../types/quiz.types";
import { FileExplorer } from "./FileExplorer";
import type { ProjectFile } from "./FileExplorer";
import { LivePreviewPanel } from "./LivePreviewPanel";
import { AiSocraticChat } from "./AiSocraticChat";
import { QuizApiService } from "../../../services/quizApi";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import RichTextDisplay from "../../Common/RichTextDisplay";
import CountdownTimer from "../../Dashboard/CountdownTimer";
import QuestionTimer from "../../ui/QuestionTimer";

// ─── Types ────────────────────────────────────────────────────────────────────
type SidePanel = "explorer" | "problem" | "ai" | "question" | null;
type BottomPanel = "console" | "results" | "preview" | null;

interface ConsoleEntry {
  id: string;
  type: "stdout" | "stderr" | "info" | "success" | "run-start";
  text: string;
  time: Date;
  execMs?: number;
  memKb?: number;
}

let _id = 0;
const uid = () => `${Date.now()}-${_id++}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LANG_EXT: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  java: "java",
  cpp: "cpp",
  c: "c",
  rust: "rs",
  go: "go",
  php: "php",
  ruby: "rb",
  html: "html",
  css: "css",
  react: "jsx",
  vue: "vue",
  angular: "angular",
  nextjs: "nextjs",
  kotlin: "kt",
  swift: "swift",
};

const TAB_COLOR: Record<string, string> = {
  js: "#f7df1e",
  ts: "#3178c6",
  html: "#e34c26",
  css: "#264de4",
  py: "#3572a5",
  java: "#b07219",
  jsx: "#61dafb",
  tsx: "#3178c6",
  rs: "#dea584",
  go: "#00add8",
  rb: "#701516",
};

function buildInitialFiles(codingData: CodingData, answer: any): ProjectFile[] {
  if (codingData.project_mode) {
    const savedCode = (answer as CodingAnswer)?.code;
    if (savedCode) {
      try {
        return JSON.parse(savedCode);
      } catch (e) {
        console.error("Failed to parse saved project files:", e);
      }
    }
    if (codingData.project_files?.length) {
      return codingData.project_files.map((f) => ({ ...f }));
    }
    return [];
  }
  const lang = codingData.language || "javascript";
  const ext = LANG_EXT[lang] ?? lang;
  const savedCode = (answer as CodingAnswer)?.code;
  const content = savedCode || codingData.starter_code || "";
  return [
    { name: `main.${ext}`, content, language: lang, is_entry_point: true },
  ];
}

function getErrorLineNumbers(errorText: string): number[] {
  const lines: number[] = [];
  const patterns = [/line (\d+)/gi, /:(\d+):/g, /\[(\d+),/g, /at line (\d+)/gi];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(errorText)) !== null) {
      const n = parseInt(m[1]);
      if (n > 0 && !lines.includes(n)) lines.push(n);
    }
  }
  return lines;
}

// ─── Activity Bar Button ──────────────────────────────────────────────────────
const ActivityBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number | string;
  onClick: () => void;
}> = ({ icon, label, active, badge, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className={`relative w-12 h-12 flex items-center justify-center rounded-none border-l-2 transition-all group ${
      active
        ? "border-blue-500 text-white bg-slate-800/60"
        : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
    }`}
  >
    {icon}
    {badge !== undefined && (
      <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
        {badge}
      </span>
    )}
  </button>
);

const PREVIEW_TAB_ID = "__live_preview__";

interface CodeSpaceWithToolbarProps extends QuestionComponentProps {
  isProjectMode: boolean;
  files: ProjectFile[];
  language: string;
  isRunning: boolean;
  isTesting: boolean;
  isWebLang: boolean;
  isStarted: boolean;
  onSetIsStarted: (started: boolean) => void;
}

export const CodeSpaceWithToolbar: React.FC<CodeSpaceWithToolbarProps> = (
  props,
) => {
  const {
    isProjectMode,
    files,
    language,
    isRunning,
    isTesting,
    isWebLang,
    isStarted,
    onSetIsStarted,
  } = props;

  return (
    <div className="flex flex-col gap-0 w-full">
      {/* Toolbar strip */}
      <div className="flex items-center bg-[#3c3c3c] border-b border-[#1e1e1e] px-3 gap-2 h-10 flex-shrink-0">
        <div className="flex items-center gap-1.5 mr-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[12px] text-[#ccc] flex-1 font-medium select-none truncate">
          {props.question.questionBank?.question_text
            ?.replace(/<[^>]*>/g, "")
            .substring(0, 60) ?? "Coding Challenge"}
        </span>

        {/* Integrated Timer Placeholder */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#2d2d2d] rounded-full border border-[#444] text-amber-400 mr-2">
          <Clock size={12} className="animate-pulse" />
          <span className="text-[11px] font-mono font-bold">LIVE</span>
        </div>

        {/* Right-side button group */}
        <div className="flex items-center gap-2">
          {/* Student ZIP upload (project mode) */}
          {isProjectMode && (
            <label
              title="Upload your project as a ZIP"
              className="flex items-center gap-1.5 text-[11px] text-[#969696] hover:text-white px-2 py-1 hover:bg-[#555] rounded transition-all cursor-pointer"
            >
              <Upload size={12} /> Upload ZIP
              <input
                type="file"
                accept=".zip"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const JSZip = (await import("jszip")).default;
                    const zip = await JSZip.loadAsync(file);
                    const extracted: ProjectFile[] = [];
                    for (const [path, entry] of Object.entries(zip.files)) {
                      if (entry.dir) continue;
                      const basename = path.split("/").pop() ?? path;
                      if (basename.startsWith(".")) continue;
                      const content = await entry.async("string");
                      extracted.push({
                        name: basename,
                        content,
                        language: basename.split(".").pop() ?? "plaintext",
                      });
                    }
                    if (extracted.length > 0) {
                      extracted[0].is_entry_point = true;
                      document.dispatchEvent(
                        new CustomEvent("codespace:loadfiles", {
                          detail: extracted,
                        }),
                      );
                    }
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </label>
          )}

          <button
            onClick={() => {
              document.dispatchEvent(new CustomEvent("codespace:reset"));
            }}
            className="flex items-center gap-1.5 text-[11px] text-[#969696] hover:text-white px-2 py-1 hover:bg-[#555] rounded transition-all"
          >
            <RotateCcw size={12} /> Reset
          </button>

          {isStarted && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => props.onToggleFullscreen?.(false)}
                className="flex items-center gap-1.5 bg-[#444] hover:bg-[#555] text-white text-[12px] font-semibold px-4 py-1.5 rounded transition-all active:scale-95 border border-[#555]"
                title="Exit fullscreen and return to quiz"
              >
                <Minimize size={13} /> Finish
              </button>
              <button
                onClick={() => {
                  // Final save and move next
                  const currentCode = isProjectMode
                    ? JSON.stringify(files)
                    : files[0]?.content || "";

                  props.onAnswerChange({ code: currentCode, language }, true); // forceSave = true

                  props.onToggleFullscreen?.(false);
                  props.onNext?.();
                }}
                className="flex items-center gap-2 bg-[#007acc] hover:bg-[#0062a3] text-white text-[12px] font-bold px-4 py-1.5 rounded transition-all active:scale-95 shadow-[0_0_15px_-3px_rgba(0,122,204,0.5)]"
                title="Save answer and go to next question"
              >
                <CheckCircle size={14} /> Submit & Continue
              </button>
            </div>
          )}

          <button
            onClick={() =>
              document.dispatchEvent(new CustomEvent("codespace:run"))
            }
            className="flex items-center gap-2 bg-[#0e7a0e] hover:bg-[#0d6e0d] text-white text-[12px] font-semibold px-4 py-1.5 rounded transition-all active:scale-95"
          >
            {isRunning ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} fill="white" />
            )}
            {isWebLang ? "Preview" : "Run"}
            <span className="text-[#aaffaa] text-[9px] font-normal">⌘↩</span>
          </button>
          <button
            onClick={() =>
              document.dispatchEvent(new CustomEvent("codespace:test"))
            }
            className="flex items-center gap-2 bg-[#1a3f6f] hover:bg-[#1e4a87] text-white text-[12px] font-semibold px-4 py-1.5 rounded transition-all active:scale-95"
          >
            {isTesting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FlaskConical size={13} />
            )}
            Test
            <span className="text-[#aaccff] text-[9px] font-normal">⌘⇧↩</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const CodeSpaceEditor: React.FC<QuestionComponentProps> = (props) => {
  const {
    question,
    answer,
    onAnswerChange,
    disabled = false,
    timeRemaining,
    onToggleFullscreen,
    submissionId,
    isFullscreen,
  } = props;

  const codingData: CodingData = question.question_data as CodingData;
  const isProjectMode = Boolean(codingData.project_mode);
  const language = codingData.language || "javascript";
  const isWebLang = [
    "html",
    "css",
    "react",
    "vue",
    "angular",
    "nextjs",
  ].includes(language);

  const monaco = useMonaco();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // ─── File state ─────────────────────────────────────────────────────────────
  const [files, setFiles] = useState<ProjectFile[]>(() =>
    buildInitialFiles(codingData, answer),
  );
  const [activeFileName, setActiveFileName] = useState(
    () => files[0]?.name ?? "main.js",
  );
  const [openedTabs, setOpenedTabs] = useState<string[]>([files[0]?.name]);

  const activeFile = useMemo(
    () => files.find((f) => f.name === activeFileName) ?? files[0],
    [files, activeFileName],
  );

  // ─── Layout state ───────────────────────────────────────────────────────────
  const [sidePanel, setSidePanel] = useState<SidePanel>(
    isProjectMode ? "explorer" : "problem",
  );
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(
    isWebLang ? "preview" : null,
  );
  const [problemTab, setProblemTab] = useState<
    "desc" | "examples" | "constraints"
  >("desc");
  const [sidePanelWidth, setSidePanelWidth] = useState(260);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220);
  const draggingH = useRef(false);
  const draggingV = useRef(false);

  // ─── Execution state ────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);
  const [lastError, setLastError] = useState<string | undefined>();
  const [stdinValue, setStdinValue] = useState("");
  const [isStarted, setIsStarted] = useState(false);

  // Layout customization state
  const [isPreviewSplit, setIsPreviewSplit] = useState(false);
  const [splitWidth, setSplitWidth] = useState(50); // percentage for split
  const draggingSplit = useRef(false);

  // Sync isStarted with fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setIsStarted(false);
    }
  }, [isFullscreen]);

  // ─── Error decorations in Monaco ────────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || !monaco) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    if (lastError) {
      const lines = getErrorLineNumbers(lastError);
      const newDecs = lines.map((ln) => ({
        range: new monaco.Range(ln, 1, ln, 999),
        options: {
          isWholeLine: true,
          className: "monaco-error-line-highlight",
          glyphMarginClassName: "monaco-error-glyph",
          glyphMarginHoverMessage: { value: `⚠️ Error on line ${ln}` },
          minimap: { color: "#ff0000", position: 2 },
        },
      }));
      decorationsRef.current = model.deltaDecorations(
        decorationsRef.current,
        newDecs,
      );
    } else {
      decorationsRef.current = model.deltaDecorations(
        decorationsRef.current,
        [],
      );
    }
  }, [lastError, monaco]);

  // ─── File / tab management ──────────────────────────────────────────────────
  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      const updated = newCode ?? "";
      let newFiles: ProjectFile[] = [];

      setFiles((prev) => {
        newFiles = prev.map((f) =>
          f.name === activeFileName ? { ...f, content: updated } : f,
        );

        if (!isProjectMode) {
          onAnswerChange({ code: updated, language });
        } else {
          onAnswerChange({
            code: JSON.stringify(newFiles),
            language,
          });
        }

        return newFiles;
      });
    },
    [activeFileName, isProjectMode, onAnswerChange, language],
  );

  const openTab = useCallback((fileName: string) => {
    setActiveFileName(fileName);
    setOpenedTabs((p) => (p.includes(fileName) ? p : [...p, fileName]));
    setSidePanel("explorer");
  }, []);

  const closeTab = useCallback(
    (fileName: string) => {
      setOpenedTabs((p) => {
        const next = p.filter((t) => t !== fileName);
        if (fileName === activeFileName && next.length > 0) {
          setActiveFileName(next[next.length - 1]);
        } else if (next.length === 0) {
          setActiveFileName("");
        }
        return next;
      });
    },
    [activeFileName],
  );

  // ─── Execution Logic ────────────────────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLastError(undefined);
    setBottomPanel("console");
    setConsoleLog((p) => [
      ...p,
      {
        id: uid(),
        type: "run-start",
        text: `Running ${activeFileName}...`,
        time: new Date(),
      },
    ]);

    try {
      const source_code = isProjectMode
        ? JSON.stringify(files)
        : (activeFile?.content ?? "");
      const result = await QuizApiService.runCode(question.id, {
        code: source_code,
        language,
        stdin: stdinValue,
      });

      const entry: ConsoleEntry = {
        id: uid(),
        type: result.success ? "stdout" : "stderr",
        text:
          result.data.stdout ||
          result.data.stderr ||
          result.data.status ||
          "No output",
        time: new Date(),
        execMs: result.data.execution_time
          ? result.data.execution_time * 1000
          : undefined,
        memKb: result.data.memory_used ? result.data.memory_used : undefined,
      };

      setConsoleLog((p) => [...p, entry]);
      if (!result.success)
        setLastError(result.data.stderr || "Execution failed");
    } catch (err: any) {
      setConsoleLog((p) => [
        ...p,
        {
          id: uid(),
          type: "stderr",
          text: err.message || "Execution failed",
          time: new Date(),
        },
      ]);
      setLastError(err.message);
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning,
    activeFileName,
    isProjectMode,
    files,
    activeFile,
    language,
    stdinValue,
  ]);

  const runTests = useCallback(async () => {
    if (isTesting || !submissionId) return;
    setIsTesting(true);
    setBottomPanel("results");
    try {
      const code = isProjectMode
        ? JSON.stringify(files)
        : (activeFile?.content ?? "");
      const res = await QuizApiService.submitQuestionAnswer(
        submissionId,
        question.id,
        { code, language },
      );
      if (res.data?.grading_details?.test_results) {
        setTestResults(res.data.grading_details.test_results);
      } else {
        toast.info("Tests submitted. Waiting for results...");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to run tests");
    } finally {
      setIsTesting(false);
    }
  }, [
    isTesting,
    submissionId,
    isProjectMode,
    files,
    activeFile,
    question.id,
    language,
  ]);

  const resetCode = useCallback(() => {
    if (window.confirm("Reset code to starter template?")) {
      const initialFiles = buildInitialFiles(codingData, null);
      setFiles(initialFiles);
      setActiveFileName(initialFiles[0]?.name ?? "");
      setOpenedTabs([initialFiles[0]?.name]);
      onAnswerChange({ code: initialFiles[0]?.content || "", language });
    }
  }, [codingData, language, onAnswerChange]);

  // ─── Event handlers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleSetSidePanel = (e: any) => {
      if (e.detail) setSidePanel(e.detail);
    };
    const handleRun = () => runCode();
    const handleTest = () => runTests();
    const handleReset = () => resetCode();
    const handleLoadFiles = (e: any) => {
      if (e.detail) {
        const newFiles = e.detail;
        setFiles(newFiles);
        onAnswerChange({
          code: isProjectMode
            ? JSON.stringify(newFiles)
            : newFiles[0]?.content || "",
          language,
        });
      }
    };

    document.addEventListener("codespace:set-sidepanel", handleSetSidePanel);
    document.addEventListener("codespace:run", handleRun);
    document.addEventListener("codespace:test", handleTest);
    document.addEventListener("codespace:reset", handleReset);
    document.addEventListener("codespace:loadfiles", handleLoadFiles);

    return () => {
      document.removeEventListener(
        "codespace:set-sidepanel",
        handleSetSidePanel,
      );
      document.removeEventListener("codespace:run", handleRun);
      document.removeEventListener("codespace:test", handleTest);
      document.removeEventListener("codespace:reset", handleReset);
      document.removeEventListener("codespace:loadfiles", handleLoadFiles);
    };
  }, [runCode, runTests, resetCode, onAnswerChange, isProjectMode, language]);

  // ─── Resize handlers ────────────────────────────────────────────────────────
  const startDragH = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingH.current = true;
      const startX = e.clientX;
      const startW = sidePanelWidth;
      const onMove = (ev: MouseEvent) => {
        if (!draggingH.current) return;
        setSidePanelWidth(
          Math.max(160, Math.min(450, startW + ev.clientX - startX)),
        );
      };
      const onUp = () => {
        draggingH.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [sidePanelWidth],
  );

  const startDragV = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingV.current = true;
      const startY = e.clientY;
      const startH = bottomPanelHeight;
      const onMove = (ev: MouseEvent) => {
        if (!draggingV.current) return;
        setBottomPanelHeight(
          Math.max(120, Math.min(520, startH + startY - ev.clientY)),
        );
      };
      const onUp = () => {
        draggingV.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [bottomPanelHeight],
  );

  // ─── Layout Actions ───────────────────────────────────────────────────────
  const openPreviewInTab = useCallback(() => {
    setOpenedTabs((prev) => {
      if (prev.includes(PREVIEW_TAB_ID)) return prev;
      return [...prev, PREVIEW_TAB_ID];
    });
    setActiveFileName(PREVIEW_TAB_ID);
    setBottomPanel(null); // Hide from bottom panel when moved to tab
    setIsPreviewSplit(false); // Disable split if moving to tab
  }, []);

  const togglePreviewSplit = useCallback(() => {
    setIsPreviewSplit((prev) => {
      const next = !prev;
      if (next) {
        setBottomPanel(null); // Hide from bottom panel when split
        // Ensure we are not on the preview tab if we split
        if (activeFileName === PREVIEW_TAB_ID) {
          setActiveFileName(files[0]?.name || "main.js");
        }
      }
      return next;
    });
  }, [activeFileName, files]);

  const startDragSplit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingSplit.current = true;
      const onMove = (ev: MouseEvent) => {
        if (!draggingSplit.current) return;
        const container = document.getElementById("codespace-main-container");
        if (container) {
          const rect = container.getBoundingClientRect();
          const newWidth = ((ev.clientX - rect.left) / rect.width) * 100;
          setSplitWidth(Math.max(20, Math.min(80, newWidth)));
        }
      };
      const onUp = () => {
        draggingSplit.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setSplitWidth],
  );

  // ─── Sidebar panel toggle ───────────────────────────────────────────────────
  const toggleSide = (panel: SidePanel) => {
    setSidePanel((p) => (p === panel ? null : panel));
  };

  // ─── AI context ─────────────────────────────────────────────────────────────
  const aiContext = useMemo(() => {
    if (!isProjectMode) return activeFile?.content ?? "";
    return files
      .map((f) => `// ==== ${f.name} ====\n${f.content}`)
      .join("\n\n");
  }, [isProjectMode, files, activeFile]);

  const passedCount = testResults.filter((r) => r.passed).length;
  const allPassed =
    testResults.length > 0 && testResults.every((r) => r.passed);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white relative">
      <CodeSpaceWithToolbar
        {...props}
        isProjectMode={isProjectMode}
        files={files}
        language={language}
        isRunning={isRunning}
        isTesting={isTesting}
        isWebLang={isWebLang}
        isStarted={isStarted}
        onSetIsStarted={setIsStarted}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-2 flex-shrink-0">
          <ActivityBtn
            icon={<BookOpen size={24} />}
            label="Problem Description"
            active={sidePanel === "problem"}
            onClick={() => toggleSide("problem")}
          />
          <ActivityBtn
            icon={<Files size={24} />}
            label="Explorer"
            active={sidePanel === "explorer"}
            onClick={() => toggleSide("explorer")}
          />
          <ActivityBtn
            icon={<FlaskConical size={24} />}
            label="Test Results"
            active={bottomPanel === "results"}
            badge={testResults.length > 0 ? passedCount : undefined}
            onClick={() => {
              setBottomPanel((p) => (p === "results" ? null : "results"));
            }}
          />
          <ActivityBtn
            icon={<Sparkles size={24} />}
            label="AI Assistant"
            active={sidePanel === "ai"}
            onClick={() => toggleSide("ai")}
          />
          <div className="flex-1" />
          <ActivityBtn
            icon={<Bug size={24} />}
            label="Debug Console"
            active={bottomPanel === "console"}
            onClick={() => {
              setBottomPanel((p) => (p === "console" ? null : "console"));
            }}
          />
        </div>

        {/* Side Panel */}
        <AnimatePresence mode="wait">
          {sidePanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidePanelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-[#252526] border-r border-[#1e1e1e] flex flex-col relative flex-shrink-0"
            >
              <div className="flex items-center justify-between px-4 h-9 uppercase text-[11px] font-bold text-[#bbbbbb] tracking-wider">
                <span>{sidePanel}</span>
                <button
                  onClick={() => setSidePanel(null)}
                  className="hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {sidePanel === "explorer" && (
                  <FileExplorer
                    files={files}
                    activeFile={activeFileName}
                    onFileSelect={(fileName) => {
                      if (fileName !== activeFileName) {
                        openTab(fileName);
                      }
                    }}
                    onFilesChange={(updatedFiles) => {
                      setFiles(updatedFiles);
                      const newFileNames = new Set(
                        updatedFiles.map((f) => f.name),
                      );
                      setOpenedTabs((p) =>
                        p.filter(
                          (t) => newFileNames.has(t) || t === PREVIEW_TAB_ID,
                        ),
                      );
                      const currentCode = isProjectMode
                        ? JSON.stringify(updatedFiles)
                        : updatedFiles[0]?.content || "";
                      onAnswerChange({ code: currentCode, language });
                    }}
                    readOnly={disabled}
                  />
                )}
                {sidePanel === "problem" && (
                  <div className="p-4 space-y-4">
                    <div className="flex gap-2 border-b border-[#3e3e3e] pb-2">
                      <button
                        onClick={() => setProblemTab("desc")}
                        className={`text-[11px] font-bold px-2 py-1 rounded ${
                          problemTab === "desc"
                            ? "bg-[#3e3e3e] text-white"
                            : "text-[#888] hover:text-[#ccc]"
                        }`}
                      >
                        DESCRIPTION
                      </button>
                      <button
                        onClick={() => setProblemTab("constraints")}
                        className={`text-[11px] font-bold px-2 py-1 rounded ${
                          problemTab === "constraints"
                            ? "bg-[#3e3e3e] text-white"
                            : "text-[#888] hover:text-[#ccc]"
                        }`}
                      >
                        CONSTRAINTS
                      </button>
                    </div>
                    {problemTab === "desc" && (
                      <div className="text-[13px] leading-relaxed text-[#cccccc]">
                        <RichTextDisplay
                          content={
                            question.questionBank?.question_text ||
                            "No description available."
                          }
                          className="prose-invert prose-sm max-w-none"
                        />
                      </div>
                    )}
                    {problemTab === "constraints" && (
                      <div className="text-[13px] leading-relaxed text-[#cccccc] space-y-2">
                        {codingData.constraints?.length ? (
                          codingData.constraints
                            .split("\n")
                            .filter(Boolean)
                            .map((c: string, i: number) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-blue-400">•</span>
                                <span>{c}</span>
                              </div>
                            ))
                        ) : (
                          <span className="italic opacity-50">
                            No constraints defined.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {sidePanel === "ai" && (
                  <AiSocraticChat
                    questionId={question.id}
                    currentCode={aiContext}
                    language={language}
                    lastError={lastError}
                  />
                )}
              </div>

              {/* Drag handle */}
              <div
                onMouseDown={startDragH}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500 transition-colors z-10"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center bg-[#252526] h-9 overflow-x-auto no-scrollbar">
            {openedTabs.map((fileName) => {
              const file = files.find((f) => f.name === fileName);
              const isPreview = fileName === PREVIEW_TAB_ID;
              const ext = isPreview
                ? "html"
                : (fileName.split(".").pop() ?? "");
              const color = TAB_COLOR[ext] ?? "#888";

              return (
                <div
                  key={fileName}
                  onClick={() => setActiveFileName(fileName)}
                  className={`flex items-center gap-2 px-3 h-full cursor-pointer select-none border-r border-[#1e1e1e] min-w-[120px] max-w-[200px] transition-all group ${
                    activeFileName === fileName
                      ? "bg-[#1e1e1e] text-white shadow-[0_-2px_0_inset_#007acc]"
                      : "bg-[#2d2d2d] text-[#969696] hover:bg-[#2a2d2e]"
                  }`}
                >
                  {isPreview ? (
                    <Globe size={14} className="text-blue-400" />
                  ) : (
                    <FileCode2 size={14} style={{ color }} />
                  )}
                  <span className="text-[12px] truncate flex-1">
                    {isPreview ? "Live Preview" : fileName}
                  </span>
                  {!isPreview && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(fileName);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#454545] rounded"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            id="codespace-main-container"
            className="flex-1 flex flex-col relative overflow-hidden"
          >
            <div className="flex-1 flex overflow-hidden">
              {/* Main Editor */}
              <div
                className="h-full relative transition-all duration-300 ease-in-out"
                style={{
                  width: isPreviewSplit ? `${splitWidth}%` : "100%",
                }}
              >
                {activeFileName === PREVIEW_TAB_ID ? (
                  <LivePreviewPanel
                    files={files}
                    activeFile={activeFileName}
                    language={language}
                  />
                ) : (
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={activeFile?.language ?? language}
                    value={activeFile?.content ?? ""}
                    onChange={handleCodeChange}
                    onMount={(editor) => {
                      editorRef.current = editor;
                      editor.focus();
                    }}
                    options={{
                      fontSize: 14,
                      fontFamily:
                        "'Fira Code', 'Cascadia Code', Consolas, monospace",
                      fontLigatures: true,
                      minimap: { enabled: true, side: "right", scale: 0.75 },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 16, bottom: 16 },
                      smoothScrolling: true,
                      cursorSmoothCaretAnimation: "on",
                      renderLineHighlight: "all",
                      glyphMargin: true,
                      lineNumbersMinChars: 3,
                      folding: true,
                      bracketPairColorization: { enabled: true },
                      guides: { bracketPairs: true, indentation: true },
                      wordWrap: "on",
                      readOnly: disabled,
                    }}
                  />
                )}

                {/* Split handle */}
                {isPreviewSplit && (
                  <div
                    onMouseDown={startDragSplit}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-all z-20"
                  />
                )}
              </div>

              {/* Split Preview */}
              {isPreviewSplit && (
                <div
                  className="h-full bg-white transition-all duration-300 ease-in-out"
                  style={{ width: `${100 - splitWidth}%` }}
                >
                  <LivePreviewPanel
                    files={files}
                    activeFile={activeFileName}
                    language={language}
                  />
                </div>
              )}
            </div>

            {/* Bottom Panel */}
            <AnimatePresence>
              {bottomPanel && !isPreviewSplit && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: bottomPanelHeight }}
                  exit={{ height: 0 }}
                  className="bg-[#1e1e1e] border-t border-[#333] flex flex-col relative flex-shrink-0"
                >
                  {/* Drag handle */}
                  <div
                    onMouseDown={startDragV}
                    className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/30 active:bg-blue-500 transition-colors z-10"
                  />

                  <div className="flex items-center justify-between px-4 h-9 bg-[#252526] uppercase text-[11px] font-bold text-[#bbbbbb] tracking-wider">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setBottomPanel("console")}
                        className={`hover:text-white transition-colors ${
                          bottomPanel === "console"
                            ? "text-white border-b-2 border-blue-500"
                            : ""
                        }`}
                      >
                        OUTPUT
                      </button>
                      <button
                        onClick={() => setBottomPanel("results")}
                        className={`hover:text-white transition-colors ${
                          bottomPanel === "results"
                            ? "text-white border-b-2 border-blue-500"
                            : ""
                        }`}
                      >
                        TEST RESULTS
                      </button>
                      {isWebLang && (
                        <button
                          onClick={() => setBottomPanel("preview")}
                          className={`hover:text-white transition-colors ${
                            bottomPanel === "preview"
                              ? "text-white border-b-2 border-blue-500"
                              : ""
                          }`}
                        >
                          PREVIEW
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setBottomPanel(null)}
                      className="hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                    {bottomPanel === "console" && (
                      <div className="p-4 font-mono text-[12px] space-y-1">
                        {consoleLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex gap-3 items-start animate-in slide-in-from-left-2"
                          >
                            <span className="opacity-30 whitespace-nowrap">
                              [
                              {entry.time.toLocaleTimeString([], {
                                hour12: false,
                              })}
                              ]
                            </span>
                            <pre
                              className={`whitespace-pre-wrap flex-1 ${
                                entry.type === "stderr"
                                  ? "text-rose-400"
                                  : entry.type === "info"
                                    ? "text-blue-400"
                                    : entry.type === "success"
                                      ? "text-emerald-400"
                                      : entry.type === "run-start"
                                        ? "text-amber-400 italic"
                                        : "text-[#cccccc]"
                              }`}
                            >
                              {entry.text}
                            </pre>
                            {(entry.execMs || entry.memKb) && (
                              <div className="text-[10px] opacity-40 whitespace-nowrap flex gap-2">
                                {entry.execMs && (
                                  <span>{Math.round(entry.execMs)}ms</span>
                                )}
                                {entry.memKb && (
                                  <span>
                                    {Math.round(entry.memKb / 1024)}MB
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="mt-4 pt-4 border-t border-[#333]">
                          <div className="flex items-center gap-2 mb-2 text-blue-400">
                            <Terminal size={14} />
                            <span className="font-bold">STDIN</span>
                          </div>
                          <textarea
                            value={stdinValue}
                            onChange={(e) => setStdinValue(e.target.value)}
                            placeholder="Type input to provide during execution..."
                            className="w-full h-24 bg-[#0a0a0a] text-[#ddd] border border-[#333] rounded p-2 focus:border-blue-500 outline-none transition-colors"
                          />
                        </div>
                      </div>
                    )}
                    {bottomPanel === "results" && (
                      <div className="p-4 space-y-3">
                        {testResults.length > 0 ? (
                          <>
                            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                              <div
                                className={`p-2 rounded-lg ${allPassed ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}
                              >
                                {allPassed ? (
                                  <CheckCircle size={20} />
                                ) : (
                                  <AlertTriangle size={20} />
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm">
                                  {allPassed
                                    ? "All Tests Passed!"
                                    : "Some Tests Failed"}
                                </h4>
                                <p className="text-xs text-slate-400">
                                  Score:{" "}
                                  {Math.round(
                                    (passedCount / testResults.length) * 100,
                                  )}
                                  % ({passedCount}/{testResults.length})
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {testResults.map((result, idx) => (
                                <div
                                  key={idx}
                                  className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                                    result.passed
                                      ? "bg-emerald-500/5 border-emerald-500/20"
                                      : "bg-rose-500/5 border-rose-500/20"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    {result.passed ? (
                                      <Check
                                        size={16}
                                        className="text-emerald-500"
                                      />
                                    ) : (
                                      <X size={16} className="text-rose-500" />
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-[12px] font-medium text-white">
                                        Test Case {idx + 1}:{" "}
                                        {result.name || "Default"}
                                      </span>
                                      {!result.passed && (
                                        <span className="text-[10px] text-rose-400 mt-1">
                                          {result.error || "Wrong output"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {result.time}s
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <FlaskConical
                              size={32}
                              className="mb-3 opacity-20"
                            />
                            <p className="text-sm">
                              Click 'Test' to run all validation cases.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {bottomPanel === "preview" && (
                      <LivePreviewPanel
                        files={files}
                        activeFile={activeFileName}
                        language={language}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Start Coding Overlay */}
        {!isStarted && (
          <div className="absolute inset-0 z-[100] bg-[#1e1e1e]/90 backdrop-blur-md flex flex-col items-center justify-start p-8 pt-14 text-center animate-in fade-in duration-500">
            <div className="max-w-md w-full">
              <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
                <Terminal size={40} className="text-blue-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-3">
                Ready to code?
              </h2>
              <p className="text-[#cccccc] mb-8 leading-relaxed">
                Click the button below to open the workspace and start working
                on your solution.
              </p>
              <button
                onClick={() => {
                  setIsStarted(true);
                  if (onToggleFullscreen) onToggleFullscreen(true);
                  // Optionally sync initial answer state
                  onAnswerChange({ code: activeFile?.content || "", language });
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_10px_20px_-10px_rgba(59,130,246,0.5)] hover:-translate-y-1 active:scale-95 group"
              >
                <Zap size={20} className="group-hover:animate-bounce" />
                <span>Start Coding</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
