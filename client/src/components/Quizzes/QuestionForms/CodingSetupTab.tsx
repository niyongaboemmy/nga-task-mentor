import React, { useState, useRef } from "react";
import {
  Eye,
  Plus,
  Trash2,
  ChevronRight,
  Zap,
  Code2,
  Globe,
  Terminal,
  Upload,
  X,
  FileCode2,
  FolderOpen,
} from "lucide-react";
import type { CodingData } from "../../../types/quiz.types";
import { CodePreviewModal } from "../CodePreviewModal";
import { toast } from "react-toastify";

interface CodingSetupTabProps {
  codingData: CodingData;
  onChange: (data: CodingData) => void;
  onLanguageChange: (language: string) => void;
}

// ─── Quick-start templates ────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "algorithm",
    label: "Algorithm",
    icon: <Zap size={18} />,
    color: "#f59e0b",
    description: "Function to solve with test cases",
    languages: ["python", "javascript", "java", "cpp", "typescript"],
    defaultLang: "python",
    singleFile: true,
    starter: {
      python: `def solve(nums):\n    # Write your solution here\n    pass\n\nprint(solve([1, 2, 3]))`,
      javascript: `function solve(nums) {\n  // Write your solution here\n}\n\nconsole.log(solve([1, 2, 3]));`,
      java: `import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`,
      cpp: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint solve(vector<int>& nums) {\n    // Write your solution here\n    return 0;\n}\n\nint main() {\n    vector<int> nums = {1, 2, 3};\n    cout << solve(nums) << endl;\n    return 0;\n}`,
      typescript: `function solve(nums: number[]): number {\n  // Write your solution here\n  return 0;\n}\n\nconsole.log(solve([1, 2, 3]));`,
    } as Record<string, string>,
  },
  {
    id: "web",
    label: "Web Project",
    icon: <Globe size={18} />,
    color: "#3b82f6",
    description: "HTML + CSS + JS with live preview",
    languages: ["html"],
    defaultLang: "html",
    singleFile: false,
    projectFiles: [
      {
        name: "index.html",
        language: "html",
        is_entry_point: true,
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="container">\n    <h1>Hello World</h1>\n    <p>Edit this HTML to get started.</p>\n  </div>\n  <script src="app.js"></script>\n</body>\n</html>`,
      },
      {
        name: "style.css",
        language: "css",
        content: `* { box-sizing: border-box; margin: 0; padding: 0; }\n\nbody {\n  font-family: 'Segoe UI', system-ui, sans-serif;\n  background: #f8fafc;\n  color: #1e293b;\n}\n\n.container {\n  max-width: 800px;\n  margin: 60px auto;\n  padding: 40px;\n  background: white;\n  border-radius: 12px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.08);\n}\n\nh1 { color: #3b82f6; margin-bottom: 12px; }`,
      },
      {
        name: "app.js",
        language: "javascript",
        content: `// JavaScript logic here\nconsole.log("Page loaded!");`,
      },
    ],
  },
  {
    id: "script",
    label: "Script / CLI",
    icon: <Terminal size={18} />,
    color: "#22c55e",
    description: "Single file program with stdin/stdout",
    languages: ["python", "javascript", "java", "cpp", "go", "rust", "ruby"],
    defaultLang: "python",
    singleFile: true,
    starter: {
      python: `import sys\n\ndef main():\n    lines = sys.stdin.read().split()\n    # Write your logic here\n    print("output")\n\nif __name__ == "__main__":\n    main()`,
      javascript: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on('line', l => lines.push(l));\nrl.on('close', () => {\n  // Write your logic here\n  console.log("output");\n});`,
    } as Record<string, string>,
  },
  {
    id: "custom",
    label: "Custom",
    icon: <Code2 size={18} />,
    color: "#8b5cf6",
    description: "Start from a blank editor",
    languages: [],
    defaultLang: "javascript",
    singleFile: true,
    starter: {} as Record<string, string>,
  },
];

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  csharp: "C#",
  php: "PHP",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  html: "HTML",
  css: "CSS",
  react: "React",
  vue: "Vue.js",
};

function getDefaultContent(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: `<!DOCTYPE html>\n<html>\n<body>\n  \n</body>\n</html>`,
    css: `/* Styles */\n`,
    js: `// JavaScript\n`,
    ts: `// TypeScript\n`,
    py: `# Python\n`,
    java: `public class Main {\n  public static void main(String[] args) {}\n}\n`,
  };
  return map[ext] ?? "";
}

function detectLang(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    rs: "rust",
    go: "go",
    rb: "ruby",
    php: "php",
  };
  return map[ext] || "plaintext";
}

// ─── Inline Add-File Dialog ───────────────────────────────────────────────────
const AddFileDialog: React.FC<{
  existingNames: string[];
  onAdd: (name: string) => void;
  onCancel: () => void;
}> = ({ existingNames, onAdd, onCancel }) => {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existingNames.includes(trimmed)) {
      toast.error("A file with that name already exists.");
      return;
    }
    onAdd(trimmed);
  };

  return (
    <div className="border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mt-2">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
        New file name (e.g. utils.js, helper.py)
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="filename.ext"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </form>
    </div>
  );
};

// ─── ZIP Upload Section ───────────────────────────────────────────────────────
const ZipUploadSection: React.FC<{
  onFilesExtracted: (files: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}> = ({ onFilesExtracted }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ name: string; size: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processZip = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      toast.error("Please upload a .zip file");
      return;
    }
    setIsLoading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extracted: any[] = [];
      const previewList: { name: string; size: number }[] = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        // Skip hidden / system files
        const basename = path.split("/").pop() ?? path;
        if (basename.startsWith(".") || basename === "__MACOSX") continue;

        const content = await entry.async("string");
        const lang = detectLang(basename);
        extracted.push({ name: basename, content, language: lang });
        previewList.push({ name: basename, size: content.length });
      }

      if (extracted.length === 0) {
        toast.error("No readable files found in the ZIP.");
        return;
      }

      // Mark first file as entry point
      if (extracted.length > 0) extracted[0].is_entry_point = true;

      setPendingFiles(extracted);
      setPreview(previewList);
    } catch {
      toast.error("Failed to parse ZIP file. Make sure it's a valid archive.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmImport = () => {
    onFilesExtracted(pendingFiles);
    setPendingFiles([]);
    setPreview([]);
    toast.success(`Imported ${pendingFiles.length} files from ZIP!`);
  };

  const cancelImport = () => {
    setPendingFiles([]);
    setPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full">
          📦
        </span>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Upload Codebase ZIP
        </h3>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) processZip(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processZip(f);
          }}
        />
        {isLoading ? (
          <>
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Extracting files…</p>
          </>
        ) : (
          <>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Upload
                size={22}
                className="text-purple-600 dark:text-purple-400"
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop a .zip file here or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                All files will be imported as project files
              </p>
            </div>
          </>
        )}
      </div>

      {/* Preview before confirm */}
      {preview.length > 0 && (
        <div className="mt-3 border border-purple-200 dark:border-purple-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-700">
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-purple-600" />
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                {preview.length} file{preview.length !== 1 ? "s" : ""} found —
                confirm to import
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelImport}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition-colors"
              >
                Import
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {preview.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800"
              >
                <FileCode2 size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1">
                  {f.name}
                </span>
                <span className="text-[10px] text-gray-400">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const CodingSetupTab: React.FC<CodingSetupTabProps> = ({
  codingData,
  onChange,
  onLanguageChange,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(
    codingData.project_files?.[0]?.name ?? null,
  );
  const [showAddFileDialog, setShowAddFileDialog] = useState(false);

  const isProjectMode = Boolean(codingData.project_mode);
  const canPreview = [
    "html",
    "css",
    "react",
    "vue",
    "angular",
    "nextjs",
  ].includes(codingData.language?.toLowerCase() ?? "");

  const applyTemplate = (template: (typeof TEMPLATES)[0]) => {
    setActiveTemplate(template.id);
    const lang = template.defaultLang;
    const isProject = !template.singleFile;

    if (isProject && "projectFiles" in template) {
      onLanguageChange(lang);
      onChange({
        ...codingData,
        language: lang,
        project_mode: true,
        project_files: template.projectFiles as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        starter_code: undefined,
      });
    } else {
      const starter = (template.starter as Record<string, string>)[lang] ?? "";
      onLanguageChange(lang);
      onChange({
        ...codingData,
        language: lang,
        project_mode: false,
        project_files: [],
        starter_code: starter,
      });
    }
  };

  const addProjectFile = (filename: string) => {
    const existing = codingData.project_files ?? [];
    onChange({
      ...codingData,
      project_files: [
        ...existing,
        {
          name: filename,
          content: getDefaultContent(filename),
          language: detectLang(filename),
        },
      ],
    });
    setExpandedFile(filename);
    setShowAddFileDialog(false);
  };

  const handleZipImport = (files: any[]) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    onChange({
      ...codingData,
      project_mode: true,
      project_files: files,
      starter_code: undefined,
    });
    setActiveTemplate("custom");
    setExpandedFile(files[0]?.name ?? null);
  };

  return (
    <div className="space-y-6">
      {/* ── Step 1: Quick-start templates ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
            1
          </span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Project Structure
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                activeTemplate === tpl.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800"
              }`}
            >
              <span
                className="p-2 rounded-lg flex-shrink-0"
                style={{ background: tpl.color + "22", color: tpl.color }}
              >
                {tpl.icon}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                  {tpl.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                  {tpl.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Step 2: Language (for non-project templates) ── */}
      {!isProjectMode && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
              2
            </span>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Language
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "javascript",
                "typescript",
                "python",
                "java",
                "cpp",
                "c",
                "go",
                "rust",
                "ruby",
                "csharp",
                "php",
              ] as const
            ).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  if (activeTemplate) {
                    const tpl = TEMPLATES.find((t) => t.id === activeTemplate);
                    const starter = tpl?.singleFile
                      ? ((tpl.starter as Record<string, string>)[lang] ?? "")
                      : "";
                    onChange({
                      ...codingData,
                      language: lang,
                      starter_code: starter,
                    });
                  }
                  onLanguageChange(lang);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  codingData.language === lang
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {LANG_LABELS[lang] ?? lang}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Starter code (non-project) ── */}
      {!isProjectMode && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                3
              </span>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Starter Code
              </h3>
            </div>
            {canPreview && (
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Eye size={13} /> Preview
              </button>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-500 font-mono">
                main.
                {codingData.language === "python"
                  ? "py"
                  : codingData.language === "java"
                    ? "java"
                    : "js"}
              </span>
            </div>
            <textarea
              value={codingData.starter_code || ""}
              onChange={(e) =>
                onChange({ ...codingData, starter_code: e.target.value })
              }
              placeholder={`// ${codingData.language} starter code…`}
              rows={10}
              className="w-full px-4 py-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm focus:outline-none resize-y"
            />
          </div>
        </div>
      )}

      {/* ── Project files (project mode) ── */}
      {isProjectMode && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                2
              </span>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Project Files
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddFileDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <Plus size={13} /> New file
            </button>
          </div>

          {showAddFileDialog && (
            <AddFileDialog
              existingNames={(codingData.project_files ?? []).map(
                (f) => f.name,
              )}
              onAdd={addProjectFile}
              onCancel={() => setShowAddFileDialog(false)}
            />
          )}

          <div className="space-y-2 mt-2">
            {(codingData.project_files ?? []).map((file) => (
              <div
                key={file.name}
                className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedFile(
                      expandedFile === file.name ? null : file.name,
                    )
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <ChevronRight
                    size={14}
                    className={`text-gray-400 transition-transform ${expandedFile === file.name ? "rotate-90" : ""}`}
                  />
                  <span className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                    {file.name}
                  </span>
                  {file.is_entry_point && (
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">
                      ENTRY
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({
                        ...codingData,
                        project_files: (codingData.project_files ?? []).filter(
                          (f) => f.name !== file.name,
                        ),
                      });
                      if (expandedFile === file.name) setExpandedFile(null);
                    }}
                    disabled={(codingData.project_files?.length ?? 0) <= 1}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-20 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </button>
                {expandedFile === file.name && (
                  <textarea
                    value={file.content}
                    onChange={(e) =>
                      onChange({
                        ...codingData,
                        project_files: (codingData.project_files ?? []).map(
                          (f) =>
                            f.name === file.name
                              ? { ...f, content: e.target.value }
                              : f,
                        ),
                      })
                    }
                    rows={10}
                    className="w-full px-4 py-3 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[13px] focus:outline-none resize-y border-t border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ZIP Upload (always shown) ── */}
      <ZipUploadSection onFilesExtracted={handleZipImport} />

      <CodePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        code={codingData.starter_code || ""}
        language={codingData.language}
      />
    </div>
  );
};
