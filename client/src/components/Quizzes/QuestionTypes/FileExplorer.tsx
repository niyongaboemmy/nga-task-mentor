import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  File,
  FolderOpen,
  Folder,
  Plus,
  FolderPlus,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronDown,
  X,
  Check,
} from "lucide-react";

export interface ProjectFile {
  name: string;
  content: string;
  language: string;
  is_entry_point?: boolean;
}

interface ContextMenu {
  x: number;
  y: number;
  fileName: string;
}

const FILE_ICON_MAP: Record<string, { color: string; icon?: string }> = {
  html: { color: "text-orange-400" },
  css: { color: "text-blue-400" },
  js: { color: "text-yellow-400" },
  jsx: { color: "text-cyan-400" },
  ts: { color: "text-blue-500" },
  tsx: { color: "text-cyan-500" },
  py: { color: "text-green-400" },
  java: { color: "text-red-400" },
  cpp: { color: "text-purple-400" },
  c: { color: "text-purple-300" },
  rs: { color: "text-orange-500" },
  go: { color: "text-teal-400" },
  rb: { color: "text-red-500" },
  php: { color: "text-indigo-400" },
  json: { color: "text-yellow-300" },
  md: { color: "text-slate-300" },
  txt: { color: "text-slate-400" },
};

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return FILE_ICON_MAP[ext]?.color || "text-slate-400";
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
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
    json: "json",
    md: "markdown",
    txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

interface FileExplorerProps {
  files: ProjectFile[];
  activeFile: string;
  onFileSelect: (fileName: string) => void;
  onFilesChange: (files: ProjectFile[]) => void;
  readOnly?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFile,
  onFileSelect,
  onFilesChange,
  readOnly = false,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const newItemRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renamingFile && renameRef.current) renameRef.current.focus();
  }, [renamingFile]);

  useEffect(() => {
    if (isCreating && newItemRef.current) newItemRef.current.focus();
  }, [isCreating]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleRightClick = useCallback(
    (e: React.MouseEvent, fileName: string) => {
      if (readOnly) return;
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, fileName });
    },
    [readOnly],
  );

  const handleRenameStart = (fileName: string) => {
    setContextMenu(null);
    setRenamingFile(fileName);
    setRenameValue(fileName);
  };

  const handleRenameConfirm = () => {
    if (!renamingFile || !renameValue.trim()) {
      setRenamingFile(null);
      return;
    }
    const trimmed = renameValue.trim();
    if (trimmed === renamingFile) {
      setRenamingFile(null);
      return;
    }
    if (files.some((f) => f.name === trimmed)) {
      setRenamingFile(null);
      return;
    }
    const updated = files.map((f) =>
      f.name === renamingFile
        ? { ...f, name: trimmed, language: detectLanguage(trimmed) }
        : f,
    );
    onFilesChange(updated);
    if (activeFile === renamingFile) onFileSelect(trimmed);
    setRenamingFile(null);
  };

  const handleDelete = (fileName: string) => {
    setContextMenu(null);
    if (files.length <= 1) return;
    const updated = files.filter((f) => f.name !== fileName);
    onFilesChange(updated);
    if (activeFile === fileName) onFileSelect(updated[0].name);
  };

  const handleCreateConfirm = () => {
    if (!newItemName.trim()) {
      setIsCreating(null);
      return;
    }
    const name = newItemName.trim();
    if (files.some((f) => f.name === name)) {
      setIsCreating(null);
      return;
    }
    const newFile: ProjectFile = {
      name,
      content: isCreating === "folder" ? "" : getStarterContent(name),
      language: detectLanguage(name),
    };
    onFilesChange([...files, newFile]);
    onFileSelect(name);
    setIsCreating(null);
    setNewItemName("");
  };

  return (
    <div
      className="w-full flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Explorer
        </span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCreating("file");
                setNewItemName("");
              }}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded"
              title="New File"
            >
              <Plus size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCreating("folder");
                setNewItemName("");
              }}
              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded"
              title="New Folder"
            >
              <FolderPlus size={13} />
            </button>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto py-1">
        {files.map((file) => {
          const isActive = file.name === activeFile;
          const isRenaming = renamingFile === file.name;
          const color = getFileColor(file.name);

          return (
            <div
              key={file.name}
              onContextMenu={(e) => handleRightClick(e, file.name)}
              onClick={() => {
                if (!isRenaming) onFileSelect(file.name);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer group transition-colors text-sm ${
                isActive
                  ? "bg-slate-700/70 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <File size={14} className={`flex-shrink-0 ${color}`} />
              {isRenaming ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameConfirm();
                    if (e.key === "Escape") setRenamingFile(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-slate-600 border border-blue-500 rounded px-1 text-xs text-white outline-none min-w-0"
                />
              ) : (
                <span className="flex-1 text-xs truncate font-mono">
                  {file.name}
                </span>
              )}
              {file.is_entry_point && !isRenaming && (
                <span className="text-[9px] text-blue-400 font-bold">MAIN</span>
              )}
            </div>
          );
        })}

        {/* New item input */}
        {isCreating && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            {isCreating === "folder" ? (
              <FolderOpen size={14} className="text-yellow-400 flex-shrink-0" />
            ) : (
              <File size={14} className="text-slate-400 flex-shrink-0" />
            )}
            <input
              ref={newItemRef}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onBlur={handleCreateConfirm}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateConfirm();
                if (e.key === "Escape") {
                  setIsCreating(null);
                  setNewItemName("");
                }
              }}
              placeholder={isCreating === "folder" ? "folder/" : "filename.js"}
              className="flex-1 bg-slate-700 border border-blue-500 rounded px-1 text-xs text-white outline-none font-mono min-w-0"
            />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 min-w-[150px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleRenameStart(contextMenu.fileName)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <Edit3 size={12} /> Rename
          </button>
          <div className="border-t border-slate-700 my-1" />
          <button
            onClick={() => handleDelete(contextMenu.fileName)}
            disabled={files.length <= 1}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/40 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

function getStarterContent(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const starters: Record<string, string> = {
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>',
    css: "/* Styles */\n",
    js: "// JavaScript\n",
    ts: "// TypeScript\n",
    py: "# Python\n",
    java: "public class Main {\n  public static void main(String[] args) {\n    \n  }\n}\n",
    cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
    json: "{\n  \n}\n",
  };
  return starters[ext] || "";
}

export { detectLanguage };
