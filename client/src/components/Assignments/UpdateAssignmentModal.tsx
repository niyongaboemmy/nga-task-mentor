import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/Button";
import { motion } from "framer-motion";
import axios from "axios";

interface UpdateAssignmentProps {
  assignment: {
    id: number;
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    submission_type: string;
    status: string;
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
    due_date: assignment.due_date, // Keep original UTC datetime as-is
    max_score: assignment.max_score,
    submission_type: assignment.submission_type,
    status: assignment.status,
  });

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

      // Send due_date exactly as entered (no timezone conversion)
      const updatedData = {
        ...formData,
        description: finalContent,
        due_date: formData.due_date, // Send exactly as entered
      };

      await axios.put(`/api/assignments/${assignment.id}`, updatedData);

      onSubmit(updatedData);
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      setError(error.response?.data?.message || "Failed to update assignment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
