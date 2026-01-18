import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  ImageIcon,
  FileCode,
  Archive,
  Trash2,
} from "lucide-react";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  allowedTypes?: string;
  maxFiles?: number;
  existingFiles?: File[];
  className?: string;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  allowedTypes = "",
  maxFiles = 10,
  existingFiles = [],
  className = "",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  };

  const processFiles = (files: File[]) => {
    // Filter by allowed types if provided
    let filteredFiles = files;
    if (allowedTypes) {
      const types = allowedTypes.split(",").map((t) => t.trim().toLowerCase());
      filteredFiles = files.filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ext && types.includes(ext);
      });
    }

    // Limit by max files
    const totalFiles = existingFiles.length + filteredFiles.length;
    if (totalFiles > maxFiles) {
      filteredFiles = filteredFiles.slice(0, maxFiles - existingFiles.length);
    }

    if (filteredFiles.length > 0) {
      onFilesSelected(filteredFiles);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "svg"].includes(ext || ""))
      return <ImageIcon className="w-5 h-5" />;
    if (["pdf", "doc", "docx", "txt"].includes(ext || ""))
      return <FileText className="w-5 h-5" />;
    if (["zip", "rar", "7z"].includes(ext || ""))
      return <Archive className="w-5 h-5" />;
    return <FileCode className="w-5 h-5" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group ${
          isDragging
            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.01]"
            : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept={allowedTypes}
          className="hidden"
        />

        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
            isDragging
              ? "bg-blue-500 text-white scale-110"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110"
          }`}
        >
          <Upload className="w-8 h-8" />
        </div>

        <div className="text-center">
          <p className="text-base font-bold text-gray-900 dark:text-white">
            {isDragging
              ? "Drop files here"
              : "Click or drag files here to upload"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {allowedTypes
              ? `Allowed formats: ${allowedTypes}`
              : "All formats supported"}
          </p>
        </div>

        {/* Floating background elements for polish */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
          <motion.div
            animate={{
              y: isDragging ? [0, -10, 0] : 0,
              opacity: isDragging ? 0.2 : 0,
            }}
            className="absolute top-4 left-4 w-12 h-12 bg-blue-400 rounded-full blur-2xl"
          />
          <motion.div
            animate={{
              y: isDragging ? [0, 10, 0] : 0,
              opacity: isDragging ? 0.2 : 0,
            }}
            className="absolute bottom-4 right-4 w-16 h-16 bg-indigo-400 rounded-full blur-2xl"
          />
        </div>
      </div>

      {/* Selected Files List */}
      <AnimatePresence>
        {existingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {existingFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, scale: 0.9, x: -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm group hover:shadow-md transition-all hover:border-red-100 dark:hover:border-red-900/30"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                  {getFileIcon(file.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newFiles = [...existingFiles];
                    newFiles.splice(index, 1);
                    onFilesSelected(newFiles);
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileDropzone;
