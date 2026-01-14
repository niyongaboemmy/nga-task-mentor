import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RotateCcw,
  Eye,
} from "lucide-react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  onPreview?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  disabled = false,
  placeholder = "// Start coding here...",
  minHeight = "400px",
  onPreview,
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [initialValue] = useState(value);

  useEffect(() => {
    const lines = value.split("\n").length;
    setLineCount(lines);
  }, [value]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleReset = () => {
    onChange(initialValue);
    toast.success("Code reset to initial state!", {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);

      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const getLanguageIcon = (lang: string) => {
    const icons: Record<string, string> = {
      javascript: "🟨",
      python: "🐍",
      java: "☕",
      cpp: "⚡",
      csharp: "🔷",
      html: "🎨",
      css: "💅",
      react: "⚛️",
      vue: "💚",
      angular: "🅰️",
      typescript: "🔷",
      php: "🐘",
      ruby: "💎",
      go: "🐹",
      rust: "🦀",
      swift: "🍎",
      kotlin: "🤖",
      sql: "🗄️",
    };
    return icons[lang] || "💻";
  };

  return (
    <div
      className={`${
        isFullscreen
          ? "fixed inset-0 z-50 bg-white dark:bg-gray-900 p-4"
          : "relative"
      }`}
    >
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-lg">
        {/* Editor Header */}
        <div className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 px-4 py-3 border-b-2 border-gray-300 dark:border-gray-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getLanguageIcon(language)}</span>
            <div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                {language}
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {lineCount} {lineCount === 1 ? "line" : "lines"} •{" "}
                {value.length} characters
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onPreview && (
              <button
                onClick={onPreview}
                className="p-2 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors group"
                title="Preview code in browser"
              >
                <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white" />
              </button>
            )}
            {!disabled && (
              <button
                onClick={handleReset}
                className="p-2 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors group"
                title="Reset to initial code"
              >
                <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white" />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors group"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors group"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="relative flex">
          {/* Line Numbers */}
          <div className="bg-gray-50 dark:bg-gray-900 px-3 py-4 border-r border-gray-300 dark:border-gray-600 select-none">
            <div className="font-mono text-xs text-gray-500 dark:text-gray-400 text-right leading-6">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>
          </div>

          {/* Code Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              className={`w-full p-4 font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-0 focus:ring-0 focus:outline-none resize-none leading-6 ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              }`}
              style={{
                minHeight: isFullscreen ? "calc(100vh - 120px)" : minHeight,
                tabSize: 2,
              }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Editor Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
            <span>💡 Press Tab for indentation</span>
            <span>•</span>
            <span>Ctrl+C to copy</span>
          </div>
          {disabled && (
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">
              🔒 Read-only mode
            </span>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      {!disabled && (
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
            <span>⌨️</span>
            <div>
              <strong>Keyboard Shortcuts:</strong> Tab (indent) • Shift+Tab
              (outdent) • Ctrl+Z (undo) • Ctrl+Y (redo)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
