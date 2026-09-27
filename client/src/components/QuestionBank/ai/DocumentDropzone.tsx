import React, { useRef, useState } from "react";
import { AlertTriangle, FileText, UploadCloud, X } from "lucide-react";
import { WARN_FILE_BYTES, checkFile, formatBytes } from "./documentFile";

interface Props {
  file: File | null;
  onFile: (file: File | null) => void;
  onReject: (reason: string) => void;
}

const DocumentDropzone: React.FC<Props> = ({ file, onFile, onReject }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = (f?: File | null) => {
    if (!f) return;
    const problem = checkFile(f);
    if (problem) onReject(problem);
    else onFile(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF or DOCX document"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
          dragging
            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/25 scale-[1.01]"
            : file
              ? "border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30"
              : "border-gray-300 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50/40 dark:hover:bg-violet-900/10"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          data-testid="ai-doc-input"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => take(e.target.files?.[0])}
          className="hidden"
        />
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <UploadCloud className="w-7 h-7 text-white" />
        </div>
        <p className="mt-4 text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
          {dragging ? "Drop it here" : file ? "Drop another file to replace it" : "Drag & drop, or click to choose a file"}
        </p>
        <p className="mt-1 text-xs text-text-secondary-light dark:text-text-secondary-dark">
          PDF or DOCX · up to 20 MB · scanned (image-only) PDFs can't be read
        </p>
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <FileText className="w-4.5 h-4.5 text-violet-600 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-text-primary-light dark:text-text-primary-dark">{file.name}</p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => onFile(null)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {file && file.size > WARN_FILE_BYTES && (
        <p className="flex items-start gap-2 text-xs rounded-xl px-3 py-2 bg-amber-50 dark:bg-amber-900/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Large document — reading it takes longer, and only the first ~80,000 characters are used.
        </p>
      )}
    </div>
  );
};

export default DocumentDropzone;
