import RichTextEditor from "../Common/RichTextEditor";
import { Plus, Trash2 } from "lucide-react";
import { type RubricCriterion } from "./AssignmentCard";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface AssignmentFormData {
  title: string;
  description: string;
  due_date: string;
  max_score: string;
  submission_type: string;
  allowed_file_types: string;
  rubric: RubricCriterion[] | string;
  status: string;
  attachments?: Attachment[];
}

interface AssignmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  editFormData: AssignmentFormData;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  newFiles: File[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveNewFile: (index: number) => void;
  onRemoveExistingAttachment: (index: number) => void;
}

const AssignmentForm: React.FC<AssignmentFormProps> = ({
  isOpen,
  onClose,
  editFormData,
  onInputChange,
  onSubmit,
  newFiles,
  onFileChange,
  onRemoveNewFile,
  onRemoveExistingAttachment,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Edit Assignment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={editFormData.title}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <RichTextEditor
              content={editFormData.description}
              onChange={(content) => {
                onInputChange({
                  target: { name: "description", value: content },
                } as any);
              }}
              placeholder="Enter assignment description..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="due_date"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Due Date
              </label>
              <input
                type="datetime-local"
                id="due_date"
                name="due_date"
                value={editFormData.due_date}
                onChange={onInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label
                htmlFor="max_score"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Max Score
              </label>
              <input
                type="number"
                id="max_score"
                name="max_score"
                value={editFormData.max_score}
                onChange={onInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="submission_type"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Submission Type
            </label>
            <select
              id="submission_type"
              name="submission_type"
              value={editFormData.submission_type}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="text">Text Only</option>
              <option value="file">File Upload Only</option>
              <option value="both">Both Text and File</option>
            </select>
          </div>

          {/* Attachments Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attachments
            </label>

            {/* Existing Attachments */}
            {editFormData.attachments &&
              editFormData.attachments.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    Existing Files
                  </p>
                  {editFormData.attachments.map((file, index) => (
                    <div
                      key={`existing-${index}`}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-xl">📄</span>
                        <a
                          href={
                            file.url.startsWith("http")
                              ? file.url
                              : `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}${file.url.startsWith("/") ? "" : "/"}${file.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                        >
                          {file.name}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveExistingAttachment(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove file"
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
                </div>
              )}

            {/* New File Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg
                      className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 20 16"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Click to upload</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PDF, DOC, Images (MAX. 10MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={onFileChange}
                  />
                </label>
              </div>

              {/* New Files List */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold">
                    New Files to Upload
                  </p>
                  {newFiles.map((file, index) => (
                    <div
                      key={`new-${index}`}
                      className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-xl">📄</span>
                        <span className="text-sm text-gray-900 dark:text-white truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveNewFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
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
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="allowed_file_types"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Allowed File Types (comma-separated)
            </label>
            <input
              type="text"
              id="allowed_file_types"
              name="allowed_file_types"
              value={editFormData.allowed_file_types}
              onChange={onInputChange}
              placeholder="pdf,docx,txt"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Rubric Management */}
          <div className="space-y-4 py-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Grading Rubric
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Define the criteria for grading this assignment
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const currentRubric = Array.isArray(editFormData.rubric)
                    ? editFormData.rubric
                    : [];
                  const newCriterion: RubricCriterion = {
                    criteria: "",
                    max_score: 10,
                    description: "",
                  };
                  onInputChange({
                    target: {
                      name: "rubric",
                      value: [...currentRubric, newCriterion],
                    },
                  } as any);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="flex flex-row items-center justify-center gap-2">
                  <div>
                    <Plus className="w-4 h-4" />
                  </div>
                  <span>Add Criterion</span>
                </div>
              </button>
            </div>

            <div className="space-y-3">
              {Array.isArray(editFormData.rubric) &&
              editFormData.rubric.length > 0 ? (
                editFormData.rubric.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-4 border border-gray-100 dark:border-gray-700 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              placeholder="Criterion name"
                              value={item.criteria}
                              onChange={(e) => {
                                const newRubric = [
                                  ...(editFormData.rubric as RubricCriterion[]),
                                ];
                                newRubric[index] = {
                                  ...newRubric[index],
                                  criteria: e.target.value,
                                };
                                onInputChange({
                                  target: { name: "rubric", value: newRubric },
                                } as any);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              placeholder="Pts"
                              value={item.max_score}
                              onChange={(e) => {
                                const newRubric = [
                                  ...(editFormData.rubric as RubricCriterion[]),
                                ];
                                newRubric[index] = {
                                  ...newRubric[index],
                                  max_score: parseInt(e.target.value) || 0,
                                };
                                onInputChange({
                                  target: { name: "rubric", value: newRubric },
                                } as any);
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                        </div>
                        <textarea
                          placeholder="Description..."
                          value={item.description}
                          onChange={(e) => {
                            const newRubric = [
                              ...(editFormData.rubric as RubricCriterion[]),
                            ];
                            newRubric[index] = {
                              ...newRubric[index],
                              description: e.target.value,
                            };
                            onInputChange({
                              target: { name: "rubric", value: newRubric },
                            } as any);
                          }}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newRubric = (
                            editFormData.rubric as RubricCriterion[]
                          ).filter((_, i) => i !== index);
                          onInputChange({
                            target: { name: "rubric", value: newRubric },
                          } as any);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    No grading criteria defined.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              value={editFormData.status}
              onChange={onInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignmentForm;
