import React, { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../../utils/axiosConfig";
import { parseLocalDateTimeToUTC } from "../../utils/dateUtils";
import RichTextEditor from "../Common/RichTextEditor";
import { Plus, Trash2, Info } from "lucide-react";
import { type RubricCriterion } from "./AssignmentCard";
import FileDropzone from "../Common/FileDropzone";

interface CreateAssignmentProps {
  onSubmit: (assignmentData: {
    title: string;
    description: string;
    due_date: string;
    max_score: number;
    submission_type: string;
    course_id: string;
    rubric?: RubricCriterion[];
    attachments?: File[];
  }) => void;
  onCancel?: () => void;
  initialCourseId?: string;
}

const CreateAssignment: React.FC<CreateAssignmentProps> = ({
  onSubmit,
  onCancel,
  initialCourseId,
}) => {
  const [courses, setCourses] = useState<
    { id: string; title: string; code: string }[]
  >([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    max_score: 100,
    submission_type: "both",
    course_id: initialCourseId || "",
    rubric: [] as RubricCriterion[],
    allowed_file_types: "pdf,docx,jpg,png,zip",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Fetch courses for the current user
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get(" /courses");
        const coursesData = response.data.data || response.data;
        setCourses(coursesData);
      } catch (error) {
        console.error("Error fetching courses:", error);
        setCourses([]);
      }
    };

    fetchCourses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Convert local input to UTC for API
      const utcDueDate = formData.due_date
        ? parseLocalDateTimeToUTC(formData.due_date).toISOString().slice(0, 16)
        : "";

      await onSubmit({
        ...formData,
        due_date: utcDueDate,
        attachments: files,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        due_date: "",
        max_score: 100,
        submission_type: "both",
        course_id: "",
        rubric: [],
        allowed_file_types: "pdf,docx,jpg,png,zip",
      });
      setFiles([]);
    } catch (error) {
      console.error("Error creating assignment:", error);
    } finally {
      setIsSubmitting(false);
    }
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
          Create New Assignment
        </motion.h1>
        <motion.p
          className="text-sm text-gray-600 dark:text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Design and publish your assignment for students
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Assignment Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-100 dark:border-blue-800"
        >
          <div className="flex items-start gap-4">
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Enter a compelling title..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Course
                    </label>
                    <select
                      name="course_id"
                      value={formData.course_id}
                      // onChange={handleChange}
                      required
                      disabled
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                    >
                      <option value="">Select a course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} - {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  {formData.submission_type !== "text" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Allowed File Types (comma-separated)
                      </label>
                      <input
                        type="text"
                        name="allowed_file_types"
                        value={formData.allowed_file_types}
                        onChange={handleChange}
                        placeholder="pdf, docx, jpg, png, zip"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white transition-all duration-200 bg-white/80 backdrop-blur-sm"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 ml-1">
                        Leave empty to allow all types. Common types: pdf, docx,
                        jpg, png, zip
                      </p>
                    </div>
                  )}
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
          <RichTextEditor
            content={formData.description}
            onChange={(content) =>
              setFormData((prev) => ({ ...prev, description: content }))
            }
            placeholder="Describe the assignment, goals, and instructions..."
          />
        </motion.div>

        {/* Rubric Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Grading Rubric
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Define the criteria for grading this assignment
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const newCriterion: RubricCriterion = {
                  criteria: "",
                  max_score: 10,
                  description: "",
                };
                setFormData((prev) => ({
                  ...prev,
                  rubric: [...(prev.rubric || []), newCriterion],
                }));
              }}
              className="flex flex-row items-center gap-2 border-dashed"
            >
              <div className="flex flex-row items-center justify-center gap-2">
                <div>
                  <Plus className="w-4 h-4" />
                </div>
                <span>Add Criterion</span>
              </div>
            </Button>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {formData.rubric && formData.rubric.length > 0 ? (
                formData.rubric.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700/50 mb-3 group hover:border-blue-200 dark:hover:border-blue-800/50 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-3">
                              <input
                                type="text"
                                placeholder="Criterion name (e.g. Grammar, Logic)"
                                value={item.criteria}
                                onChange={(e) => {
                                  const newRubric = [
                                    ...(formData.rubric || []),
                                  ];
                                  newRubric[index].criteria = e.target.value;
                                  setFormData((prev) => ({
                                    ...prev,
                                    rubric: newRubric,
                                  }));
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                placeholder="Points"
                                value={item.max_score}
                                onChange={(e) => {
                                  const newRubric = [
                                    ...(formData.rubric || []),
                                  ];
                                  newRubric[index].max_score =
                                    parseInt(e.target.value) || 0;
                                  setFormData((prev) => ({
                                    ...prev,
                                    rubric: newRubric,
                                  }));
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                              />
                            </div>
                          </div>
                          <textarea
                            placeholder="Description of what defines a good score in this criterion..."
                            value={item.description}
                            onChange={(e) => {
                              const newRubric = [...(formData.rubric || [])];
                              newRubric[index].description = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                rubric: newRubric,
                              }));
                            }}
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white resize-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newRubric = (formData.rubric || []).filter(
                              (_, i) => i !== index,
                            );
                            setFormData((prev) => ({
                              ...prev,
                              rubric: newRubric,
                            }));
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl"
                >
                  <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-2 text-gray-400">
                    <Info className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No rubric criteria yet. Click "Add Criterion" to start.
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wider">
                    Optional but recommended
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {formData.rubric && formData.rubric.length > 0 && (
              <div className="flex justify-end pr-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Rubric Total:{" "}
                  <span className="text-blue-600 dark:text-blue-400">
                    {formData.rubric.reduce(
                      (acc, curr) => acc + curr.max_score,
                      0,
                    )}
                  </span>
                  / {formData.max_score} points
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Attachments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
            Attachments
          </label>
          <FileDropzone
            onFilesSelected={(updatedFiles: File[]) => setFiles(updatedFiles)}
            allowedTypes={
              formData.submission_type !== "text"
                ? formData.allowed_file_types
                : ""
            }
            existingFiles={files}
          />
        </motion.div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className="px-6"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
          >
            {isSubmitting ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default CreateAssignment;
