import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  ImageIcon,
  FileCode,
  Archive,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";
import { extOf, formatBytes, mergeFiles, parseExtensions } from "../../utils/fileList";

interface FileDropzoneProps {
  /** Receives the whole new list (existing files plus the ones just added). */
  onFilesSelected: (files: File[]) => void;
  /** Extensions, comma-separated, with or without dots: "pdf, .docx, zip". Empty = any. */
  allowedTypes?: string;
  maxFiles?: number;
  /** Per-file limit in MB; 0 = no limit. */
  maxFileSizeMB?: number;
  existingFiles?: File[];
  className?: string;
  disabled?: boolean;
  /** Replaces the default "Allowed formats: …" line under the title. */
  hint?: string;
}

const FileThumb: React.FC<{ file: File }> = ({ file }) => {
  const isImage = file.type.startsWith("image/") && file.type !== "image/svg+xml";
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (url) {
    return <img src={url} alt="" className="w-10 h-10 rounded-xl object-cover" />;
  }
  const ext = extOf(file.name);
  const Icon = ["pdf", "doc", "docx", "txt", "csv"].includes(ext)
    ? FileText
    : ["zip", "rar", "7z"].includes(ext)
      ? Archive
      : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ? ImageIcon
        : FileCode;
  return (
    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
      <Icon className="w-5 h-5" />
    </div>
  );
};

const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  allowedTypes = "",
  maxFiles = 10,
  maxFileSizeMB = 0,
  existingFiles = [],
  className = "",
  disabled = false,
  hint,
}) => {
  const [dragDepth, setDragDepth] = useState(0);
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragging = dragDepth > 0;

  const extensions = useMemo(() => parseExtensions(allowedTypes), [allowedTypes]);
  // The accept attribute needs ".ext" tokens — a bare "zip" is invalid and
  // makes some pickers (Safari / the desktop app's WebKit) grey out every file.
  const accept = extensions.map((e) => `.${e}`).join(",");

  const processFiles = (incoming: File[]) => {
    if (disabled || incoming.length === 0) return;
    const result = mergeFiles(existingFiles, incoming, {
      extensions,
      maxFiles,
      maxBytes: maxFileSizeMB * 1024 * 1024,
    });
    setRejected(result.rejected);
    if (result.files !== existingFiles) onFilesSelected(result.files);
  };

  const openPicker = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Add files: click, or drag and drop"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragDepth((d) => d + 1);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragDepth((d) => Math.max(0, d - 1))}
        onDrop={(e) => {
          e.preventDefault();
          setDragDepth(0);
          processFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={openPicker}
        className={`relative border-2 border-dashed rounded-2xl px-6 py-8 transition-all flex flex-col items-center justify-center gap-3 group outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          disabled
            ? "opacity-60 cursor-not-allowed border-gray-200 dark:border-gray-700"
            : isDragging
              ? "cursor-copy border-blue-500 bg-blue-50/70 dark:bg-blue-900/20 scale-[1.01]"
              : "cursor-pointer border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-gray-800/50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            processFiles(Array.from(e.target.files || []));
            // Let the same file be picked again after it was removed.
            e.target.value = "";
          }}
          multiple={maxFiles > 1}
          accept={accept || undefined}
          className="hidden"
          disabled={disabled}
          data-testid="file-dropzone-input"
        />

        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            isDragging
              ? "bg-blue-500 text-white scale-110 rotate-3"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-105"
          }`}
        >
          <Upload className={`w-7 h-7 ${isDragging ? "animate-bounce" : ""}`} />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            {isDragging ? (
              "Drop to add"
            ) : (
              <>
                <span className="text-blue-600 dark:text-blue-400">Click to browse</span> or drag
                files here
              </>
            )}
          </p>
          <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/70 mt-1">
            {hint ??
              [
                extensions.length ? `Allowed: ${extensions.join(", ")}` : "Any file type",
                maxFileSizeMB ? `up to ${maxFileSizeMB} MB each` : "",
                maxFiles > 1 ? `max ${maxFiles} files` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {rejected.length > 0 && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <ul className="flex-1 space-y-0.5">
              {rejected.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <span className="font-semibold">{r.name}</span>: {r.reason}
                </li>
              ))}
            </ul>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setRejected([])}
              className="p-0.5 rounded hover:bg-amber-100 dark:hover:bg-amber-800/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {existingFiles.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <AnimatePresence initial={false}>
            {existingFiles.map((file, index) => (
              <motion.li
                layout
                key={`${file.name}-${file.size}-${file.lastModified}`}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex items-center gap-3 p-2.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm"
              >
                <FileThumb file={file} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[11px] text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejected([]);
                    onFilesSelected(existingFiles.filter((_, i) => i !== index));
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};

export default FileDropzone;
