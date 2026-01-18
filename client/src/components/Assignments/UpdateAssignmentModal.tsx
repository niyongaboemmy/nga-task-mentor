import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/Button";
import { motion } from "framer-motion";
import axios from "axios";
import {
  formatUTCToLocalDateTime,
  parseLocalDateTimeToUTC,
} from "../../utils/dateUtils";

interface UpdateAssignmentProps {
  assignment: {
    id: number;
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    submission_type: string;
    status: string;
    attachments?: {
      name: string;
      url: string;
      type: string;
      size: number;
    }[];
  };
  onSubmit: (assignmentData: any) => void;
  onCancel?: () => void;
}

const UpdateAssignmentModal: React.FC<UpdateAssignmentProps> = ({
  assignment,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    title: assignment.title,
    description: assignment.description,
    due_date: formatUTCToLocalDateTime(assignment.due_date),
    max_score: assignment.max_score,
    submission_type: assignment.submission_type,
    status: assignment.status,
  });

  const [existingAttachments, setExistingAttachments] = useState(
    assignment.attachments || [],
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize editor content when component mounts
  useEffect(() => {
    if (editorRef.current && !isInitialized) {
      editorRef.current.innerHTML = formData.description || "";
      setIsInitialized(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Get final content from editor
      const finalContent = editorRef.current?.innerHTML || "";

      // Convert local input to UTC for API
      const utcDueDate = parseLocalDateTimeToUTC(formData.due_date);

      const submitData = new FormData();
      submitData.append("title", formData.title);
      submitData.append("description", finalContent);
      submitData.append("due_date", utcDueDate.toISOString());
      submitData.append("max_score", formData.max_score.toString());
      submitData.append("submission_type", formData.submission_type);
      submitData.append("status", formData.status);

      // Existing attachments
      submitData.append(
        "existing_attachments",
        JSON.stringify(existingAttachments),
      );

      // New files
      newFiles.forEach((file) => {
        submitData.append("attachments", file);
      });

      await axios.put(`/api/assignments/${assignment.id}`, submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onSubmit({ ...formData, description: finalContent });
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      setError(error.response?.data?.message || "Failed to update assignment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setNewFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (url: string) => {
    setExistingAttachments((prev) => prev.filter((att) => att.url !== url));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "max_score" ? parseInt(value) : value,
    }));
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      if (content !== formData.description) {
        setFormData((prev) => ({
          ...prev,
          description: content,
        }));
      }
    }
  };

  // Rich text editor functions (simplified version)
  const insertFormatting = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();

      try {
        switch (command) {
          case "bold":
            document.execCommand("bold", false);
            break;
          case "italic":
            document.execCommand("italic", false);
            break;
          case "underline":
            document.execCommand("underline", false);
            break;
          case "insertUnorderedList":
            document.execCommand("insertUnorderedList", false);
            break;
          case "insertOrderedList":
            document.execCommand("insertOrderedList", false);
            break;
          default:
            document.execCommand(command, false, value);
        }
      } catch (error) {
        console.error("Error executing command:", command, error);
      }

      const content = editorRef.current.innerHTML;
      setFormData((prev) => ({
        ...prev,
        description: content,
      }));

      editorRef.current.focus();
    }
  };

  return (
    <motion.div
      className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <motion.h1
          className="text-2xl font-semibold text-gray-900 dark:text-white mb-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          Update Assignment
        </motion.h1>
        <motion.p
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Modify assignment details and settings
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Assignment Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="gap-6">
                {/* Title */}
                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter assignment title..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  />
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Due Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Max Score
                    </label>
                    <input
                      type="number"
                      name="max_score"
                      value={formData.max_score}
                      onChange={handleChange}
                      min="1"
                      max="1000"
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Submission Type
                    </label>
                    <select
                      name="submission_type"
                      value={formData.submission_type}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    >
                      <option value="both">📁 File & ✍️ Text</option>
                      <option value="file">📁 File Only</option>
                      <option value="text">✍️ Text Only</option>
                    </select>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="published">✅ Published</option>
                    <option value="completed">🏁 Completed</option>
                    <option value="removed">❌ Removed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Attachments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Attachments
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              + Add Files
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />
          </div>

          <div className="space-y-3">
            {/* Existing Attachments */}
            {existingAttachments.map((att, index) => (
              <div
                key={`existing-${index}`}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <svg
                      className="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {att.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(att.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeExistingAttachment(att.url)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {/* New Files */}
            {newFiles.map((file, index) => (
              <div
                key={`new-${index}`}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      New Upload
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeNewFile(index)}
                  className="p-2 text-red-500 hover:bg-white rounded-lg transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {existingAttachments.length === 0 && newFiles.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                No attachments
              </div>
            )}
          </div>
        </motion.div>

        {/* Description Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Description
          </label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
            {/* Simple Toolbar */}
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2">
              <div className="flex flex-wrap items-center gap-1 text-sm">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("bold")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <strong>B</strong>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("italic")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <em>I</em>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("underline")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <u>U</u>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("insertUnorderedList")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  •
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting("insertOrderedList")}
                  className="h-8 w-8 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  1.
                </Button>
              </div>
            </div>

            {/* Editor */}
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              className="min-h-[200px] p-4 focus:outline-none bg-white dark:bg-gray-800 dark:text-white"
              style={{ color: "black" }}
            />
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700"
        >
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Assignment"}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
};

export default UpdateAssignmentModal;
