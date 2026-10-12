import React, { useState } from "react";
import { FilePlus2, FileText, Pencil, Trash2 } from "lucide-react";
import type { CodeFile } from "../../services/codeApi";
import { isHiddenFile } from "./tests";

/** The project's files: open one, and (when editable) add, rename or delete. */
const FileTree: React.FC<{
  files: CodeFile[];
  active: string | null;
  readOnly?: boolean;
  onOpen: (path: string) => void;
  onAdd?: (path: string) => void;
  onRename?: (from: string, to: string) => void;
  onDelete?: (path: string) => void;
}> = ({ files, active, readOnly, onOpen, onAdd, onRename, onDelete }) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const visible = files.filter((f) => !isHiddenFile(f.path));
  const valid = (p: string) => /^[\w.\-/ ]+$/.test(p) && !p.startsWith("/") && !p.split("/").some((s) => s === ".." || s === "") && !files.some((f) => f.path === p);

  const submitNew = () => {
    const p = name.trim();
    if (!valid(p)) return;
    onAdd?.(p);
    setName("");
    setAdding(false);
  };

  return (
    <div className="flex h-full flex-col" data-testid="file-tree">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">Files</span>
        {!readOnly && onAdd && (
          <button type="button" onClick={() => setAdding((a) => !a)} aria-label="New file" title="New file" className="rounded p-1 text-text-secondary-light hover:bg-gray-100 dark:hover:bg-white/10">
            <FilePlus2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {adding && (
        <form
          className="px-2 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitNew();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="e.g. utils.py or src/app.js"
            aria-label="New file name"
            className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-primary dark:border-white/15 dark:bg-slate-800"
          />
          {name.trim() && !valid(name.trim()) && <p className="mt-1 text-[11px] text-rose-600">Use letters, numbers, . - _ / and a new name.</p>}
        </form>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto pb-2" role="listbox" aria-label="Files">
        {visible.map((f) => (
          <li key={f.path} role="option" aria-selected={f.path === active} className="group">
            {renaming === f.path ? (
              <form
                className="px-2 py-0.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const to = (new FormData(e.currentTarget).get("name") as string).trim();
                  if (to && to !== f.path && valid(to)) onRename?.(f.path, to);
                  setRenaming(null);
                }}
              >
                <input
                  name="name"
                  autoFocus
                  defaultValue={f.path}
                  onBlur={() => setRenaming(null)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                  aria-label={`Rename ${f.path}`}
                  className="h-7 w-full rounded-md border border-primary bg-white px-2 text-xs outline-none dark:bg-slate-800"
                />
              </form>
            ) : (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 text-xs ${
                  f.path === active ? "bg-primary-soft font-semibold text-primary dark:bg-blue-500/15 dark:text-blue-300" : "text-text-primary-light hover:bg-gray-50 dark:text-text-primary-dark dark:hover:bg-white/5"
                }`}
              >
                <button type="button" onClick={() => onOpen(f.path)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  <span className="truncate">{f.path}</span>
                </button>
                {!readOnly && (
                  <span className="hidden shrink-0 gap-0.5 group-hover:flex group-focus-within:flex">
                    {onRename && (
                      <button type="button" onClick={() => setRenaming(f.path)} aria-label={`Rename ${f.path}`} className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-white/10">
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {onDelete && visible.length > 1 && (
                      <button
                        type="button"
                        onClick={() => window.confirm(`Delete ${f.path}?`) && onDelete(f.path)}
                        aria-label={`Delete ${f.path}`}
                        className="rounded p-0.5 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileTree;
